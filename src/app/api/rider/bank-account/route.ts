import { NextResponse } from "next/server";
import { eq, desc } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { riderBankAccounts } from "@/db/schema/rider-finance";
import { requireRider } from "@/lib/session";

export async function GET(request: Request) {
  const auth = await requireRider(request, true);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error, message: auth.message },
      { status: auth.status }
    );
  }

  const accounts = await db
    .select()
    .from(riderBankAccounts)
    .where(eq(riderBankAccounts.riderId, auth.rider.id))
    .orderBy(desc(riderBankAccounts.createdAt));

  return NextResponse.json({
    bankAccounts: accounts.map((b) => ({
      id: b.id,
      bankName: b.bankName,
      bankCode: b.bankCode,
      accountName: b.accountName,
      accountNumber: b.accountNumber ? `••••${b.accountNumber.slice(-4)}` : "",
      fullAccountNumber: b.accountNumber,
      isDefault: b.isDefault,
    })),
  });
}

export async function POST(request: Request) {
  const auth = await requireRider(request, true);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error, message: auth.message },
      { status: auth.status }
    );
  }

  const { rider } = auth;
  const body = await request.json().catch(() => ({}));
  const bankName = String(body.bankName ?? "").trim();
  const bankCode = String(body.bankCode ?? "").trim();
  const accountNumber = String(body.accountNumber ?? "").trim();
  const accountName = String(body.accountName ?? "").trim();

  if (!bankName || !accountNumber || !accountName) {
    return NextResponse.json(
      { error: "Bank name, account number, and account name are required." },
      { status: 400 }
    );
  }

  if (accountNumber.length < 10) {
    return NextResponse.json(
      { error: "Please enter a valid 10-digit Nigerian NUBAN account number." },
      { status: 400 }
    );
  }

  // Set previous accounts to non-default
  await db
    .update(riderBankAccounts)
    .set({ isDefault: false })
    .where(eq(riderBankAccounts.riderId, rider.id));

  // Insert or update
  const newAccount = {
    id: `bank-${nanoid(10)}`,
    riderId: rider.id,
    bankName,
    bankCode: bankCode || null,
    accountNumber,
    accountName,
    isDefault: true,
  };

  const [created] = await db
    .insert(riderBankAccounts)
    .values(newAccount)
    .returning();

  return NextResponse.json({
    success: true,
    message: "Bank account saved successfully.",
    bankAccount: {
      id: created.id,
      bankName: created.bankName,
      accountName: created.accountName,
      accountNumber: `••••${created.accountNumber.slice(-4)}`,
      fullAccountNumber: created.accountNumber,
      isDefault: created.isDefault,
    },
  });
}
