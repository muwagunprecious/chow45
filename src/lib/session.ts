import { userAuth, vendorAuth, riderAuth } from "@/auth";
import { db } from "@/db";
import { vendors } from "@/db/schema/vendors";
import { users } from "@/db/schema/users";
import { riders } from "@/db/schema/riders";
import { riderWallets } from "@/db/schema/rider-finance";
import { eq, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

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
 * Checks user-scoped, rider-scoped, and vendor-scoped auth instances.
 */
export async function currentUserId(request: Request): Promise<number | null> {
  let session = await userAuth.api.getSession({ headers: request.headers });
  let id = toUserId(session);
  if (id === null) {
    session = await riderAuth.api.getSession({ headers: request.headers });
    id = toUserId(session);
  }
  if (id === null) {
    session = await vendorAuth.api.getSession({ headers: request.headers });
    id = toUserId(session);
  }
  return id;
}

/** Same as `currentUserId` but checks vendor-scoped instance first. */
export async function currentVendorUserId(request: Request): Promise<number | null> {
  let session = await vendorAuth.api.getSession({ headers: request.headers });
  let id = toUserId(session);
  if (id === null) {
    session = await userAuth.api.getSession({ headers: request.headers });
    id = toUserId(session);
  }
  return id;
}

/** Same as `currentUserId` but checks rider-scoped instance first. */
export async function currentRiderUserId(request: Request): Promise<number | null> {
  let session = await riderAuth.api.getSession({ headers: request.headers });
  let id = toUserId(session);
  if (id === null) {
    session = await userAuth.api.getSession({ headers: request.headers });
    id = toUserId(session);
  }
  return id;
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
  let session = await userAuth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    session = await vendorAuth.api.getSession({ headers: request.headers });
  }
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
 * 1. Verifies the caller's Better Auth session from request headers/cookies
 *    (checks vendorAuth first, then userAuth fallback).
 * 2. Enforces that the caller is a vendor (by role or by existing vendor record).
 * 3. Resolves the database vendor row belonging to that authenticated user ID
 *    or registered contact email.
 * 4. Fails with 401 (unauthenticated) or 403 (unauthorized/forbidden).
 */
export async function requireVendor(request: Request): Promise<VendorAuthResult> {
  let session = await vendorAuth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    session = await userAuth.api.getSession({ headers: request.headers });
  }

  if (!session?.user?.id) {
    return { ok: false, status: 401, error: "UNAUTHORIZED" };
  }

  const userId = Number(session.user.id);
  if (!Number.isFinite(userId) || userId <= 0) {
    return { ok: false, status: 401, error: "UNAUTHORIZED" };
  }

  // Find vendor by userId
  let found = await db
    .select()
    .from(vendors)
    .where(eq(vendors.userId, userId))
    .limit(1);

  let vendor = found[0];

  // If not found by userId, check by registered email (e.g. pre-seeded vendors)
  if (!vendor) {
    const userRow = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const userEmail = (userRow[0]?.email || session.user.email || "").toLowerCase().trim();
    if (userEmail) {
      const vendorMatches = await db
        .select()
        .from(vendors)
        .where(sql`LOWER(${vendors.contactEmail}) = ${userEmail}`)
        .limit(1);

      if (vendorMatches.length > 0) {
        vendor = vendorMatches[0];
        // Associate vendor record with authenticated user ID
        if (!vendor.userId) {
          await db
            .update(vendors)
            .set({ userId })
            .where(eq(vendors.id, vendor.id));
        }
      }
    }
  }

  const roleUpper = String(session.user.role || "").toUpperCase();
  if (!vendor && roleUpper !== "VENDOR") {
    return { ok: false, status: 403, error: "FORBIDDEN_NOT_VENDOR" };
  }

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

export interface AuthenticatedRiderContext {
  ok: true;
  userId: number;
  user: SessionUser;
  rider: typeof riders.$inferSelect;
  wallet: typeof riderWallets.$inferSelect;
}

export interface FailedRiderContext {
  ok: false;
  status: 401 | 403;
  error: string;
  message?: string;
  applicationStatus?: string;
}

export type RiderAuthResult = AuthenticatedRiderContext | FailedRiderContext;

/**
 * Strict server-side rider guard.
 *
 * 1. Checks riderAuth session (falls back to userAuth/vendorAuth).
 * 2. Locates rider profile by userId or email.
 * 3. Enforces verification status:
 *    - SUSPENDED -> 403 RIDER_SUSPENDED
 *    - REJECTED  -> 403 RIDER_REJECTED
 *    - PENDING_REVIEW -> 403 RIDER_PENDING_APPROVAL (unless allowPending = true)
 * 4. Ensures a wallet record exists for the rider.
 */
export async function requireRider(
  request: Request,
  allowPending = false
): Promise<RiderAuthResult> {
  let session = await riderAuth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    session = await userAuth.api.getSession({ headers: request.headers });
  }
  if (!session?.user?.id) {
    session = await vendorAuth.api.getSession({ headers: request.headers });
  }

  if (!session?.user?.id) {
    return { ok: false, status: 401, error: "UNAUTHORIZED", message: "Sign in as a rider first." };
  }

  const userId = Number(session.user.id);
  if (!Number.isFinite(userId) || userId <= 0) {
    return { ok: false, status: 401, error: "UNAUTHORIZED", message: "Invalid session." };
  }

  // 1. Locate rider by userId
  let found = await db.select().from(riders).where(eq(riders.userId, userId)).limit(1);
  let rider = found[0];

  // 2. Fallback: match by email if account wasn't linked yet
  if (!rider) {
    const userRow = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const userEmail = (userRow[0]?.email || session.user.email || "").toLowerCase().trim();
    if (userEmail) {
      // Find rider by matching user ID in users table with this email
      const userMatches = await db
        .select({ id: users.id })
        .from(users)
        .where(sql`LOWER(${users.email}) = ${userEmail}`)
        .limit(1);

      if (userMatches.length > 0) {
        const matchingRider = await db
          .select()
          .from(riders)
          .where(eq(riders.userId, userMatches[0].id))
          .limit(1);

        if (matchingRider.length > 0) {
          rider = matchingRider[0];
          if (!rider.userId) {
            await db.update(riders).set({ userId }).where(eq(riders.id, rider.id));
          }
        }
      }
    }
  }

  if (!rider) {
    return {
      ok: false,
      status: 403,
      error: "RIDER_PROFILE_NOT_FOUND",
      message: "No rider profile associated with this account. Please register first.",
    };
  }

  // 3. Status checks
  const status = (rider.applicationStatus || rider.approvalStatus || "PENDING_REVIEW").toUpperCase();

  if (status === "SUSPENDED") {
    return {
      ok: false,
      status: 403,
      error: "RIDER_SUSPENDED",
      message: rider.suspensionReason || "Your rider account has been suspended. Please contact Chow45 support.",
      applicationStatus: "SUSPENDED",
    };
  }

  if (status === "REJECTED") {
    return {
      ok: false,
      status: 403,
      error: "RIDER_REJECTED",
      message: rider.rejectionReason || "Your rider application was not approved. Please contact Chow45 support.",
      applicationStatus: "REJECTED",
    };
  }

  if (status === "PENDING" || status === "PENDING_REVIEW") {
    if (!allowPending) {
      return {
        ok: false,
        status: 403,
        error: "RIDER_PENDING_APPROVAL",
        message: "Your application is currently being reviewed by Chow45 operations.",
        applicationStatus: "PENDING_REVIEW",
      };
    }
  }

  // 4. Ensure wallet exists
  let walletRows = await db.select().from(riderWallets).where(eq(riderWallets.riderId, rider.id)).limit(1);
  let wallet = walletRows[0];
  if (!wallet) {
    const newWallet = {
      id: `wallet-${rider.id}`,
      riderId: rider.id,
      available: 0,
      processing: 0,
      totalEarned: 0,
      currency: "NGN",
    };
    const [created] = await db.insert(riderWallets).values(newWallet).returning();
    wallet = created;
  }

  return {
    ok: true,
    userId,
    user: session.user,
    rider,
    wallet,
  };
}

export interface AuthenticatedAdminContext {
  ok: true;
  userId: number;
  user: SessionUser;
}

export interface FailedAdminContext {
  ok: false;
  status: 401 | 403;
  error: string;
}

export type AdminAuthResult = AuthenticatedAdminContext | FailedAdminContext;

/**
 * Strict server-side admin guard.
 */
export async function requireAdmin(request: Request): Promise<AdminAuthResult> {
  let session = await userAuth.api.getSession({ headers: request.headers });
  if (!session?.user?.id) {
    session = await vendorAuth.api.getSession({ headers: request.headers });
  }
  if (!session?.user?.id) {
    session = await riderAuth.api.getSession({ headers: request.headers });
  }

  if (!session?.user?.id) {
    return { ok: false, status: 401, error: "UNAUTHORIZED" };
  }

  const userId = Number(session.user.id);
  if (!Number.isFinite(userId) || userId <= 0) {
    return { ok: false, status: 401, error: "UNAUTHORIZED" };
  }

  const userRole = String(session.user.role || "").toUpperCase();
  if (userRole === "ADMIN") {
    return { ok: true, userId, user: session.user };
  }

  // Double check database user role
  const userRow = await db
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (userRow[0]?.role?.toUpperCase() === "ADMIN") {
    return { ok: true, userId, user: session.user };
  }

  return { ok: false, status: 403, error: "FORBIDDEN_ADMIN_ONLY" };
}


