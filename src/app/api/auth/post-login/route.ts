import { NextResponse } from "next/server";
import { eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { vendors } from "@/db/schema/vendors";
import { riders } from "@/db/schema/riders";
import { resolveSessionUser } from "@/lib/session";

/**
 * Post-Login Router & Identity Harmonizer
 * 
 * Called after Google Authentication (or any OAuth callback) to evaluate the user's
 * canonical identity, associated profiles (vendor/rider/customer), and entry intent,
 * routing them seamlessly to the right destination without breaking state.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const intent = (url.searchParams.get("intent") || "customer").toLowerCase().trim();

  // 1. Resolve session user
  const resolved = await resolveSessionUser(request);
  if (!resolved) {
    // If not authenticated yet, route back to app with notice
    return NextResponse.redirect(new URL("/app?auth_error=session_not_found", request.url));
  }

  const userId = resolved.userId;
  const userEmail = (resolved.user.email || "").toLowerCase().trim();
  const userName = resolved.user.name || "";

  // 2. Query vendor profile
  const vendorRows = await db
    .select()
    .from(vendors)
    .where(
      or(
        eq(vendors.userId, userId),
        userEmail ? sql`LOWER(${vendors.contactEmail}) = ${userEmail}` : sql`1 = 0`
      )
    )
    .limit(1);

  let vendor = vendorRows[0] || null;

  // Link vendor to canonical userId if found by email but missing userId
  if (vendor && !vendor.userId) {
    await db
      .update(vendors)
      .set({ userId, updatedAt: new Date() })
      .where(eq(vendors.id, vendor.id));
    vendor = { ...vendor, userId };
  }

  // 3. Query rider profile
  const riderRows = await db
    .select()
    .from(riders)
    .where(eq(riders.userId, userId))
    .limit(1);

  const rider = riderRows[0] || null;

  // 4. Intent-based routing
  if (intent === "vendor") {
    if (vendor) {
      const vStatus = (vendor.status || "approved").toLowerCase();
      if (vStatus === "approved") {
        // Upgrade role in users table if needed
        if (resolved.user.role !== "VENDOR" && resolved.user.role !== "ADMIN") {
          await db
            .update(users)
            .set({ role: "VENDOR", updatedAt: new Date() })
            .where(eq(users.id, userId));
        }
        return NextResponse.redirect(new URL("/vendor?auth=google_success", request.url));
      } else if (vStatus === "pending") {
        return NextResponse.redirect(new URL("/vendor?status=pending", request.url));
      } else {
        return NextResponse.redirect(new URL("/vendor?status=rejected", request.url));
      }
    }

    // New vendor applicant: guide through store creation with prefilled Google info
    const onboardUrl = new URL("/app", request.url);
    onboardUrl.searchParams.set("role", "vendor");
    onboardUrl.searchParams.set("action", "onboard");
    onboardUrl.searchParams.set("email", userEmail);
    if (userName) onboardUrl.searchParams.set("name", userName);
    return NextResponse.redirect(onboardUrl);
  }

  if (intent === "rider") {
    if (rider) {
      const rStatus = (rider.applicationStatus || rider.approvalStatus || "APPROVED").toUpperCase();
      if (rStatus === "APPROVED") {
        if (resolved.user.role !== "RIDER" && resolved.user.role !== "ADMIN") {
          await db
            .update(users)
            .set({ role: "RIDER", updatedAt: new Date() })
            .where(eq(users.id, userId));
        }
        return NextResponse.redirect(new URL("/rider", request.url));
      } else {
        return NextResponse.redirect(new URL("/rider/application-status", request.url));
      }
    }

    // New rider applicant: guide through vehicle & identity registration
    const registerUrl = new URL("/rider/register", request.url);
    registerUrl.searchParams.set("email", userEmail);
    if (userName) registerUrl.searchParams.set("name", userName);
    return NextResponse.redirect(registerUrl);
  }

  // Default: Customer intent (or any customer entry)
  // Preserves customer marketplace state, cart, and location
  const customerRedirect = new URL("/app", request.url);
  customerRedirect.searchParams.set("auth", "google_success");
  customerRedirect.searchParams.set("role", "customer");
  return NextResponse.redirect(customerRedirect);
}
