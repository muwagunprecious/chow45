import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/db";
import { addresses } from "@/db";
import { currentUserId } from "@/lib/session";
import { optionalText, toCoord } from "@/lib/validation";
import { serializeAddress } from "@/lib/serializers";

/**
 * The customer's saved drop-off addresses.
 *
 *   GET    -> the saved list, default first
 *   POST   -> save a new address, or promote an existing one to default
 *   PATCH  -> set which one is the default
 *
 * This replaces `state.userProfile.savedAddresses`, which was capped at eight
 * entries by the client and lost entirely on a different device. The cap is
 * enforced here, and the default is stored as a column rather than inferred
 * from array order.
 *
 * The "one default" rule is handled in the same statement that saves the
 * address: clearing the other defaults and setting the new one together, so two
 * concurrent saves cannot leave two rows flagged as default.
 */

const MAX_SAVED = 8;

export async function GET(request: Request) {
  const userId = await currentUserId(request);
  if (userId === null) {
    return NextResponse.json({ addresses: [] });
  }

  const rows = await db
    .select()
    .from(addresses)
    .where(eq(addresses.userId, userId))
    .orderBy(desc(addresses.isDefault), desc(addresses.id));

  return NextResponse.json({ addresses: rows.map(serializeAddress) });
}

export async function POST(request: Request) {
  const userId = await currentUserId(request);
  if (userId === null) {
    return NextResponse.json({ error: "Sign in to save an address." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const address = String(body.address ?? "").trim();
  if (!address) {
    return NextResponse.json({ error: "Please enter an address." }, { status: 400 });
  }

  const latitude = toCoord(body.latitude ?? body.lat);
  const longitude = toCoord(body.longitude ?? body.lng);
  if (latitude === null || longitude === null) {
    return NextResponse.json(
      { error: "We need the exact location to check delivery coverage." },
      { status: 400 },
    );
  }

  try {
    const existing = await db
      .select()
      .from(addresses)
      .where(eq(addresses.userId, userId))
      .orderBy(desc(addresses.isDefault), desc(addresses.id));

    // A repeat save of the same place updates it rather than filling the list
    // with near-duplicates. The old client matched on label plus state, which
    // meant re-picking the same shop twice produced two rows.
    const duplicate = existing.find(
      (a) =>
        a.latitude === latitude &&
        a.longitude === longitude &&
        (a.label ?? "") === (optionalText(body.label, 60) ?? ""),
    );

    if (duplicate) {
      await db
        .update(addresses)
        .set({
          address,
          formattedAddress: optionalText(body.formattedAddress, 500) ?? address,
          lga: optionalText(body.lga, 100),
          state: optionalText(body.state, 100),
          placeId: optionalText(body.placeId, 255),
          deliveryInstructions: optionalText(body.deliveryInstructions, 500),
          updatedAt: new Date(),
        })
        .where(eq(addresses.id, duplicate.id));

      return NextResponse.json({ address: serializeAddress((await reRead(duplicate.id))!) });
    }

    if (existing.length >= MAX_SAVED) {
      return NextResponse.json(
        { error: `You can save up to ${MAX_SAVED} addresses. Remove one first.` },
        { status: 409 },
      );
    }

    // The first address saved is automatically the default, so a new customer is
    // not asked to choose before they can order.
    const isFirst = existing.length === 0;

    const [created] = await db
      .insert(addresses)
      .values({
        userId,
        label: optionalText(body.label, 60),
        address,
        formattedAddress: optionalText(body.formattedAddress, 500) ?? address,
        latitude,
        longitude,
        lga: optionalText(body.lga, 100),
        state: optionalText(body.state, 100),
        placeId: optionalText(body.placeId, 255),
        deliveryInstructions: optionalText(body.deliveryInstructions, 500),
        isDefault: isFirst,
      })
      .returning();

    if (!isFirst) {
      // Returning the whole list keeps the client from having to merge.
      return NextResponse.json({ address: serializeAddress(created) }, { status: 201 });
    }

    return NextResponse.json({ address: serializeAddress(created) }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

/** Promotes one saved address to be the default. */
export async function PATCH(request: Request) {
  const userId = await currentUserId(request);
  if (userId === null) {
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  }

  const id = Number(
    new URL(request.url).searchParams.get("id") ??
      ((await request.json().catch(() => ({}))) as Record<string, unknown>).id,
  );
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Which address?" }, { status: 400 });
  }

  const owned = await db
    .select({ id: addresses.id })
    .from(addresses)
    .where(and(eq(addresses.id, id), eq(addresses.userId, userId)))
    .limit(1);

  if (owned.length === 0) {
    return NextResponse.json({ error: "Address not found." }, { status: 404 });
  }

  // Both writes go through one transaction so the user never briefly has two
  // defaults, or none.
  await db.transaction(async (tx) => {
    await tx
      .update(addresses)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(addresses.userId, userId));
    await tx
      .update(addresses)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(addresses.id, id));
  });

  return NextResponse.json({ address: serializeAddress((await reRead(id))!) });
}

async function reRead(id: number) {
  const rows = await db.select().from(addresses).where(eq(addresses.id, id)).limit(1);
  return rows[0] ?? null;
}
