import { auth } from "@/auth";
import { toNextJsHandler } from "better-auth/next-js";

const rawHandler = toNextJsHandler(auth.handler);

function normalizeRequest(request: Request): Request {
  const url = new URL(request.url);
  if (url.pathname.startsWith("/api/auth/user/")) {
    const newUrl = new URL(request.url);
    newUrl.pathname = url.pathname.replace("/api/auth/user/", "/api/auth/");
    return new Request(newUrl.toString(), request);
  }
  return request;
}

export async function GET(request: Request) {
  return rawHandler.GET(normalizeRequest(request));
}

export async function POST(request: Request) {
  return rawHandler.POST(normalizeRequest(request));
}