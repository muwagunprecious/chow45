import "server-only";

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware, APIError } from "better-auth/api";

import { db } from "./db";
import { nanoid, customAlphabet } from "nanoid";
import { redis } from "./lib/redis";

import {
    users,
    sessions,
    accounts,
    verification,
} from "./db/schema/users";

import { render } from "@react-email/render";
import { sendMail } from "./lib/mail";
import { VerificationEmail } from "./lib/mail/templates/verification";
import { ResetPasswordEmail } from "./lib/mail/templates/reset-password";

import { after } from "next/server";
import { and, eq, isNull, lte, or } from "drizzle-orm";

/**
 * Generates an 8-character referral code.
 *
 * Characters that can easily be confused are excluded:
 * - I
 * - O
 * - 0
 * - 1
 *
 * Example:
 * ABC7K2XP
 */
const refCodeGen = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 8);

/**
 * Generates a unique username from the user's email address.
 *
 * Example:
 * john.doe@gmail.com
 * becomes something like:
 * johndoe8xK2
 */
function generateUsernameFromEmail(email: string) {
    // Take everything before the @ symbol.
    const base = email
        .split("@")[0]

        // Remove spaces, dots, hyphens, etc.
        .replace(/[^a-zA-Z0-9]/g, "")

        // Store the username in lowercase.
        .toLowerCase();

    // Add a random 4-character suffix to reduce username collisions.
    return `${base}${nanoid().slice(0, 4)}`;
}

/**
 * Authentication roles supported by this authentication setup.
 *
 * USER:
 * Normal Tixkarios users.
 *
 * VENDOR:
 * Event organizers/vendors.
 */
type Role = "USER" | "VENDOR";

/**
 * Creates a Better Auth instance for a specific role.
 *
 * Instead of maintaining completely separate authentication
 * configurations for USER and VENDOR, both use this same function.
 *
 * The role passed here determines:
 * - API authentication path
 * - Account role
 * - Login error redirect
 * - Email verification redirect
 * - Password reset redirect
 */
function createAuth(role: Role) {
    return betterAuth({

        /**
         * Authentication API base path.
         *
         * USER:
         * /api/auth/user
         *
         * VENDOR:
         * /api/auth/vendor
         */
        basePath: `/api/auth/${role.toLowerCase()}`,

        /**
         * The public URL of the application.
         *
         * Used by Better Auth when generating URLs.
         */
        baseURL: process.env.NEXT_PUBLIC_APP_URL,

        /**
         * Secret used by Better Auth for signing/encrypting
         * authentication-related data.
         */
        secret: process.env.BASE_AUTH_SECRET,


        /**
         * Database hooks.
         *
         * These allow us to modify data before Better Auth
         * creates or updates database records.
         */
        databaseHooks: {
            user: {
                create: {

                    /**
                     * Runs immediately before a new user is created.
                     */
                    before: async (user) => ({
                        data: {
                            // Keep all default Better Auth user fields.
                            ...user,

                            // Generate a public ID that can be safely
                            // exposed outside the database.
                            publicId: nanoid(),

                            // Generate a unique referral code.
                            refCode: refCodeGen(),

                            // Assign the role based on the auth instance.
                            role,

                            /**
                             * Use an existing username if one was supplied.
                             * Otherwise generate one from the email address.
                             */
                            username:
                                user.username ??
                                generateUsernameFromEmail(user.email),
                        },
                    }),
                },
            },
        },


        /**
         * Better Auth hooks.
         *
         * This runs after authentication-related API operations.
         */
        hooks: {
            after: createAuthMiddleware(async (ctx) => {

                /**
                 * Get the newly created authentication session.
                 *
                 * If no new session was created, there is nothing
                 * to validate here.
                 */
                const newSession = ctx.context.newSession;

                if (!newSession) return;

                /**
                 * Make sure the authenticated account belongs
                 * to the authentication system being used.
                 *
                 * For example:
                 *
                 * /api/auth/vendor
                 * must only allow VENDOR accounts.
                 */
                if (newSession.user.role !== role) {
                    throw new APIError("FORBIDDEN", {
                        message: `This account is not registered as a ${role.toLowerCase()}`,
                    });
                }
            }),
        },


        /**
         * Better Auth normally generates database IDs.
         *
         * Setting this to false allows the database/schema
         * to handle ID generation instead.
         */
        advanced: {
            database: {
                generateId: false,
            },
        },


        /**
         * Connect Better Auth to the existing Drizzle database.
         */
        database: drizzleAdapter(db, {
            // PostgreSQL database.
            provider: "pg",

            // Use singular table names.
            usePlural: false,

            /**
             * Tell Better Auth which Drizzle tables represent
             * its authentication tables.
             */
            schema: {
                user: users,
                session: sessions,
                account: accounts,
                verification,
            },
        }),


        /**
         * Determines where Better Auth should redirect users
         * when an authentication API error occurs.
         *
         * Vendors go to:
         * /vendor/login
         *
         * Normal users go to:
         * /login
         */
        onAPIError: {
            errorURL: role === "VENDOR" ? "/vendor/login" : "/login",
        },


        /**
         * Redis is used as Better Auth's secondary storage.
         *
         * This is useful for:
         * - Rate limiting
         * - Temporary authentication data
         * - Other short-lived Better Auth storage
         */
        secondaryStorage: {

            /**
             * Get a value from Redis.
             */
            get: async (key) => {
                const value = await redis.get(key);

                // Redis doesn't have the value.
                if (value === null || value === undefined) {
                    return null;
                }

                // Ensure Better Auth always receives a string.
                return typeof value === "string"
                    ? value
                    : JSON.stringify(value);
            },


            /**
             * Get a value from Redis and immediately delete it.
             *
             * Useful for one-time values.
             */
            getAndDelete: async (key) => {
                const value = await redis.getdel(key);

                if (value === null || value === undefined) {
                    return null;
                }

                return typeof value === "string"
                    ? value
                    : JSON.stringify(value);
            },


            /**
             * Increment a Redis counter.
             *
             * Used by Better Auth's rate limiting.
             *
             * The first request sets the expiration time.
             */
            increment: async (key, ttl) => {
                const result = await redis.eval(
                    `
                    local count = redis.call("INCR", KEYS[1])

                    if count == 1 and tonumber(ARGV[1]) > 0 then
                        redis.call("EXPIRE", KEYS[1], ARGV[1])
                    end

                    return count
                    `,
                    [key],
                    [ttl]
                );

                return Number(result);
            },


            /**
             * Store a value in Redis.
             *
             * If a TTL is provided, Redis automatically deletes
             * the value after that amount of time.
             */
            set: async (key, value, ttl) => {
                if (ttl) {
                    await redis.set(key, value, { ex: ttl });
                } else {
                    await redis.set(key, value);
                }
            },


            /**
             * Delete a value from Redis.
             */
            delete: async (key) => {
                await redis.del(key);
            },
        },


        /**
         * Authentication rate limiting.
         *
         * Redis is used as the storage provider.
         */
        rateLimit: {
            enabled: true,
            storage: "secondary-storage",

            /**
             * Custom limits for sensitive authentication endpoints.
             *
             * window = number of seconds
             * max = maximum requests allowed during that window
             */
            customRules: {

                // Maximum 5 sign-in attempts per minute.
                "/sign-in/email": {
                    window: 60,
                    max: 5,
                },

                // Maximum 5 sign-up attempts per minute.
                "/sign-up/email": {
                    window: 60,
                    max: 5,
                },

                // Maximum 3 password reset requests per minute.
                "/forget-password": {
                    window: 60,
                    max: 3,
                },

                // Maximum 1 verification email every 30 seconds.
                "/send-verification-email": {
                    window: 30,
                    max: 1,
                },
            },
        },


        /**
         * Allows authentication accounts to be linked.
         *
         * For example, an existing email account can potentially
         * be linked with a Google account belonging to the same user.
         */
        account: {
            accountLinking: {
                enabled: true,
            },
        },


        /**
         * Email + password authentication configuration.
         */
        emailAndPassword: {

            // Enable email/password authentication.
            enabled: true,

            // Users must verify their email address.
            requireEmailVerification: true,

            // Password reset invalidates existing sessions.
            revokeSessionsOnPasswordReset: true,


            /**
             * Sends the password reset email.
             */
            sendResetPassword: async ({ user, url }) => {

                /**
                 * Schedule the email to run after the current
                 * Next.js request finishes.
                 *
                 * This prevents the email operation from unnecessarily
                 * blocking the authentication response.
                 */
                after(async () => {
                    try {

                        /**
                         * Build the frontend password reset URL.
                         *
                         * Vendors use:
                         * /vendor/reset-password
                         *
                         * Users use:
                         * /reset-password
                         */
                        const resetUrl = new URL(
                            role === "VENDOR"
                                ? "/vendor/reset-password"
                                : "/reset-password",
                            process.env.NEXT_PUBLIC_APP_URL
                        );

                        /**
                         * Extract Better Auth's reset token
                         * and add it to our frontend URL.
                         */
                        resetUrl.searchParams.set(
                            "token",
                            new URL(url).searchParams.get("token")!
                        );


                        /**
                         * Render the React Email template as HTML.
                         */
                        const html = await render(
                            ResetPasswordEmail({
                                name: user.name,
                                url: resetUrl.toString(),
                            })
                        );


                        /**
                         * Render the same email as plain text.
                         *
                         * This provides a fallback for email clients
                         * that don't render HTML.
                         */
                        const text = await render(
                            ResetPasswordEmail({
                                name: user.name,
                                url: resetUrl.toString(),
                            }),
                            { plainText: true }
                        );


                        /**
                         * Send the email through the application's
                         * configured mail provider.
                         */
                        await sendMail({
                            to: user.email,
                            template: {
                                subject: "Reset your Tixkarios password",
                                html,
                                text,
                            },
                        });

                    } catch (error) {
                        // Log the error without breaking the request.
                        console.error(
                            "password reset email send failed",
                            error
                        );
                    }
                });
            },
        },


        /**
         * Email verification configuration.
         */
        emailVerification: {

            // Automatically send verification email after signup.
            sendOnSignUp: true,

            // Automatically send verification email during sign-in
            // when the account still needs verification.
            sendOnSignIn: true,

            // Verification links expire after 1 hour.
            expiresIn: 60 * 60,


            /**
             * Sends the email verification message.
             */
            sendVerificationEmail: async ({ user, url }) => {

                const now = new Date();

                /**
                 * Calculate the earliest time another verification
                 * email can be sent.
                 *
                 * This creates a 30-second cooldown.
                 */
                const cooldownTime = new Date(
                    now.getTime() - 30 * 1000
                );


                /**
                 * Atomically update verificationEmailSentAt.
                 *
                 * The update only happens when:
                 * - The user has never received a verification email, OR
                 * - The previous email was sent at least 30 seconds ago.
                 *
                 * This prevents rapid repeated verification emails.
                 */
                const updatedUser = await db
                    .update(users)
                    .set({
                        verificationEmailSentAt: now,
                    })
                    .where(
                        and(
                            eq(users.id, Number(user.id)),
                            or(
                                isNull(users.verificationEmailSentAt),
                                lte(
                                    users.verificationEmailSentAt,
                                    cooldownTime
                                )
                            )
                        )
                    )
                    .returning({
                        id: users.id,
                    });


                /**
                 * If nothing was updated, the cooldown is still active.
                 *
                 * Stop here and don't send another email.
                 */
                if (updatedUser.length === 0) {
                    return;
                }


                /**
                 * Send the email after the current request finishes.
                 */
                after(async () => {
                    try {

                        /**
                         * Build the frontend verification URL.
                         *
                         * Vendors:
                         * /vendor/verify-email
                         *
                         * Users:
                         * /verify-email
                         */
                        const verificationUrl = new URL(
                            role === "VENDOR"
                                ? "/vendor/verify-email"
                                : "/verify-email",
                            process.env.NEXT_PUBLIC_APP_URL
                        );


                        /**
                         * Get the verification token generated
                         * by Better Auth.
                         */
                        verificationUrl.searchParams.set(
                            "token",
                            new URL(url).searchParams.get("token")!
                        );


                        /**
                         * Render the verification email as HTML.
                         */
                        const html = await render(
                            VerificationEmail({
                                url: verificationUrl.toString(),
                            })
                        );


                        /**
                         * Render the verification email as plain text.
                         */
                        const text = await render(
                            VerificationEmail({
                                url: verificationUrl.toString(),
                            }),
                            {
                                plainText: true,
                            }
                        );


                        /**
                         * Send the verification email.
                         */
                        await sendMail({
                            to: user.email,
                            template: {
                                subject: "Verify your Tixkarios account",
                                html,
                                text,
                            },
                        });

                    } catch (sendErr) {
                        // Log email delivery errors.
                        console.error(
                            "verification email send failed",
                            sendErr
                        );
                    }
                });
            },
        },


        /**
         * Google OAuth configuration.
         */
        socialProviders: {
            google: {

                // Google OAuth client credentials.
                clientId: process.env.GOOGLE_CLIENT_ID!,
                clientSecret: process.env.GOOGLE_CLIENT_SECRET!,

                /**
                 * Google accounts must also have a verified email.
                 */
                requireEmailVerification: true,


                /**
                 * Controls which Google profile fields are mapped
                 * into the Better Auth user record.
                 */
                mapProfileToUser: (profile) => {
                    return {
                        name: profile.name || "User",
                    };
                },
            },
        },


        /**
         * Additional fields added to the Better Auth user model.
         *
         * These fields correspond to columns in the users table.
         */
        user: {
            additionalFields: {

                /**
                 * Public identifier for the user.
                 */
                publicId: {
                    type: "string",
                    required: false,
                },

                /**
                 * Unique referral code belonging to the user.
                 */
                refCode: {
                    type: "string",
                    required: false,
                },

                /**
                 * ID of the user who referred this user.
                 */
                referredBy: {
                    type: "number",
                    required: false,
                },

                /**
                 * Unique username.
                 */
                username: {
                    type: "string",
                    required: false,
                },

                /**
                 * User's phone number.
                 */
                phone: {
                    type: "string",
                    required: false,
                },

                /**
                 * Whether the user's phone number has been verified.
                 */
                phoneVerified: {
                    type: "boolean",
                    required: false,
                    defaultValue: false,
                },

                /**
                 * Stores when the most recent verification email
                 * was sent.
                 */
                verificationEmailSentAt: {
                    type: "date",
                    required: false,
                },

                /**
                 * User role.
                 *
                 * input: false means users cannot submit/change
                 * their role through Better Auth's normal input.
                 */
                role: {
                    type: "string",
                    required: false,
                    defaultValue: "USER",
                    input: false,
                },
            },
        },


        /**
         * Session configuration.
         */
        session: {

            /**
             * Sessions remain valid for 30 days.
             */
            expiresIn: 60 * 60 * 24 * 30,

            /**
             * Refresh/update the session once every 24 hours
             * when the user is active.
             */
            updateAge: 60 * 60 * 24,
        },
    });
}


/**
 * USER authentication instance.
 *
 * Uses:
 * /api/auth/user
 *
 * Only accounts with role = USER are allowed through this instance.
 */
export const userAuth = createAuth("USER");


/**
 * VENDOR authentication instance.
 *
 * Uses:
 * /api/auth/vendor
 *
 * Only accounts with role = VENDOR are allowed through this instance.
 */
export const vendorAuth = createAuth("VENDOR");