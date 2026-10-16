import { auth } from "@/auth";
import { toNextJsHandler } from "better-auth/next-js";
import { NextResponse } from "next/server";

const authHandler = toNextJsHandler(auth.handler);

function normalizeRequest(request: Request): Request {
    const url = new URL(request.url);
    if (url.pathname.includes("/api/auth/rider")) {
        const newUrl = new URL(request.url);
        newUrl.pathname = url.pathname.replace("/api/auth/rider", "/api/auth");
        return new Request(newUrl.toString(), request);
    }
    return request;
}

export async function GET(request: Request) {
    return authHandler.GET(normalizeRequest(request));
}

export async function POST(request: Request) {
    const normReq = normalizeRequest(request);
    const url = new URL(normReq.url);
    if (url.pathname.endsWith("/sign-in/email")) {
        const res = await authHandler.POST(normReq);
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

    return authHandler.POST(normReq);
}

