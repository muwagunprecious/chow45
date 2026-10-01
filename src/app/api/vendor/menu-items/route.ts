import { NextResponse } from "next/server";
import { and, asc, eq, inArray } from "drizzle-orm";

import { db } from "@/db";
import { menuItems } from "@/db/schema/menu-items";
import { menuItemSizes } from "@/db/schema/menu-item-sizes";
import { menuExtras } from "@/db/schema/menu-extras";
import { requireVendor } from "@/lib/session";

/**
 * Menu items and their size variants for the signed-in vendor.
 *
 *   GET    -> strictly the authenticated vendor's items (HTTP 401 if unauthenticated)
 *   POST   -> create or update one item belonging strictly to the authenticated vendor
 *   DELETE -> delete an item belonging strictly to the authenticated vendor
 *
 * Every read and write is strictly scoped to the caller's own vendor row, resolved
 * from the Better Auth session user id, so one vendor can NEVER read, overwrite,
 * or delete another vendor's menu items.
 */

const PIECE_CATEGORIES = ["drinks", "snacks", "grills", "shawarma", "others"];
const PORTION_CATEGORIES = ["rice", "soups", "swallows"];

function toPrice(value: unknown): number {
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function readClientId(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const id = value.trim();
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) return null;

  return id;
}

function parseSizes(raw: unknown, menuItemId: string) {
  if (!Array.isArray(raw)) return [];

  const seenNames = new Set<string>();
  const out: (typeof menuItemSizes.$inferInsert)[] = [];

  raw.forEach((entry, index) => {
    if (!entry || typeof entry !== "object") return;

    const name = String((entry as Record<string, unknown>).name ?? "").trim();
    if (!name) return;

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
        id: `ext-${menuItemId.slice(0, 16)}-${extraType.toLowerCase()}-${index}-${Date.now().toString(36)}`,
        menuItemId,
        name: String(row.name).trim().slice(0, 255),
        price: toPrice(row.price),
        extraType,
        isAvailable: true,
        sortOrder: index,
      };
    });
}

export async function GET(request: Request) {
  const auth = await requireVendor(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error, message: "Unauthorized. Please sign in as a vendor to view your menu." },
      { status: auth.status }
    );
  }

  const vendorId = auth.vendor.id;

  const items = await db
    .select()
    .from(menuItems)
    .where(eq(menuItems.vendorId, vendorId))
    .orderBy(asc(menuItems.createdAt));

  if (items.length === 0) {
    return NextResponse.json({ items: [], sizes: [], extras: [] });
  }

  const itemIds = items.map((i) => i.id);

  const sizes = await db
    .select()
    .from(menuItemSizes)
    .where(
      and(
        eq(menuItemSizes.isAvailable, true),
        inArray(menuItemSizes.menuItemId, itemIds),
      ),
    )
    .orderBy(asc(menuItemSizes.sortOrder));

  const extras = await db
    .select()
    .from(menuExtras)
    .where(
      and(
        eq(menuExtras.isAvailable, true),
        inArray(menuExtras.menuItemId, itemIds),
      ),
    )
    .orderBy(asc(menuExtras.sortOrder));

  return NextResponse.json({ items, sizes, extras });
}

export async function POST(request: Request) {
  const auth = await requireVendor(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error, message: "Unauthorized. Please sign in as a vendor." },
      { status: auth.status }
    );
  }

  const vendorId = auth.vendor.id;

  try {
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

    let category = String(body.category ?? "").trim().toLowerCase();
    if (!category) category = "rice";

    if (category.includes("rice")) category = "rice";
    else if (category.includes("soup")) category = "soups";
    else if (category.includes("swallow")) category = "swallows";
    else if (category.includes("drink") || category.includes("beverage")) category = "drinks";
    else if (category.includes("snack") || category.includes("pastr") || category.includes("chop")) category = "snacks";
    else if (category.includes("grill") || category.includes("bbq") || category.includes("suya")) category = "grills";
    else if (category.includes("shawarma") || category.includes("burger")) category = "shawarma";
    else if (PIECE_CATEGORIES.indexOf(category) === -1 && PORTION_CATEGORIES.indexOf(category) === -1) {
      category = "others";
    }

    const isPiece = PIECE_CATEGORIES.indexOf(category) !== -1;

    const requestedType = String(body.priceType ?? "").toUpperCase();
    const portionType =
      requestedType === "SCOOP" || requestedType === "BOTH" ? requestedType : "PLATE";
    const priceType = isPiece ? "PIECE" : portionType;

    const genericPrice = toPrice(body.price || (body as Record<string, unknown>).singlePrice);
    let piecePrice = toPrice(body.piecePrice);
    let scoopPrice = toPrice(body.scoopPrice);
    let platePrice = toPrice(body.platePrice);

    if (isPiece && piecePrice <= 0 && genericPrice > 0) piecePrice = genericPrice;
    if (!isPiece && platePrice <= 0 && genericPrice > 0) platePrice = genericPrice;
    if (!isPiece && scoopPrice <= 0 && genericPrice > 0 && priceType === "SCOOP") scoopPrice = genericPrice;

    if (isPiece && piecePrice <= 0) {
      return NextResponse.json({ error: "Please enter a valid price per piece for this dish." }, { status: 400 });
    }
    if (!isPiece && priceType === "SCOOP" && scoopPrice <= 0) {
      return NextResponse.json({ error: "Please enter a valid price per scoop for this dish." }, { status: 400 });
    }
    if (!isPiece && priceType === "PLATE" && platePrice <= 0) {
      return NextResponse.json({ error: "Please enter a valid price per plate for this dish." }, { status: 400 });
    }
    if (!isPiece && priceType === "BOTH" && scoopPrice <= 0 && platePrice <= 0) {
      return NextResponse.json({ error: "Please enter a price per scoop or plate for this dish." }, { status: 400 });
    }

    const existingId = readClientId(body.id);
    let updating = false;

    if (existingId) {
      const existingItem = await db
        .select({ id: menuItems.id, vendorId: menuItems.vendorId })
        .from(menuItems)
        .where(eq(menuItems.id, existingId))
        .limit(1);

      if (existingItem.length > 0) {
        if (existingItem[0].vendorId !== vendorId) {
          return NextResponse.json(
            { error: "FORBIDDEN", message: "You cannot modify food belonging to another vendor." },
            { status: 403 }
          );
        }
        updating = true;
      }
    }

    const effectivePrice = isPiece ? piecePrice : (priceType === "SCOOP" ? scoopPrice : platePrice) || 0;
    const finalStatus = typeof body.status === "string" ? String(body.status) : "available";
    const finalPublished = finalStatus === "available" || body.isPublished === true;

    const [saved] = await db
      .insert(menuItems)
      .values({
        ...(existingId ? { id: existingId } : {}),
        vendorId,
        name: name.slice(0, 255),
        category: category.slice(0, 100),
        description: String(body.description ?? "").trim() || null,
        imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : null,
        priceType,
        price: effectivePrice,
        scoopPrice: isPiece ? null : scoopPrice || null,
        platePrice: isPiece ? null : platePrice || null,
        piecePrice: isPiece ? piecePrice : null,
        status: finalStatus,
        isPublished: finalPublished,
        preorderEnabled: Boolean(body.preorderEnabled),
        preorderDate: typeof body.preorderDate === "string" ? body.preorderDate : null,
        preorderTime: typeof body.preorderTime === "string" ? body.preorderTime : null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: menuItems.id,
        set: {
          name: name.slice(0, 255),
          category: category.slice(0, 100),
          description: String(body.description ?? "").trim() || null,
          imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : null,
          priceType,
          price: effectivePrice,
          scoopPrice: isPiece ? null : scoopPrice || null,
          platePrice: isPiece ? null : platePrice || null,
          piecePrice: isPiece ? piecePrice : null,
          status: finalStatus,
          isPublished: finalPublished,
          preorderEnabled: Boolean(body.preorderEnabled),
          preorderDate: typeof body.preorderDate === "string" ? body.preorderDate : null,
          preorderTime: typeof body.preorderTime === "string" ? body.preorderTime : null,
          updatedAt: new Date(),
        },
      })
      .returning();

    const itemId = saved.id;

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
  } catch (err: any) {
    console.error("[POST /api/vendor/menu-items] Error saving menu item:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to create or update menu item." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  const auth = await requireVendor(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: auth.error, message: "Unauthorized. Please sign in as a vendor." },
      { status: auth.status }
    );
  }

  const vendorId = auth.vendor.id;

  const url = new URL(request.url);
  let id = url.searchParams.get("id");
  if (!id) {
    const body = await request.json().catch(() => ({}));
    id = (body as Record<string, unknown>)?.id as string;
  }

  const itemId = readClientId(id);
  if (!itemId) {
    return NextResponse.json({ error: "Invalid item ID." }, { status: 400 });
  }

  const existing = await db
    .select({ id: menuItems.id, vendorId: menuItems.vendorId })
    .from(menuItems)
    .where(eq(menuItems.id, itemId))
    .limit(1);

  if (existing.length === 0) {
    return NextResponse.json({ error: "Item not found." }, { status: 404 });
  }

  if (existing[0].vendorId !== vendorId) {
    return NextResponse.json(
      { error: "FORBIDDEN", message: "You cannot delete food belonging to another vendor." },
      { status: 403 }
    );
  }

  await db.delete(menuItemSizes).where(eq(menuItemSizes.menuItemId, itemId));
  await db.delete(menuExtras).where(eq(menuExtras.menuItemId, itemId));
  await db
    .delete(menuItems)
    .where(and(eq(menuItems.id, itemId), eq(menuItems.vendorId, vendorId)));

  return NextResponse.json({ success: true, message: "Menu item deleted successfully." });
}
