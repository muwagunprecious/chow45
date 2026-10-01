import { vendorAuth } from "@/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";

const authHandler = toNextJsHandler(vendorAuth.handler);

export const GET = authHandler.GET;

export async function POST(request: Request) {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/sign-in/email")) {
        const res = await authHandler.POST(request);
        if (!res.ok) {
            return NextResponse.json(
                {
                    success: false,
                    error: "INVALID_CREDENTIALS",
                    message: "Incorrect password. Please try again.",
                },
                { status: 401 }
            );
        }
        return res;
    }

    return authHandler.POST(request);
}