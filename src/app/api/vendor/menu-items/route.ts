import { NextResponse } from "next/server";
import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { menuItems } from "@/db/schema/menu-items";
import { menuItemSizes } from "@/db/schema/menu-item-sizes";
import { menuExtras } from "@/db/schema/menu-extras";
import { users } from "@/db/schema/users";
import { vendors } from "@/db/schema/vendors";
import { vendorAuth } from "@/auth";

/**
 * Menu items and their size variants for the signed-in vendor.
 *
 *   GET    -> the vendor's items, each with its `sizes` array
 *   POST   -> create or update one item, replacing its sizes and extras
 *
 * Every read and write is scoped to the caller's own vendor row, resolved
 * from the session user id, so one vendor can never read or overwrite
 * another vendor's menu.
 */

// Categories sold by piece. Mirrors ChowUnits.PIECE_CATEGORIES on the client;
// sizes are only meaningful for these.
const PIECE_CATEGORIES = ["drinks", "snacks", "grills", "shawarma", "others"];
const PORTION_CATEGORIES = ["rice", "soups", "swallows"];

async function resolveVendorId(request: Request): Promise<number | null> {
  const session = await vendorAuth.api.getSession({ headers: request.headers });

  if (!session?.user?.id) return null;

  // Better Auth carries the id as a string while the column is a bigserial.
  const userId = Number(session.user.id);
  if (!Number.isFinite(userId)) return null;

  const found = await db
    .select({ id: vendors.id })
    .from(vendors)
    .innerJoin(users, eq(vendors.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1);

  return found[0]?.id ?? null;
}

function toPrice(value: unknown): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Client ids look like `dish-1756312345678-k3f9qz`. They are accepted as
 * primary keys so an edit updates the same row, but the shape is enforced so
 * a caller cannot push an arbitrary string into the key column.
 */
function readClientId(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const id = value.trim();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;

  return id;
}

/**
 * Sizes are keyed by a client-generated id so the builder can keep a stable
 * handle while the vendor edits prices. Ids are reused on update; unknown ids
 * are treated as new rows.
 */
function parseSizes(raw: unknown, menuItemId: string) {
  if (!Array.isArray(raw)) return [];

  const seenNames = new Set<string>();
  const out: (typeof menuItemSizes.$inferInsert)[] = [];

  raw.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;

    const name = String((entry as Record<string, unknown>).name ?? "").trim();
    if (!name) return;

    // Two sizes priced the same name would make the customer's choice
    // meaningless, so the second one is dropped rather than shown.
    const key = name.toLowerCase();
    if (seenNames.has(key)) return;
    seenNames.add(key);

    const price = toPrice((entry as Record<string, unknown>).price);
    if (price <= 0) return;

    const id = (entry as Record<string, unknown>).id;
    out.push({
      id: typeof id === "string" && id.startsWith("sz-") ? id : `sz-${menuItemId}-${index}`,
      menuItemId,
      name,
      price,
      isAvailable: true,
      sortOrder: index,
    });
  });

  return out;
}

function parseExtras(raw: unknown, menuItemId: string, extraType: "REQUIRED" | "OPTIONAL") {
  if (!Array.isArray(raw)) return [];

  return raw
    .filter((e) => e && typeof e === "object" && String((e as Record<string, unknown>).name ?? "").trim())
    .map((e, index) => {
      const row = e as Record<string, unknown>;
      return {
        menuItemId,
        name: String(row.name).trim(),
        price: toPrice(row.price),
        extraType,
        isAvailable: true,
        sortOrder: index,
      };
    });
}

export async function GET(request: Request) {
  const vendorId = await resolveVendorId(request);
  if (vendorId === null) {
    return NextResponse.json({ error: "Not signed in as a vendor." }, { status: 401 });
  }

  const items = await db
    .select()
    .from(menuItems)
    .where(eq(menuItems.vendorId, vendorId))
    .orderBy(asc(menuItems.createdAt));

  if (items.length === 0) {
    return NextResponse.json({ items: [] });
  }

  const sizes = await db
    .select()
    .from(menuItemSizes)
    .where(
      and(
        eq(menuItemSizes.isAvailable, true),
        // Only sizes belonging to this vendor's items.
        inArray(menuItemSizes.menuItemId, items.map((i) => i.id)),
      ),
    )
    .orderBy(asc(menuItemSizes.sortOrder));

  return NextResponse.json({ items, sizes });
}

export async function POST(request: Request) {
  const vendorId = await resolveVendorId(request);
  if (vendorId === null) {
    return NextResponse.json({ error: "Not signed in as a vendor." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Please give the item a name." }, { status: 400 });
  }

  const category = String(body.category ?? "").trim().toLowerCase();
  if (PIECE_CATEGORIES.indexOf(category) === -1 && PORTION_CATEGORIES.indexOf(category) === -1) {
    return NextResponse.json({ error: "Unknown category." }, { status: 400 });
  }

  const isPiece = PIECE_CATEGORIES.indexOf(category) !== -1;

  // Force the price type to match the category so a drink cannot be stored
  // with scoop pricing, and a plated food cannot be stored as per-piece,
  // even if the client sent it.
  const requestedType = String(body.priceType ?? "").toUpperCase();
  const portionType =
    requestedType === "SCOOP" || requestedType === "BOTH" ? requestedType : "PLATE";
  const priceType = isPiece ? "PIECE" : portionType;

  const piecePrice = toPrice(body.piecePrice);
  const scoopPrice = toPrice(body.scoopPrice);
  const platePrice = toPrice(body.platePrice);

  if (isPiece && piecePrice <= 0) {
    return NextResponse.json({ error: "A price per piece is required." }, { status: 400 });
  }
  if (!isPiece && priceType === "SCOOP" && scoopPrice <= 0) {
    return NextResponse.json({ error: "A price per scoop is required." }, { status: 400 });
  }
  if (!isPiece && priceType === "PLATE" && platePrice <= 0) {
    return NextResponse.json({ error: "A price per plate is required." }, { status: 400 });
  }
  if (!isPiece && priceType === "BOTH" && scoopPrice <= 0 && platePrice <= 0) {
    return NextResponse.json({ error: "At least one of scoop or plate is required." }, { status: 400 });
  }

  const existingId = readClientId(body.id);

  // The browser's own id is used as the primary key so an edit reuses the
  // same row instead of creating a duplicate. If the id is unknown to this
  // vendor (first sync, or a seeded dish), it is inserted rather than
  // rejected, because refusing would strand the vendor's work.
  let updating = false;

  if (existingId) {
    const owned = await db
      .select({ id: menuItems.id })
      .from(menuItems)
      .where(and(eq(menuItems.id, existingId), eq(menuItems.vendorId, vendorId)))
      .limit(1);

    if (owned.length > 0) {
      updating = true;
    } else {
      // A row with this id may still exist under a different vendor. That
      // must not be overwritten, and the insert below will fail on the
      // primary key, so report it clearly.
      const taken = await db
        .select({ id: menuItems.id })
        .from(menuItems)
        .where(eq(menuItems.id, existingId))
        .limit(1);

      if (taken.length > 0) {
        return NextResponse.json(
          { error: "That item id belongs to another vendor." },
          { status: 409 }
        );
      }
    }
  }

  const [saved] = await db
    .insert(menuItems)
    .values({
      ...(existingId ? { id: existingId } : {}),
      vendorId,
      name,
      category,
      description: String(body.description ?? "").trim() || null,
      imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : null,
      priceType,
      scoopPrice: isPiece ? null : scoopPrice || null,
      platePrice: isPiece ? null : platePrice || null,
      piecePrice: isPiece ? piecePrice : null,
      status: String(body.status ?? "available"),
      isPublished: body.isPublished !== false,
      preorderEnabled: Boolean(body.preorderEnabled),
      preorderDate: typeof body.preorderDate === "string" ? body.preorderDate : null,
      preorderTime: typeof body.preorderTime === "string" ? body.preorderTime : null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: menuItems.id,
      set: {
        name,
        category,
        description: String(body.description ?? "").trim() || null,
        imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : null,
        priceType,
        scoopPrice: isPiece ? null : scoopPrice || null,
        platePrice: isPiece ? null : platePrice || null,
        piecePrice: isPiece ? piecePrice : null,
        status: String(body.status ?? "available"),
        isPublished: body.isPublished !== false,
        preorderEnabled: Boolean(body.preorderEnabled),
        preorderDate: typeof body.preorderDate === "string" ? body.preorderDate : null,
        preorderTime: typeof body.preorderTime === "string" ? body.preorderTime : null,
        updatedAt: new Date(),
      },
    })
    .returning();

  const itemId = saved.id;

  // Sizes and extras are replaced wholesale: the builder always submits the
  // full set the vendor is looking at, so a delete must actually delete.
  const newSizes = isPiece ? parseSizes(body.sizes, itemId) : [];

  await db.delete(menuItemSizes).where(eq(menuItemSizes.menuItemId, itemId));
  if (newSizes.length > 0) {
    await db.insert(menuItemSizes).values(newSizes);
  }

  await db.delete(menuExtras).where(eq(menuExtras.menuItemId, itemId));
  const allExtras = [
    ...parseExtras(body.compulsoryExtras, itemId, "REQUIRED"),
    ...parseExtras(body.optionalExtras, itemId, "OPTIONAL"),
  ];
  if (allExtras.length > 0) {
    await db.insert(menuExtras).values(allExtras);
  }

  return NextResponse.json({ item: saved, sizes: newSizes }, { status: updating ? 200 : 201 });
}
