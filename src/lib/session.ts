import { userAuth, vendorAuth } from "@/auth";

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
