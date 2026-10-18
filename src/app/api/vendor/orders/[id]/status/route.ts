import { NextResponse } from "next/server";
import { POST as handleStatusPOST } from "../../status/route";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const resolvedParams = await Promise.resolve(context.params);
  const orderId = resolvedParams?.id;

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const mergedBody = { ...body, orderId: orderId || body.orderId };

  const syntheticRequest = new Request(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(mergedBody),
  });

  return handleStatusPOST(syntheticRequest);
}
