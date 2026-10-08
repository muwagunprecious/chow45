import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { riderWalletTransactions, riderBankAccounts, riderWithdrawals } from "@/db/schema/rider-finance";
import { requireRider } from "@/lib/session";

export async function GET(request: Request) {
  const auth = await requireRider(request, true);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error, message: auth.message },
      { status: auth.status }
    );
  }

  const { rider, wallet } = auth;

  // 1. Fetch transactions
  const transactions = await db
    .select()
    .from(riderWalletTransactions)
    .where(eq(riderWalletTransactions.riderId, rider.id))
    .orderBy(desc(riderWalletTransactions.createdAt))
    .limit(50);

  // 2. Fetch saved bank accounts
  const bankAccounts = await db
    .select()
    .from(riderBankAccounts)
    .where(eq(riderBankAccounts.riderId, rider.id))
    .orderBy(desc(riderBankAccounts.createdAt));

  // 3. Fetch recent withdrawals
  const withdrawals = await db
    .select()
    .from(riderWithdrawals)
    .where(eq(riderWithdrawals.riderId, rider.id))
    .orderBy(desc(riderWithdrawals.createdAt))
    .limit(20);

  return NextResponse.json({
    wallet: {
      available: wallet.available,
      processing: wallet.processing,
      totalEarned: wallet.totalEarned,
      currency: wallet.currency,
    },
    transactions,
    bankAccounts: bankAccounts.map((b) => ({
      id: b.id,
      bankName: b.bankName,
      bankCode: b.bankCode,
      accountName: b.accountName,
      accountNumber: b.accountNumber ? `••••${b.accountNumber.slice(-4)}` : "",
      fullAccountNumber: b.accountNumber,
      isDefault: b.isDefault,
    })),
    withdrawals,
  });
}
