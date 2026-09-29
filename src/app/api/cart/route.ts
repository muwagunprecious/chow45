import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";

import { db } from "@/db";
import { cartItems, carts, menuItems, menuItemSizes, menuExtras, vendors } from "@/db";
import { currentUserId } from "@/lib/session";
import { nonNegativeInt, readClientId } from "@/lib/validation";

/**
 * The signed-in customer's cart.
 *
 *   GET    -> the cart with its items and the store they belong to
 *   POST   -> add an item, change a quantity, remove one, or clear
 *
 * Prices are read from `menu_items` and `menu_extras` on the server and never
 * taken from the request. When the cart lived in localStorage the customer
 * could open devtools and set any item to ₦1; the whole point of moving it
 * here is that the amount charged is decided by the database.
 */

type AddOn = { name: string; price: number };

/** Re-reads an item's current price and availability from the database. */
async function priceItem(dishId: string) {
  const rows = await db
    .select({
      id: menuItems.id,
      name: menuItems.name,
      price: menuItems.price,
      status: menuItems.status,
      vendorId: menuItems.vendorId,
      imageUrl: menuItems.imageUrl,
    })
    .from(menuItems)
    .where(eq(menuItems.id, dishId))
    .limit(1);

  return rows[0] ?? null;
}

/** Confirms each requested extra exists on the item, and prices it from the row. */
async function priceExtras(dishId: string, requested: unknown): Promise<AddOn[] | null> {
  if (!Array.isArray(requested) || requested.length === 0) return [];

  const names = requested
    .map((e) => (e && typeof e === "object" ? String((e as AddOn).name ?? "").trim() : ""))
    .filter(Boolean);
  if (names.length === 0) return [];

  const rows = await db
    .select()
    .from(menuExtras)
    .where(and(eq(menuExtras.menuItemId, dishId), eq(menuExtras.isAvailable, true)));

  const out: AddOn[] = [];
  for (const name of names) {
    const hit = rows.find((r) => r.name.toLowerCase() === name.toLowerCase());
    if (!hit) return null; // an extra the menu does not offer
    out.push({ name: hit.name, price: hit.price });
  }
  return out;
}

async function readCart(userId: number) {
  const cartRows = await db.select().from(carts).where(eq(carts.userId, userId)).limit(1);
  const cart = cartRows[0] ?? null;

  const items = cart
    ? await db.select().from(cartItems).where(eq(cartItems.cartId, cart.id)).orderBy(asc(cartItems.id))
    : [];

  const store = cart
    ? ((
        await db
          .select({ storeId: vendors.storeId, name: vendors.businessName })
          .from(vendors)
          .where(eq(vendors.id, cart.vendorId))
          .limit(1)
      )[0] ?? null)
    : null;

  return {
    id: cart?.id ?? null,
    vendorId: cart?.vendorId ?? null,
    storeId: store?.storeId ?? null,
    storeName: store?.name ?? null,
    items: items.map((i) => ({
      dishId: i.menuItemId,
      name: i.name,
      img: i.img,
      price: i.unitPrice,
      qty: i.qty,
      itemTotal: i.itemTotal,
      selectedAddons: i.selectedAddons ?? [],
    })),
  };
}

export async function GET(request: Request) {
  const userId = await currentUserId(request);
  if (userId === null) {
    // Browsing is public, so a guest simply has no cart rather than an error.
    return NextResponse.json({ cart: { id: null, storeId: null, storeName: null, items: [] } });
  }

  return NextResponse.json({ cart: await readCart(userId) });
}

export async function POST(request: Request) {
  const userId = await currentUserId(request);
  if (userId === null) {
    return NextResponse.json({ error: "Sign in to use the basket." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const action = String(body.action ?? "add");

  try {
    if (action === "clear") {
      const cartRows = await db.select().from(carts).where(eq(carts.userId, userId)).limit(1);
      if (cartRows[0]) {
        await db.delete(cartItems).where(eq(cartItems.cartId, cartRows[0].id));
      }
      return NextResponse.json({ cart: await readCart(userId) });
    }

    if (action === "add") {
      const dishId = readClientId(body.dishId);
      if (dishId === null) {
        return NextResponse.json({ error: "Which item is that?" }, { status: 400 });
      }

      const qty = Math.max(1, Math.min(50, Math.round(Number(body.qty ?? 1)) || 1));

      const item = await priceItem(dishId);
      if (item === null) {
        return NextResponse.json({ error: "That item is no longer on the menu." }, { status: 404 });
      }
      if (item.vendorId === null) {
        return NextResponse.json({ error: "That item is not on sale." }, { status: 400 });
      }
      if (item.status !== "AVAILABLE" && item.status !== "PREORDER") {
        return NextResponse.json({ error: `${item.name} is out of stock.` }, { status: 409 });
      }

      const extras = await priceExtras(dishId, body.selectedAddons);
      if (extras === null) {
        return NextResponse.json({ error: "One of the extras is not available." }, { status: 400 });
      }

      // Unit price is the base plus the chosen extras, and for a by-piece item a
      // chosen size replaces the base rather than adding to it.
      const sizeId = readClientId(body.sizeId);
      let unitPrice = item.price + extras.reduce((sum, e) => sum + e.price, 0);
      if (sizeId) {
        const sizeRows = await db
          .select()
          .from(menuItemSizes)
          .where(
            and(
              eq(menuItemSizes.id, sizeId),
              eq(menuItemSizes.menuItemId, dishId),
              eq(menuItemSizes.isAvailable, true),
            ),
          )
          .limit(1);
        if (sizeRows[0]) {
          unitPrice = sizeRows[0].price + extras.reduce((sum, e) => sum + e.price, 0);
        }
      }

      const cartRows = await db.select().from(carts).where(eq(carts.userId, userId)).limit(1);
      const existing = cartRows[0] ?? null;

      // The platform's "1 cart = 1 store" rule. A cart is bound to one vendor
      // for its whole life, so a dish from a second store cannot join it; the
      // client is told to confirm a swap rather than being allowed to merge.
      if (existing && existing.vendorId !== item.vendorId) {
        const other = await db
          .select({ name: vendors.businessName })
          .from(vendors)
          .where(eq(vendors.id, existing.vendorId))
          .limit(1);
        return NextResponse.json(
          {
            error: "cart_conflict",
            currentStoreName: other[0]?.name ?? "another store",
            newStoreName: item.name,
          },
          { status: 409 },
        );
      }

      const cart =
        existing ??
        (await db.insert(carts).values({ userId, vendorId: item.vendorId }).returning())[0];

      // Adding the same dish with the same extras bumps the existing line
      // instead of creating a duplicate row, matching what the cart showed
      // before this moved to the database.
      const lines = await db
        .select()
        .from(cartItems)
        .where(eq(cartItems.cartId, cart.id))
        .orderBy(asc(cartItems.id));

      const sameLine = lines.find(
        (l) =>
          l.menuItemId === dishId &&
          JSON.stringify(l.selectedAddons ?? []) === JSON.stringify(extras) &&
          // A size change must produce a new line, so the two are only merged
          // when the unit price still agrees.
          l.unitPrice === unitPrice,
      );

      if (sameLine) {
        const newQty = Math.min(50, sameLine.qty + qty);
        await db
          .update(cartItems)
          .set({ qty: newQty, itemTotal: unitPrice * newQty, updatedAt: new Date() })
          .where(eq(cartItems.id, sameLine.id));
      } else {
        await db.insert(cartItems).values({
          cartId: cart.id,
          menuItemId: dishId,
          name: item.name,
          img: item.imageUrl,
          unitPrice,
          qty,
          itemTotal: unitPrice * qty,
          selectedAddons: extras,
        });
      }

      await db.update(carts).set({ updatedAt: new Date() }).where(eq(carts.id, cart.id));

      return NextResponse.json({ cart: await readCart(userId) }, { status: 201 });
    }

    if (action === "qty") {
      const lineId = Number(body.lineId);
      const delta = Math.round(Number(body.delta ?? 0));
      if (!Number.isFinite(lineId) || !Number.isFinite(delta) || delta === 0) {
        return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
      }

      const cartRows = await db.select().from(carts).where(eq(carts.userId, userId)).limit(1);
      const cart = cartRows[0];
      if (!cart) {
        return NextResponse.json({ error: "Your basket is empty." }, { status: 404 });
      }

      // Scoped through the cart's own id so a line id from someone else's cart
      // cannot be found, let alone edited.
      const lines = await db
        .select()
        .from(cartItems)
        .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.id, lineId)))
        .limit(1);

      const line = lines[0];
      if (!line) {
        return NextResponse.json({ error: "That item is not in your basket." }, { status: 404 });
      }

      const newQty = line.qty + delta;
      if (newQty <= 0) {
        await db.delete(cartItems).where(eq(cartItems.id, line.id));
      } else {
        const clamped = Math.min(50, newQty);
        await db
          .update(cartItems)
          .set({ qty: clamped, itemTotal: line.unitPrice * clamped, updatedAt: new Date() })
          .where(eq(cartItems.id, line.id));
      }

      return NextResponse.json({ cart: await readCart(userId) });
    }

    if (action === "remove") {
      const lineId = Number(body.lineId);
      const cartRows = await db.select().from(carts).where(eq(carts.userId, userId)).limit(1);
      const cart = cartRows[0];
      if (!cart) {
        return NextResponse.json({ error: "Your basket is empty." }, { status: 404 });
      }

      const deleted = await db
        .delete(cartItems)
        .where(and(eq(cartItems.cartId, cart.id), eq(cartItems.id, lineId)))
        .returning({ id: cartItems.id });

      if (deleted.length === 0) {
        return NextResponse.json({ error: "That item is not in your basket." }, { status: 404 });
      }

      return NextResponse.json({ cart: await readCart(userId) });
    }

    return NextResponse.json({ error: `Unknown action "${action}".` }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}
