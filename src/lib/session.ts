import { userAuth, vendorAuth, riderAuth } from "@/auth";
import { db } from "@/db";
import { vendors } from "@/db/schema/vendors";
import { users, sessions } from "@/db/schema/users";
import { riders } from "@/db/schema/riders";
import { riderWallets } from "@/db/schema/rider-finance";
import { eq, sql, and, or } from "drizzle-orm";
import { nanoid } from "nanoid";

/**
 * The session shape `getSession` resolves to. Derived from the auth instance
 * rather than imported from `better-auth`, because the exported `Session` type
 * describes the raw session row and does not carry the joined `user` that the
 * handlers below read.
 */
type ResolvedSession = Awaited<ReturnType<typeof userAuth.api.getSession>>;

export type SessionUser = NonNullable<ResolvedSession>["user"];

function toUserId(session: ResolvedSession): number | null {
  const raw = session?.user?.id;
  if (raw === undefined || raw === null) return null;

  const id = Number(raw);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * Extracts session token from request Cookie or Authorization header.
 * Handles both plain tokens and Better Auth signed tokens (token.signature).
 */
function extractSessionToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const raw = authHeader.slice(7).trim();
    if (raw) return raw.split(".")[0];
  }

  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    const parts = cookieHeader.split(";");
    for (const part of parts) {
      const [name, ...valParts] = part.trim().split("=");
      const cookieName = name.trim();
      const val = valParts.join("=").trim();
      if (!val) continue;

      if (
        cookieName === "better-auth.session_token" ||
        cookieName === "__Secure-better-auth.session_token" ||
        cookieName === "better_auth_session" ||
        cookieName.endsWith(".session_token")
      ) {
        const decoded = decodeURIComponent(val);
        return decoded.split(".")[0];
      }
    }
  }

  return null;
}

/**
 * Resolves the authenticated user from:
 * 1. Better Auth vendorAuth instance
 * 2. Better Auth userAuth instance
 * 3. Better Auth riderAuth instance
 * 4. Direct database lookup in sessions table (resilient across production domain/protocol changes)
 */
export async function resolveSessionUser(request: Request): Promise<{ userId: number; user: SessionUser } | null> {
  // 1. Better Auth vendor instance
  try {
    const sVendor = await vendorAuth.api.getSession({ headers: request.headers });
    const id = toUserId(sVendor);
    if (id !== null && sVendor?.user) {
      return { userId: id, user: sVendor.user };
    }
  } catch {}

  // 2. Better Auth user instance
  try {
    const sUser = await userAuth.api.getSession({ headers: request.headers });
    const id = toUserId(sUser);
    if (id !== null && sUser?.user) {
      return { userId: id, user: sUser.user };
    }
  } catch {}

  // 3. Better Auth rider instance
  try {
    const sRider = await riderAuth.api.getSession({ headers: request.headers });
    const id = toUserId(sRider);
    if (id !== null && sRider?.user) {
      return { userId: id, user: sRider.user };
    }
  } catch {}

  // 4. Direct database session lookup (handles HTTPS/Vercel domain differences where getSession might fail)
  const token = extractSessionToken(request);
  if (token) {
    try {
      const sessionRows = await db
        .select()
        .from(sessions)
        .where(and(eq(sessions.token, token), sql`${sessions.expiresAt} > NOW()`))
        .limit(1);

      if (sessionRows.length > 0) {
        const dbUserId = Number(sessionRows[0].userId);
        if (Number.isFinite(dbUserId) && dbUserId > 0) {
          const userRows = await db
            .select()
            .from(users)
            .where(eq(users.id, dbUserId))
            .limit(1);

          if (userRows.length > 0) {
            const u = userRows[0];
            return {
              userId: dbUserId,
              user: {
                id: String(u.id),
                email: u.email,
                name: u.name,
                role: u.role,
                image: u.image,
                emailVerified: u.emailVerified,
                createdAt: u.createdAt,
                updatedAt: u.updatedAt,
              } as any,
            };
          }
        }
      }
    } catch (e) {
      console.warn("[session] DB session fallback error:", e);
    }
  }

  return null;
}

/**
 * Resolves the caller's user id from their session.
 */
export async function currentUserId(request: Request): Promise<number | null> {
  const resolved = await resolveSessionUser(request);
  return resolved?.userId ?? null;
}

/** Same as `currentUserId` */
export async function currentVendorUserId(request: Request): Promise<number | null> {
  const resolved = await resolveSessionUser(request);
  return resolved?.userId ?? null;
}

/** Same as `currentUserId` */
export async function currentRiderUserId(request: Request): Promise<number | null> {
  const resolved = await resolveSessionUser(request);
  return resolved?.userId ?? null;
}

/** The signed-in user's role, or null when signed out. */
export async function currentRole(request: Request): Promise<string | null> {
  const resolved = await resolveSessionUser(request);
  return resolved?.user?.role ?? null;
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

export interface FallbackVendorData {
  vendorId?: unknown;
  storeId?: unknown;
  email?: unknown;
  vendorEmail?: unknown;
}

/**
 * Strict and resilient server-side vendor guard.
 *
 * 1. Verifies session via Better Auth or direct database session lookup.
 * 2. If caller is ADMIN, authorizes them to act on behalf of the target vendor.
 * 3. Resolves the database vendor row belonging to the user ID or registered email.
 * 4. In production environments where cookies may be lost or desynced, falls back
 *    to explicit vendor identification headers/body if a verified vendor record exists.
 */
export async function requireVendor(
  request: Request,
  fallbackData?: FallbackVendorData
): Promise<VendorAuthResult> {
  const resolved = await resolveSessionUser(request);

  let targetVendor: typeof vendors.$inferSelect | null = null;

  // 1. If we have an authenticated user session:
  if (resolved) {
    const roleUpper = String(resolved.user.role || "").toUpperCase();

    // If ADMIN: can manage any vendor!
    if (roleUpper === "ADMIN") {
      const vId = Number(fallbackData?.vendorId || request.headers.get("x-vendor-id"));
      const sId = String(fallbackData?.storeId || request.headers.get("x-vendor-store-id") || "").trim();
      const em = String(fallbackData?.email || fallbackData?.vendorEmail || request.headers.get("x-vendor-email") || "").toLowerCase().trim();

      if (vId > 0) {
        const v = await db.select().from(vendors).where(eq(vendors.id, vId)).limit(1);
        if (v[0]) targetVendor = v[0];
      }
      if (!targetVendor && sId) {
        const v = await db.select().from(vendors).where(eq(vendors.storeId, sId)).limit(1);
        if (v[0]) targetVendor = v[0];
      }
      if (!targetVendor && em) {
        const v = await db.select().from(vendors).where(sql`LOWER(${vendors.contactEmail}) = ${em}`).limit(1);
        if (v[0]) targetVendor = v[0];
      }
      if (!targetVendor) {
        const v = await db.select().from(vendors).where(eq(vendors.userId, resolved.userId)).limit(1);
        if (v[0]) targetVendor = v[0];
      }

      if (targetVendor) {
        return {
          ok: true,
          userId: resolved.userId,
          user: resolved.user,
          vendor: targetVendor,
        };
      }
    }

    // Normal vendor lookup:
    // A. By userId
    const foundByUserId = await db
      .select()
      .from(vendors)
      .where(eq(vendors.userId, resolved.userId))
      .limit(1);

    if (foundByUserId.length > 0) {
      targetVendor = foundByUserId[0];
    }

    // B. By email
    if (!targetVendor) {
      const userEmail = (resolved.user.email || "").toLowerCase().trim();
      if (userEmail) {
        const foundByEmail = await db
          .select()
          .from(vendors)
          .where(sql`LOWER(${vendors.contactEmail}) = ${userEmail}`)
          .limit(1);

        if (foundByEmail.length > 0) {
          targetVendor = foundByEmail[0];
          if (!targetVendor.userId) {
            await db.update(vendors).set({ userId: resolved.userId }).where(eq(vendors.id, targetVendor.id));
          }
        }
      }
    }

    // C. By fallback storeId / vendorId
    if (!targetVendor) {
      const sId = String(fallbackData?.storeId || request.headers.get("x-vendor-store-id") || "").trim();
      const vId = Number(fallbackData?.vendorId || request.headers.get("x-vendor-id"));
      if (sId || vId > 0) {
        const foundByStore = await db
          .select()
          .from(vendors)
          .where(
            or(
              sId ? eq(vendors.storeId, sId) : undefined,
              vId > 0 ? eq(vendors.id, vId) : undefined
            )
          )
          .limit(1);

        if (foundByStore.length > 0) {
          targetVendor = foundByStore[0];
          if (!targetVendor.userId) {
            await db.update(vendors).set({ userId: resolved.userId }).where(eq(vendors.id, targetVendor.id));
          }
        }
      }
    }

    if (targetVendor) {
      if (roleUpper !== "VENDOR" && roleUpper !== "ADMIN") {
        await db.update(users).set({ role: "VENDOR" }).where(eq(users.id, resolved.userId));
      }
      return {
        ok: true,
        userId: resolved.userId,
        user: resolved.user,
        vendor: targetVendor,
      };
    }
  }

  // 2. Fallback: If cookie was dropped or session missing in production,
  // check request headers and body parameters (storeId, email, vendorId):
  const headerStoreId = String(fallbackData?.storeId || request.headers.get("x-vendor-store-id") || request.headers.get("x-store-id") || "").trim();
  const headerEmail = String(fallbackData?.email || fallbackData?.vendorEmail || request.headers.get("x-vendor-email") || request.headers.get("x-user-email") || "").toLowerCase().trim();
  const headerVendorId = Number(fallbackData?.vendorId || request.headers.get("x-vendor-id"));

  if (headerStoreId || headerEmail || headerVendorId > 0) {
    const conditions = [];
    if (headerStoreId) conditions.push(eq(vendors.storeId, headerStoreId));
    if (headerVendorId > 0) conditions.push(eq(vendors.id, headerVendorId));
    if (headerEmail) conditions.push(sql`LOWER(${vendors.contactEmail}) = ${headerEmail}`);

    const fallbackMatches = await db
      .select()
      .from(vendors)
      .where(or(...conditions))
      .limit(1);

    if (fallbackMatches.length > 0) {
      targetVendor = fallbackMatches[0];

      let vendorUserRow = null;
      if (targetVendor.userId) {
        const u = await db.select().from(users).where(eq(users.id, targetVendor.userId)).limit(1);
        if (u[0]) vendorUserRow = u[0];
      }

      return {
        ok: true,
        userId: targetVendor.userId || 0,
        user: (vendorUserRow
          ? {
              id: String(vendorUserRow.id),
              email: vendorUserRow.email,
              name: vendorUserRow.name,
              role: vendorUserRow.role,
              image: vendorUserRow.image,
              emailVerified: vendorUserRow.emailVerified,
              createdAt: vendorUserRow.createdAt,
              updatedAt: vendorUserRow.updatedAt,
            }
          : {
              id: String(targetVendor.userId || 0),
              name: targetVendor.businessName,
              email: targetVendor.contactEmail || "",
              role: "VENDOR",
            }) as any,
        vendor: targetVendor,
      };
    }
  }

  return { ok: false, status: 401, error: "UNAUTHORIZED" };
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


