import { Redis } from "@upstash/redis";

/**
 * Whether Upstash Redis credentials are present in the environment.
 *
 * Redis backs Better Auth's secondary storage and rate limiting, but it is
 * not required for authentication to work. When the credentials are missing
 * (local development, CI) `redis` is null and callers must degrade gracefully
 * instead of throwing.
 */
export const isRedisConfigured = Boolean(
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

export const redis = isRedisConfigured
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL!,
        token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
    : null;
