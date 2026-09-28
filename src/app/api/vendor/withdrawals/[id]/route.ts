import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { vendorWallets, vendorWithdrawals } from "@/db";
import { currentRole } from "@/lib/session";
import { serializeWithdrawal } from "@/lib/serializers";

/**
 * Admin payout decision.
 *
 *   PATCH /api/vendor/withdrawals/:id   { status: "paid" | "rejected" }
 *
 * The wallet is adjusted here, not by the vendor: on `paid` the reserved money
 * leaves `processing` for good, and on `rejected` it goes back to `available`
 * so the vendor can withdraw it again. Both moves happen in one transaction.
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/vendor/withdrawals/[id]">) {
  const role = await currentRole(request);
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const { id } = await ctx.params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const nextStatus = String(body.status ?? "");
  if (nextStatus !== "paid" && nextStatus !== "rejected") {
    return NextResponse.json(
      { error: `Status must be "paid" or "rejected".` },
      { status: 400 },
    );
  }

  try {
    const found = await db
      .select()
      .from(vendorWithdrawals)
      .where(eq(vendorWithdrawals.id, String(id)))
      .limit(1);
    const withdrawal = found[0];
    if (!withdrawal) {
      return NextResponse.json({ error: "Withdrawal not found." }, { status: 404 });
    }

    if (withdrawal.status !== "processing") {
      return NextResponse.json(
        { error: `This withdrawal was already marked ${withdrawal.status}.` },
        { status: 409 },
      );
    }

    const result = await db.transaction(async (tx) => {
      // The wallet must always exist; a vendor whose wallet row vanished has a
      // bigger problem than this payout, so fail loudly instead of resurrecting.
      const walletRows = await tx
        .select()
        .from(vendorWallets)
        .where(eq(vendorWallets.vendorId, withdrawal.vendorId))
        .limit(1);
      const wallet = walletRows[0];
      if (!wallet) {
        return { error: "Vendor wallet missing for this payout." };
      }

      const [updated] = await tx
        .update(vendorWithdrawals)
        .set({
          status: nextStatus,
          paidOutAt: nextStatus === "paid" ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(vendorWithdrawals.id, withdrawal.id))
        .returning();

      if (nextStatus === "paid") {
        await tx
          .update(vendorWallets)
          .set({
            processing: sql`${vendorWallets.processing} - ${withdrawal.amount}`,
            updatedAt: new Date(),
          })
          .where(eq(vendorWallets.vendorId, withdrawal.vendorId));
      } else {
        // Money returns to the drawable balance on a rejection.
        await tx
          .update(vendorWallets)
          .set({
            processing: sql`${vendorWallets.processing} - ${withdrawal.amount}`,
            available: sql`${vendorWallets.available} + ${withdrawal.amount}`,
            updatedAt: new Date(),
          })
          .where(eq(vendorWallets.vendorId, withdrawal.vendorId));
      }

      return { withdrawal: updated };
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 409 });
    }

    return NextResponse.json({ withdrawal: serializeWithdrawal(result.withdrawal!) });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}