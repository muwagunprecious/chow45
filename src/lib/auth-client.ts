import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
    baseURL: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/user`,
});

export const vendorAuthClient = createAuthClient({
    baseURL: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/vendor`,
});