import { NextResponse } from "next/server";
import { db } from "@/db";
import { sessions } from "@/db/schema/users";
import { eq, or } from "drizzle-orm";
import { auth } from "@/auth";

function extractTokens(request: Request): string[] {
  const tokens: string[] = [];
  const authHeader = request.headers.get("authorization");
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    const raw = authHeader.slice(7).trim();
    if (raw) tokens.push(raw.split(".")[0]);
  }

  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    const parts = cookieHeader.split(";");
    for (const part of parts) {
      const [name, ...valParts] = part.trim().split("=");
      const cookieName = name.trim();
      const val = valParts.join("=").trim();
      if (!val) continue;

      if (
        cookieName === "better-auth.session_token" ||
        cookieName === "__Secure-better-auth.session_token" ||
        cookieName === "better_auth_session" ||
        cookieName.endsWith(".session_token")
      ) {
        const decoded = decodeURIComponent(val);
        tokens.push(decoded.split(".")[0]);
      }
    }
  }

  return tokens;
}

const COOKIES_TO_CLEAR = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
  "better-auth.session_data",
  "better-auth.dont_remember",
  "better_auth_session",
  "chow45_session",
];

async function handleSignOut(request: Request) {
  try {
    const tokens = extractTokens(request);
    for (const token of tokens) {
      if (token) {
        await db.delete(sessions).where(eq(sessions.token, token)).catch(() => {});
      }
    }

    // Call Better Auth sign-out if available
    try {
      await auth.api.signOut({ headers: request.headers });
    } catch {}

    const response = NextResponse.json({
      success: true,
      message: "Signed out successfully",
    });

    // Clear all session cookies across paths
    for (const cookieName of COOKIES_TO_CLEAR) {
      response.cookies.set(cookieName, "", {
        path: "/",
        expires: new Date(0),
        maxAge: 0,
        httpOnly: true,
        sameSite: "lax",
      });
      response.cookies.set(cookieName, "", {
        path: "/app",
        expires: new Date(0),
        maxAge: 0,
        httpOnly: true,
        sameSite: "lax",
      });
      response.cookies.set(cookieName, "", {
        path: "/vendor",
        expires: new Date(0),
        maxAge: 0,
        httpOnly: true,
        sameSite: "lax",
      });
    }

    return response;
  } catch (error: any) {
    console.error("[sign-out] error:", error);
    const response = NextResponse.json(
      { success: true, message: "Signed out" },
      { status: 200 }
    );
    for (const cookieName of COOKIES_TO_CLEAR) {
      response.cookies.set(cookieName, "", {
        path: "/",
        expires: new Date(0),
        maxAge: 0,
      });
    }
    return response;
  }
}

export async function POST(request: Request) {
  return handleSignOut(request);
}

export async function GET(request: Request) {
  return handleSignOut(request);
}
