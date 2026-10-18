import { NextResponse } from "next/server";
import { eq, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema/users";
import { vendors } from "@/db/schema/vendors";
import { riders } from "@/db/schema/riders";

/**
 * Looks up an email address so the sign-in flow can decide whether to ask for a
 * password (account exists) or continue into registration (account is new), and
 * which role-specific sign-in endpoint to use afterwards.
 *
 * Response shape:
 *   { exists: false }                        -> new account, start onboarding / registration
 *   { exists: true, role: "USER" }           -> existing user account, ask for password
 *   { exists: true, role: "VENDOR" }         -> existing vendor account, ask for password
 *   { exists: true, role: "RIDER" }          -> existing rider account, ask for password
 */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
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

    const normalised = email.trim().toLowerCase();

    // 1. Check users table
    const userMatches = await db
        .select({ id: users.id, role: users.role, name: users.name })
        .from(users)
        .where(sql`LOWER(${users.email}) = ${normalised}`)
        .limit(1);

    if (userMatches.length === 0) {
        // Check if vendors table has a record with contactEmail that is linked to a user
        const vendorMatches = await db
            .select({ id: vendors.id, userId: vendors.userId })
            .from(vendors)
            .where(sql`LOWER(${vendors.contactEmail}) = ${normalised}`)
            .limit(1);

        if (vendorMatches.length > 0 && vendorMatches[0].userId) {
            return NextResponse.json({
                exists: true,
                role: "VENDOR",
            });
        }

        return NextResponse.json({ exists: false });
    }

    const user = userMatches[0];
    const isAdmin = String(user.role || "").toUpperCase() === "ADMIN";

    // 2. Check vendor profile: Must have actual vendor row
    const vendorMatches = await db
        .select({ id: vendors.id })
        .from(vendors)
        .where(
            or(
                eq(vendors.userId, user.id),
                sql`LOWER(${vendors.contactEmail}) = ${normalised}`
            )
        )
        .limit(1);

    const isVendor = vendorMatches.length > 0;

    // 3. Check rider profile: Must have actual rider row
    const riderMatches = await db
        .select({ id: riders.id })
        .from(riders)
        .where(eq(riders.userId, user.id))
        .limit(1);

    const isRider = riderMatches.length > 0 || String(user.role || "").toUpperCase() === "RIDER";

    // 4. Resolve accurate canonical role
    let canonicalRole = "USER";
    if (isAdmin) {
        canonicalRole = "ADMIN";
    } else if (isVendor) {
        canonicalRole = "VENDOR";
    } else if (isRider) {
        canonicalRole = "RIDER";
    }

    // 5. Self-heal database user.role if mismatched
    if (String(user.role || "").toUpperCase() !== canonicalRole) {
        try {
            await db
                .update(users)
                .set({ role: canonicalRole, updatedAt: new Date() })
                .where(eq(users.id, user.id));
        } catch (e) {
            console.warn("[check-email] Failed to sync user role in db:", e);
        }
    }

    return NextResponse.json({
        exists: true,
        role: canonicalRole,
        name: user.name,
    });
}
