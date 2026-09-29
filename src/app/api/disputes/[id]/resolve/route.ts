import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { disputes } from "@/db";
import { currentRole, currentUserId } from "@/lib/session";
import { optionalText } from "@/lib/validation";
import { serializeDispute } from "@/lib/serializers";

/**
 * Closes a dispute.
 *
 *   POST /api/disputes/:id/resolve   { resolution? }
 *
 * Only an admin may resolve a dispute, because resolving is what makes money
 * move. In the old client the customer could hit the same button on their own
 * copy of the state and "issue themselves a refund".
 */
export async function POST(request: Request, ctx: RouteContext<"/api/disputes/[id]/resolve">) {
  const role = await currentRole(request);
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const { id } = await ctx.params;
  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    // Body is optional; a blank resolution is acceptable for a "just refund" close.
  }

  try {
    const found = await db.select().from(disputes).where(eq(disputes.id, String(id))).limit(1);
    const dispute = found[0];
    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found." }, { status: 404 });
    }

    if (dispute.status !== "open") {
      return NextResponse.json({ error: "This dispute is already resolved." }, { status: 409 });
    }

    const adminId = await currentUserId(request);

    const [updated] = await db
      .update(disputes)
      .set({
        status: "resolved",
        resolution: optionalText(body.resolution, 1000) ?? "Refund issued to customer wallet.",
        resolvedBy: adminId,
        resolvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(disputes.id, dispute.id))
      .returning();

    return NextResponse.json({ dispute: serializeDispute(updated) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}