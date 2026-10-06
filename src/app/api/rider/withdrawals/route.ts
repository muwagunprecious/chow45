import { NextResponse } from "next/server";
import { eq, desc, and, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { riderWallets, riderWalletTransactions, riderBankAccounts, riderWithdrawals } from "@/db/schema/rider-finance";
import { requireRider } from "@/lib/session";

export async function GET(request: Request) {
  const auth = await requireRider(request, true);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error, message: auth.message },
      { status: auth.status }
    );
  }

  const withdrawals = await db
    .select()
    .from(riderWithdrawals)
    .where(eq(riderWithdrawals.riderId, auth.rider.id))
    .orderBy(desc(riderWithdrawals.createdAt))
    .limit(50);

  return NextResponse.json({ withdrawals });
}

export async function POST(request: Request) {
  const auth = await requireRider(request, true);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error, message: auth.message },
      { status: auth.status }
    );
  }

  const { rider, wallet } = auth;
  const body = await request.json().catch(() => ({}));
  const amount = Number(body.amount);

  if (!Number.isFinite(amount) || amount < 1000) {
    return NextResponse.json(
      { error: "Minimum withdrawal amount is ₦1,000." },
      { status: 400 }
    );
  }

  if (amount > wallet.available) {
    return NextResponse.json(
      {
        error: `Insufficient available balance. Your available balance is ₦${wallet.available.toLocaleString()}.`,
      },
      { status: 400 }
    );
  }

  // Find target bank account
  let bankName = String(body.bankName ?? "").trim();
  let accountNumber = String(body.accountNumber ?? "").trim();
  let accountName = String(body.accountName ?? "").trim();

  if (!bankName || !accountNumber || !accountName) {
    const defaultBank = await db
      .select()
      .from(riderBankAccounts)
      .where(and(eq(riderBankAccounts.riderId, rider.id), eq(riderBankAccounts.isDefault, true)))
      .limit(1);

    if (defaultBank.length > 0) {
      bankName = defaultBank[0].bankName;
      accountNumber = defaultBank[0].accountNumber;
      accountName = defaultBank[0].accountName;
    }
  }

  if (!bankName || !accountNumber || !accountName) {
    return NextResponse.json(
      { error: "Please add a verified payout bank account first." },
      { status: 400 }
    );
  }

  const withdrawalId = `wdr-${nanoid(12)}`;
  const txId = `tx-${nanoid(12)}`;
  const fee = 0; // 0 fee for university campus riders
  const netAmount = amount - fee;

  // Atomically reserve funds from wallet
  const updateWalletResult = await db
    .update(riderWallets)
    .set({
      available: sql`${riderWallets.available} - ${amount}`,
      processing: sql`${riderWallets.processing} + ${amount}`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(riderWallets.riderId, rider.id),
        sql`${riderWallets.available} >= ${amount}`
      )
    )
    .returning();

  if (updateWalletResult.length === 0) {
    return NextResponse.json(
      { error: "Insufficient available balance or concurrent withdrawal." },
      { status: 409 }
    );
  }

  // Create withdrawal record
  const [createdWithdrawal] = await db
    .insert(riderWithdrawals)
    .values({
      id: withdrawalId,
      riderId: rider.id,
      amount,
      fee,
      netAmount,
      currency: "NGN",
      bankName,
      accountNumber,
      accountName,
      status: "PENDING_ADMIN_APPROVAL",
    })
    .returning();

  // Create ledger transaction
  await db.insert(riderWalletTransactions).values({
    id: txId,
    riderId: rider.id,
    type: "WITHDRAWAL_REQUESTED",
    direction: "DEBIT",
    amount,
    currency: "NGN",
    status: "PENDING",
    withdrawalId,
    description: `Withdrawal request of ₦${amount.toLocaleString()} to ${bankName} (${accountNumber.slice(-4)})`,
  });

  return NextResponse.json({
    success: true,
    message: `Withdrawal of ₦${amount.toLocaleString()} requested successfully and pending review.`,
    withdrawal: createdWithdrawal,
    wallet: {
      available: updateWalletResult[0].available,
      processing: updateWalletResult[0].processing,
    },
  });
}
