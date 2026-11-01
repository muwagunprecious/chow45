import { NextResponse } from "next/server";
import { and, desc, eq, ne, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { orders, vendors, vendorWallets, vendorWithdrawals } from "@/db";
import { currentRole, currentVendorUserId, vendorRequiresPasswordChange } from "@/lib/session";
import { optionalText } from "@/lib/validation";
import { serializeWallet, serializeWithdrawal } from "@/lib/serializers";

/**
 * Vendor payouts.
 *
 *   POST /api/vendor/withdrawals   -> vendor requests a payout
 *   GET  /api/vendor/withdrawals   -> the vendor's own requests and balance
 *
 * The transfer happens in a transaction: the wallet and the new withdrawal row move together.
 */
export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const userId = await currentVendorUserId(request);
  const storeIdParam = String(body.storeId || "");
  const vendorIdParam = Number(body.vendorId);
  const emailParam = String(body.email || "").trim().toLowerCase();

  if (userId === null && !storeIdParam && !vendorIdParam && !emailParam) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
    let vendor: any = null;
    if (userId !== null) {
      const found = await db.select().from(vendors).where(eq(vendors.userId, userId)).limit(1);
      if (found[0]) vendor = found[0];
    }
    if (!vendor) {
      if (vendorIdParam && Number.isFinite(vendorIdParam)) {
        const found = await db.select().from(vendors).where(eq(vendors.id, vendorIdParam)).limit(1);
        if (found[0]) vendor = found[0];
      } else if (storeIdParam) {
        const found = await db.select().from(vendors).where(eq(vendors.storeId, storeIdParam)).limit(1);
        if (found[0]) vendor = found[0];
      } else if (emailParam) {
        const found = await db.select().from(vendors).where(sql`LOWER(${vendors.contactEmail}) = ${emailParam}`).limit(1);
        if (found[0]) vendor = found[0];
      }
    }

    if (!vendor) {
      return NextResponse.json({ error: "No store found for this account." }, { status: 404 });
    }

    if (vendorRequiresPasswordChange(vendor)) {
      return NextResponse.json(
        { error: "PASSWORD_CHANGE_REQUIRED", message: "You must change your temporary password before requesting withdrawals." },
        { status: 403 }
      );
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

  const url = new URL(request.url);
  const storeIdParam = url.searchParams.get("storeId");
  const vendorIdParam = url.searchParams.get("vendorId");
  const emailParam = url.searchParams.get("email");

  const userId = await currentVendorUserId(request);
  if (userId === null && !isAdmin && !storeIdParam && !vendorIdParam && !emailParam) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    if (isAdmin && !storeIdParam && !vendorIdParam) {
      // Admin views every payout across every store.
      const rows = await db.select().from(vendorWithdrawals).orderBy(desc(vendorWithdrawals.createdAt));
      return NextResponse.json({ withdrawals: rows.map(serializeWithdrawal) });
    }

    let vendor: any = null;
    if (userId !== null) {
      const found = await db.select().from(vendors).where(eq(vendors.userId, userId)).limit(1);
      if (found[0]) vendor = found[0];
    }

    if (!vendor) {
      if (vendorIdParam && Number.isFinite(Number(vendorIdParam))) {
        const found = await db.select().from(vendors).where(eq(vendors.id, Number(vendorIdParam))).limit(1);
        if (found[0]) vendor = found[0];
      } else if (storeIdParam) {
        const found = await db.select().from(vendors).where(eq(vendors.storeId, storeIdParam)).limit(1);
        if (found[0]) vendor = found[0];
      } else if (emailParam) {
        const clean = emailParam.trim().toLowerCase();
        const found = await db.select().from(vendors).where(sql`LOWER(${vendors.contactEmail}) = ${clean}`).limit(1);
        if (found[0]) vendor = found[0];
      }
    }

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

    // Calculate total order sales (earnings from placed food orders)
    const orderSales = await db
      .select({
        total: sql<number>`COALESCE(SUM(${orders.subtotal}), 0)`.mapWith(Number),
      })
      .from(orders)
      .where(
        and(
          or(eq(orders.vendorId, vendor.id), eq(orders.storeId, vendor.storeId)),
          ne(orders.status, "CANCELLED"),
          ne(orders.status, "PENDING_PAYMENT")
        )
      );

    const lifetimeEarnings = orderSales[0]?.total || 0;
    let wallet = walletRows[0];

    // Total already requested in withdrawals (processing or paid)
    const totalRequested = rows.reduce((sum, w) => sum + (w.status !== "rejected" ? w.amount : 0), 0);
    const expectedAvailable = Math.max(0, lifetimeEarnings - totalRequested);

    // Initialize or sync vendor wallet if balance is lower than actual lifetime earnings minus withdrawals
    if (!wallet) {
      const [newWallet] = await db
        .insert(vendorWallets)
        .values({
          vendorId: vendor.id,
          available: expectedAvailable,
          processing: 0,
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: vendorWallets.vendorId,
          set: {
            available: expectedAvailable,
            updatedAt: new Date(),
          },
        })
        .returning();
      wallet = newWallet;
    } else if (wallet.available === 0 && expectedAvailable > 0) {
      const [updatedWallet] = await db
        .update(vendorWallets)
        .set({
          available: expectedAvailable,
          updatedAt: new Date(),
        })
        .where(eq(vendorWallets.vendorId, vendor.id))
        .returning();
      wallet = updatedWallet;
    }

    return NextResponse.json({
      withdrawals: rows.map(serializeWithdrawal),
      wallet: serializeWallet(wallet),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}