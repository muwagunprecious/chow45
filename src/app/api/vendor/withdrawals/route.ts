import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { vendors, vendorWallets, vendorWithdrawals } from "@/db";
import { currentRole, currentVendorUserId } from "@/lib/session";
import { optionalText } from "@/lib/validation";
import { serializeWallet, serializeWithdrawal } from "@/lib/serializers";

/**
 * Vendor payouts.
 *
 *   POST /api/vendor/withdrawals   -> vendor requests a payout
 *   GET  /api/vendor/withdrawals   -> the vendor's own requests and balance
 *
 * The old client moved money between `wallet.available` and `wallet.processing`
 * inside localStorage, so a refresh could undo a request. The transfer now
 * happens in a transaction: the wallet and the new withdrawal row move together
 * or not at all.
 */
export async function POST(request: Request) {
  const userId = await currentVendorUserId(request);
  if (userId === null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const amount = Math.round(Number(body.amount));
  if (!Number.isFinite(amount) || amount < 500) {
    return NextResponse.json({ error: "Minimum withdrawal is ₦500." }, { status: 400 });
  }

  const bankName = optionalText(body.bankName, 120);
  const accountNumber = optionalText(body.accountNumber, 20);
  if (!bankName || !accountNumber) {
    return NextResponse.json(
      { error: "Bank name and account number are required." },
      { status: 400 },
    );
  }

  try {
    const found = await db.select().from(vendors).where(eq(vendors.userId, userId)).limit(1);
    const vendor = found[0];
    if (!vendor) {
      return NextResponse.json({ error: "No store found for this account." }, { status: 404 });
    }

    // Reserve the money in the same transaction that records the request, so a
    // crash between the two cannot leave a request that spends money twice.
    const result = await db.transaction(async (tx) => {
      const walletRows = await tx
        .select()
        .from(vendorWallets)
        .where(eq(vendorWallets.vendorId, vendor.id))
        .limit(1);
      const wallet = walletRows[0];

      if (!wallet || wallet.available < amount) {
        return { error: "You do not have enough balance for this withdrawal." };
      }

      const [withdrawal] = await tx
        .insert(vendorWithdrawals)
        .values({
          id: `wd-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          vendorId: vendor.id,
          amount,
          bankName,
          accountNumber,
          status: "processing",
          // Payouts settle on the next business day, matching the old client's
          // promise without making up a date on the admin's behalf.
          expectedPayDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        })
        .returning();

      await tx
        .update(vendorWallets)
        .set({
          available: wallet.available - amount,
          processing: wallet.processing + amount,
          updatedAt: new Date(),
        })
        .where(eq(vendorWallets.vendorId, vendor.id));

      return { withdrawal };
    });

    if ("error" in result) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({ withdrawal: serializeWithdrawal(result.withdrawal!) }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const role = await currentRole(request);
  const isAdmin = role === "ADMIN";

  const userId = await currentVendorUserId(request);
  if (userId === null && !isAdmin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (isAdmin) {
      // Admin views every payout across every store.
      const rows = await db.select().from(vendorWithdrawals).orderBy(desc(vendorWithdrawals.createdAt));
      return NextResponse.json({ withdrawals: rows.map(serializeWithdrawal) });
    }

    const found = await db.select().from(vendors).where(eq(vendors.userId, userId!)).limit(1);
    const vendor = found[0];
    if (!vendor) {
      return NextResponse.json({ withdrawals: [], wallet: serializeWallet(undefined) });
    }

    const [rows, walletRows] = await Promise.all([
      db
        .select()
        .from(vendorWithdrawals)
        .where(eq(vendorWithdrawals.vendorId, vendor.id))
        .orderBy(desc(vendorWithdrawals.createdAt)),
      db.select().from(vendorWallets).where(eq(vendorWallets.vendorId, vendor.id)).limit(1),
    ]);

    return NextResponse.json({
      withdrawals: rows.map(serializeWithdrawal),
      wallet: serializeWallet(walletRows[0]),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}