import { createAuthClient } from "better-auth/react";

function getAuthBaseUrl(subpath: string): string {
    const envUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : "") ||
        (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
        (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");

    if (envUrl) {
        return `${envUrl.replace(/\/+$/, "")}${subpath}`;
    }

    if (typeof window !== "undefined" && window.location?.origin) {
        return `${window.location.origin}${subpath}`;
    }

    return `http://localhost:3000${subpath}`;
}

export const authClient = createAuthClient({
    baseURL: getAuthBaseUrl("/api/auth/user"),
});

export const vendorAuthClient = createAuthClient({
    baseURL: getAuthBaseUrl("/api/auth/vendor"),
});

export const riderAuthClient = createAuthClient({
    baseURL: getAuthBaseUrl("/api/auth/rider"),
});