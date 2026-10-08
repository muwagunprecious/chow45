import { NextResponse } from "next/server";
import { eq, desc, and, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { riders } from "@/db/schema/riders";
import { riderWallets, riderWalletTransactions, riderWithdrawals } from "@/db/schema/rider-finance";
import { requireAdmin } from "@/lib/session";

export async function GET(request: Request) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");

  const conditions = [];
  if (status && status !== "ALL") {
    conditions.push(eq(riderWithdrawals.status, status));
  }

  const withdrawalList = await db
    .select({
      id: riderWithdrawals.id,
      riderId: riderWithdrawals.riderId,
      riderName: riders.name,
      riderPhone: riders.phone,
      amount: riderWithdrawals.amount,
      fee: riderWithdrawals.fee,
      netAmount: riderWithdrawals.netAmount,
      currency: riderWithdrawals.currency,
      bankName: riderWithdrawals.bankName,
      accountNumber: riderWithdrawals.accountNumber,
      accountName: riderWithdrawals.accountName,
      status: riderWithdrawals.status,
      rejectionReason: riderWithdrawals.rejectionReason,
      reviewedAt: riderWithdrawals.reviewedAt,
      paidAt: riderWithdrawals.paidAt,
      payoutReference: riderWithdrawals.payoutReference,
      createdAt: riderWithdrawals.createdAt,
    })
    .from(riderWithdrawals)
    .innerJoin(riders, eq(riders.id, riderWithdrawals.riderId))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(riderWithdrawals.createdAt));

  return NextResponse.json({ withdrawals: withdrawalList });
}

export async function POST(request: Request) {
  const adminCheck = await requireAdmin(request);
  if (!adminCheck.ok) {
    return NextResponse.json({ error: adminCheck.error }, { status: adminCheck.status });
  }

  const body = await request.json().catch(() => ({}));
  const withdrawalId = String(body.withdrawalId ?? "").trim();
  const action = String(body.action ?? "").trim().toUpperCase(); // "APPROVE" | "MARK_PAID" | "REJECT"
  const reason = String(body.reason ?? "").trim();
  const reference = String(body.reference ?? `TXN-${nanoid(10).toUpperCase()}`).trim();

  if (!withdrawalId) {
    return NextResponse.json({ error: "withdrawalId is required" }, { status: 400 });
  }

  const withdrawalRows = await db
    .select()
    .from(riderWithdrawals)
    .where(eq(riderWithdrawals.id, withdrawalId))
    .limit(1);

  if (withdrawalRows.length === 0) {
    return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });
  }

  const withdrawal = withdrawalRows[0];

  if (withdrawal.status === "PAID") {
    return NextResponse.json({ error: "This withdrawal is already marked as PAID." }, { status: 400 });
  }
  if (withdrawal.status === "REJECTED") {
    return NextResponse.json({ error: "This withdrawal is already REJECTED." }, { status: 400 });
  }

  const now = new Date();
  const adminUserId = adminCheck.userId;

  if (action === "APPROVE" || action === "MARK_PAID") {
    // 1. Release processing hold from wallet
    await db
      .update(riderWallets)
      .set({
        processing: sql`GREATEST(0, ${riderWallets.processing} - ${withdrawal.amount})`,
        updatedAt: now,
      })
      .where(eq(riderWallets.riderId, withdrawal.riderId));

    // 2. Mark withdrawal as PAID
    const [updatedWdr] = await db
      .update(riderWithdrawals)
      .set({
        status: "PAID",
        paidAt: now,
        reviewedBy: adminUserId,
        reviewedAt: now,
        payoutReference: reference,
        updatedAt: now,
      })
      .where(eq(riderWithdrawals.id, withdrawalId))
      .returning();

    // 3. Insert or update completed transaction ledger
    await db.insert(riderWalletTransactions).values({
      id: `tx-paid-${nanoid(10)}`,
      riderId: withdrawal.riderId,
      type: "WITHDRAWAL_APPROVED",
      direction: "DEBIT",
      amount: withdrawal.amount,
      currency: "NGN",
      status: "COMPLETED",
      withdrawalId: withdrawal.id,
      description: `Disbursed ₦${withdrawal.amount.toLocaleString()} to ${withdrawal.bankName} (${withdrawal.accountNumber.slice(-4)}) - Ref: ${reference}`,
    });

    return NextResponse.json({
      success: true,
      message: `Withdrawal #${withdrawalId} marked as PAID. Reference: ${reference}`,
      withdrawal: updatedWdr,
    });
  } else if (action === "REJECT") {
    // Refund reserved funds back into rider's available balance
    await db
      .update(riderWallets)
      .set({
        available: sql`${riderWallets.available} + ${withdrawal.amount}`,
        processing: sql`GREATEST(0, ${riderWallets.processing} - ${withdrawal.amount})`,
        updatedAt: now,
      })
      .where(eq(riderWallets.riderId, withdrawal.riderId));

    // Mark withdrawal as REJECTED
    const [updatedWdr] = await db
      .update(riderWithdrawals)
      .set({
        status: "REJECTED",
        rejectionReason: reason || "Withdrawal rejected by administrator.",
        reviewedBy: adminUserId,
        reviewedAt: now,
        updatedAt: now,
      })
      .where(eq(riderWithdrawals.id, withdrawalId))
      .returning();

    // Ledger entry for refund
    await db.insert(riderWalletTransactions).values({
      id: `tx-refund-${nanoid(10)}`,
      riderId: withdrawal.riderId,
      type: "WITHDRAWAL_REJECTED",
      direction: "CREDIT",
      amount: withdrawal.amount,
      currency: "NGN",
      status: "COMPLETED",
      withdrawalId: withdrawal.id,
      description: `Refund ₦${withdrawal.amount.toLocaleString()} for rejected withdrawal. Reason: ${reason || "Admin rejected"}`,
    });

    return NextResponse.json({
      success: true,
      message: `Withdrawal #${withdrawalId} rejected. Funds returned to rider balance.`,
      withdrawal: updatedWdr,
    });
  } else {
    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  }
}
