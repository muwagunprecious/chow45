import { userAuth, vendorAuth } from "@/auth";
import { db } from "@/db";
import { vendors } from "@/db/schema/vendors";
import { eq } from "drizzle-orm";

/**
 * The session shape `getSession` resolves to. Derived from the auth instance
 * rather than imported from `better-auth`, because the exported `Session` type
 * describes the raw session row and does not carry the joined `user` that the
 * handlers below read.
 */
type ResolvedSession = Awaited<ReturnType<typeof userAuth.api.getSession>>;

/**
 * Resolves the caller's user id from their Better Auth session.
 *
 * Returns `null` for a signed-out caller rather than throwing, because most
 * routes treat "not signed in" as an empty result instead of an error: browsing
 * the marketplace is public, so a guest is a normal case, not a failure.
 *
 * Better Auth carries ids as strings while the `users.id` column is a
 * bigserial, so the conversion is checked rather than trusted.
 */
export async function currentUserId(request: Request): Promise<number | null> {
  const session = await userAuth.api.getSession({ headers: request.headers });
  return toUserId(session);
}

/** Same as `currentUserId` but resolves through the vendor-scoped instance. */
export async function currentVendorUserId(request: Request): Promise<number | null> {
  const session = await vendorAuth.api.getSession({ headers: request.headers });
  return toUserId(session);
}

function toUserId(session: ResolvedSession): number | null {
  const raw = session?.user?.id;
  if (raw === undefined || raw === null) return null;

  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export type SessionUser = NonNullable<ResolvedSession>["user"];

/** The signed-in user's role, or null when signed out. */
export async function currentRole(request: Request): Promise<string | null> {
  const session = await userAuth.api.getSession({ headers: request.headers });
  return session?.user?.role ?? null;
}

export interface AuthenticatedVendorContext {
  ok: true;
  userId: number;
  user: SessionUser;
  vendor: typeof vendors.$inferSelect;
}

export interface FailedVendorContext {
  ok: false;
  status: 401 | 403;
  error: string;
}

export type VendorAuthResult = AuthenticatedVendorContext | FailedVendorContext;

/**
 * Strict server-side vendor guard.
 *
 * 1. Verifies the caller's Better Auth session from request headers/cookies.
 * 2. Enforces that the user has the VENDOR role.
 * 3. Resolves the database vendor row belonging to that authenticated user ID.
 * 4. Fails with 401 (unauthenticated) or 403 (unauthorized/forbidden).
 *
 * Never trusts any client-supplied vendorId, userId, or email.
 */
export async function requireVendor(request: Request): Promise<VendorAuthResult> {
  const session = await vendorAuth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    return { ok: false, status: 401, error: "UNAUTHORIZED" };
  }

  const userId = Number(session.user.id);
  if (!Number.isFinite(userId) || userId <= 0) {
    return { ok: false, status: 401, error: "UNAUTHORIZED" };
  }

  if (session.user.role !== "VENDOR") {
    return { ok: false, status: 403, error: "FORBIDDEN_NOT_VENDOR" };
  }

  const found = await db
    .select()
    .from(vendors)
    .where(eq(vendors.userId, userId))
    .limit(1);

  const vendor = found[0];
  if (!vendor) {
    return { ok: false, status: 403, error: "VENDOR_PROFILE_NOT_FOUND" };
  }

  return {
    ok: true,
    userId,
    user: session.user,
    vendor,
  };
}

