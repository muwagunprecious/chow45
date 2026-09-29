import { vendorAuth } from "@/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { db } from "@/db";
import { users } from "@/db/schema/users";
import { vendors } from "@/db/schema/vendors";
import { eq, sql } from "drizzle-orm";

const authHandler = toNextJsHandler(vendorAuth.handler);

export const GET = authHandler.GET;

export async function POST(request: Request) {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/sign-in/email")) {
        try {
            const clone = request.clone();
            const body = await clone.json().catch(() => null);

            if (body?.email && typeof body.email === "string" && body?.password) {
                const normalised = body.email.trim().toLowerCase();

                // Check if user already exists in users table
                const userExists = await db
                    .select({ id: users.id })
                    .from(users)
                    .where(sql`LOWER(${users.email}) = ${normalised}`)
                    .limit(1);

                if (userExists.length === 0) {
                    // Check if this email belongs to a vendor in vendors table
                    const vendorMatch = await db
                        .select()
                        .from(vendors)
                        .where(sql`LOWER(${vendors.contactEmail}) = ${normalised}`)
                        .limit(1);

                    if (vendorMatch.length > 0) {
                        const vnd = vendorMatch[0];
                        try {
                            const signUpRes = await vendorAuth.api.signUpEmail({
                                body: {
                                    email: normalised,
                                    password: String(body.password),
                                    name: vnd.businessName || vnd.ownerName || normalised.split("@")[0],
                                },
                            });

                            if (signUpRes?.user?.id) {
                                const newUserId = Number(signUpRes.user.id);
                                // Ensure user has role VENDOR and verified email
                                await db
                                    .update(users)
                                    .set({ emailVerified: true, role: "VENDOR" })
                                    .where(eq(users.id, newUserId));

                                // Link vendor profile to this user
                                await db
                                    .update(vendors)
                                    .set({ userId: newUserId, status: "approved" })
                                    .where(eq(vendors.id, vnd.id));
                            }
                        } catch (err) {
                            console.warn("[vendorAuth] Auto-provision vendor user attempt:", err);
                        }
                    }
                }
            }
        } catch (e) {
            console.warn("[vendorAuth] Sign-in interception error:", e);
        }
    }

    return authHandler.POST(request);
}