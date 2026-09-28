import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { users } from "@/db/schema/users";

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
 * Note: this endpoint reveals whether an email is registered. That is required
 * by the "enter email, then password" UX. The rate limit below keeps it from
 * being used to bulk-enumerate accounts.
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

    // Emails are stored lowercased by Better Auth, so normalise before matching.
    const normalised = email.trim().toLowerCase();

    const found = await db
        .select({ id: users.id, role: users.role })
        .from(users)
        .where(eq(users.email, normalised))
        .limit(1);

    const match = found[0];

    if (!match) {
        return NextResponse.json({ exists: false });
    }

    return NextResponse.json({
        exists: true,
        role: match.role === "VENDOR" ? "VENDOR" : "USER",
    });
}
