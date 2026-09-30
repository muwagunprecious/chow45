import { NextResponse } from "next/server";
import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema/users";
import { vendors } from "@/db/schema/vendors";
import { waitlist } from "@/db/schema/waitlist";

/**
 * Looks up an email address so the sign-in flow can decide whether to ask for a
 * password (account exists) or continue into registration (account is new), and
 * which role-specific sign-in endpoint to use afterwards.
 *
 * Response shape:
 *   { exists: false }                        -> new account, start onboarding
 *   { exists: true, role: "USER" }           -> sign in, land on /app
 *   { exists: true, role: "VENDOR" }         -> sign in, land on /vendor
 *
 * Checks `users` table, `vendors` table (contact_email), and vendor waitlist.
 */

// Simple in-memory throttle. Redis is optional in this project, so a per
// process counter is used instead; it resets whenever the server restarts.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const hits = new Map<string, { count: number; resetAt: number }>();

function rateLimited(key: string) {
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || now > entry.resetAt) {
        hits.set(key, { count: 1, resetAt: now + WINDOW_MS });
        return false;
    }

    entry.count += 1;
    return entry.count > MAX_PER_WINDOW;
}

export async function POST(request: Request) {
    const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown";

    if (rateLimited(ip)) {
        return NextResponse.json(
            { error: "Too many attempts. Please wait a minute and try again." },
            { status: 429 }
        );
    }

    let email: unknown;
    try {
        ({ email } = await request.json());
    } catch {
        return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    if (typeof email !== "string" || !email.includes("@") || !email.includes(".")) {
        return NextResponse.json(
            { error: "Please enter a valid email address." },
            { status: 400 }
        );
    }

    // Normalise email for matching
    const normalised = email.trim().toLowerCase();

    // 1. Check users table
    const userMatches = await db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(sql`LOWER(${users.email}) = ${normalised}`)
        .limit(1);

    // 2. Check vendors table by contact_email
    const vendorMatches = await db
        .select({ id: vendors.id, userId: vendors.userId, businessName: vendors.businessName })
        .from(vendors)
        .where(sql`LOWER(${vendors.contactEmail}) = ${normalised}`)
        .limit(1);

    let exists = false;
    let isVendor = false;

    if (userMatches.length > 0) {
        exists = true;
        const user = userMatches[0];
        if (user.role?.toUpperCase() === "VENDOR") {
            isVendor = true;
        } else {
            // Check if this user is linked to any vendor profile
            const linked = await db
                .select({ id: vendors.id })
                .from(vendors)
                .where(eq(vendors.userId, user.id))
                .limit(1);
            if (linked.length > 0) {
                isVendor = true;
            }
        }
    }

    if (vendorMatches.length > 0) {
        exists = true;
        isVendor = true;
    }

    // 3. Fallback: check vendor_applications
    if (!exists) {
        try {
            const appMatches = await db
                .select({ id: sql`id` })
                .from(sql`vendor_applications`)
                .where(sql`LOWER(owner_email) = ${normalised}`)
                .limit(1);
            if (appMatches.length > 0) {
                exists = true;
                isVendor = true;
            }
        } catch { /* table may not be queried */ }
    }

    // 4. Fallback: check waitlist
    if (!exists) {
        const waitlistMatches = await db
            .select({ id: waitlist.id, userType: waitlist.userType })
            .from(waitlist)
            .where(sql`LOWER(${waitlist.email}) = ${normalised}`)
            .limit(1);

        if (waitlistMatches.length > 0) {
            exists = true;
            const ut = (waitlistMatches[0].userType || "").toLowerCase();
            if (ut.includes("vendor") || ut.includes("restaurant") || ut.includes("food")) {
                isVendor = true;
            }
        }
    }

    if (!exists) {
        return NextResponse.json({ exists: false });
    }

    return NextResponse.json({
        exists: true,
        role: isVendor ? "VENDOR" : "USER",
    });
}

