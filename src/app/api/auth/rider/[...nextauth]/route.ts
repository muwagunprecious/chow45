import { riderAuth } from "@/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";

const authHandler = toNextJsHandler(riderAuth.handler);

export const GET = authHandler.GET;

export async function POST(request: Request) {
    const url = new URL(request.url);
    if (url.pathname.endsWith("/sign-in/email")) {
        const res = await authHandler.POST(request);
        if (!res.ok) {
            let errData: any = {};
            try {
                errData = await res.clone().json();
            } catch {
                errData = { message: await res.clone().text().catch(() => "Sign in failed.") };
            }
            return NextResponse.json(
                {
                    success: false,
                    error: errData.code || "INVALID_CREDENTIALS",
                    message: errData.message || "Incorrect email or password. Please try again.",
                },
                { status: res.status || 401 }
            );
        }
        return res;
    }

    return authHandler.POST(request);
}
