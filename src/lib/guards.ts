import { userAuth, vendorAuth, riderAuth, adminAuth } from "@/auth";
import { db, riders } from "@/db";
import { vendors } from "@/db/schema/vendors";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";

// 1. User Guard
export async function requireUser() {
  const session = await userAuth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "USER") return { authorized: false as const };
  return { authorized: true as const, user: session.user };
}

// 2. Vendor Guard (Guarantees `check.vendor` exists!)
export async function requireVendor() {
  const session = await vendorAuth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "VENDOR") return { authorized: false as const };

  const vendor = await db.query.vendors.findFirst({
    where: eq(vendors.userId, Number(session.user.id)),
  });
  if (!vendor) return { authorized: false as const };

  return { authorized: true as const, user: session.user, vendor };
}

// 3. Rider Guard (Guarantees `check.rider` exists!)
export async function requireRider() {
  const session = await riderAuth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "RIDER") return { authorized: false as const };

  const rider = await db.query.riders.findFirst({
    where: eq(riders.userId, Number(session.user.id)),
  });
  if (!rider) return { authorized: false as const };

  return { authorized: true as const, user: session.user, rider };
}

// 4. Admin Guard
export async function requireAdmin() {
  const session = await adminAuth.api.getSession({ headers: await headers() });
  if (!session || session.user.role !== "ADMIN") return { authorized: false as const };
  return { authorized: true as const, user: session.user };
}