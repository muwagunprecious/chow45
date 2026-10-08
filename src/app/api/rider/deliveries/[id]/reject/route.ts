import { NextResponse } from "next/server";
import { requireRider } from "@/lib/session";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireRider(request, true);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error, message: auth.message },
      { status: auth.status }
    );
  }

  const { id: orderId } = await params;

  return NextResponse.json({
    success: true,
    rejectedOrderId: orderId,
    message: "Offer declined.",
  });
}
