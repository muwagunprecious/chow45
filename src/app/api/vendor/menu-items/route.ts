import { NextResponse } from "next/server";
import { and, asc, eq, inArray, sql } from "drizzle-orm";

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
  let vendorId = await resolveVendorId(request);
  const url = new URL(request.url);
  const paramId = url.searchParams.get("vendorId");
  const paramEmail = url.searchParams.get("email");
  const paramStoreId = url.searchParams.get("storeId");

  if (vendorId === null) {
    if (paramId && Number.isFinite(Number(paramId))) {
      vendorId = Number(paramId);
    } else if (paramEmail) {
      const cleanEmail = paramEmail.trim().toLowerCase();
      const match = await db
        .select({ id: vendors.id })
        .from(vendors)
        .where(sql`LOWER(${vendors.contactEmail}) = ${cleanEmail}`)
        .limit(1);
      if (match[0]?.id) {
        vendorId = match[0].id;
      } else {
        // Also check if user with this email has a linked vendor
        const userMatch = await db
          .select({ id: vendors.id })
          .from(vendors)
          .innerJoin(users, eq(vendors.userId, users.id))
          .where(sql`LOWER(${users.email}) = ${cleanEmail}`)
          .limit(1);
        if (userMatch[0]?.id) vendorId = userMatch[0].id;
      }
    } else if (paramStoreId) {
      const match = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.storeId, paramStoreId)).limit(1);
      if (match[0]?.id) vendorId = match[0].id;
    } else {
      const first = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.status, "approved")).limit(1);
      vendorId = first[0]?.id ?? null;
    }
  }

  let items;
  if (vendorId !== null) {
    items = await db
      .select()
      .from(menuItems)
      .where(eq(menuItems.vendorId, vendorId))
      .orderBy(asc(menuItems.createdAt));
  } else {
    items = await db
      .select()
      .from(menuItems)
      .orderBy(asc(menuItems.createdAt));
  }

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
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  let vendorId = await resolveVendorId(request);
  const emailCandidate = String(body.email || body.vendorEmail || "").trim().toLowerCase();

  // 1. Explicit vendorId provided
  if (vendorId === null && body.vendorId && Number.isFinite(Number(body.vendorId))) {
    const check = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.id, Number(body.vendorId))).limit(1);
    if (check[0]?.id) vendorId = check[0].id;
  }

  // 2. Email candidate provided (match by contactEmail or users.email)
  if (vendorId === null && emailCandidate && emailCandidate.includes("@")) {
    const matchedVendor = await db
      .select({ id: vendors.id })
      .from(vendors)
      .where(sql`LOWER(${vendors.contactEmail}) = ${emailCandidate}`)
      .limit(1);

    if (matchedVendor[0]?.id) {
      vendorId = matchedVendor[0].id;
    } else {
      // Look up user by email
      const matchedUser = await db
        .select({ id: users.id, name: users.name, phone: users.phone })
        .from(users)
        .where(sql`LOWER(${users.email}) = ${emailCandidate}`)
        .limit(1);

      if (matchedUser[0]?.id) {
        // User exists, find or create their vendor profile
        const userVendor = await db
          .select({ id: vendors.id })
          .from(vendors)
          .where(eq(vendors.userId, matchedUser[0].id))
          .limit(1);

        if (userVendor[0]?.id) {
          vendorId = userVendor[0].id;
        } else {
          const bName = String(body.vendorName || body.storeName || matchedUser[0].name || emailCandidate.split("@")[0]);
          const baseSlug = bName.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 30) || "store";
          const sId = String(body.storeId || `rest-${baseSlug}-${Date.now().toString(36)}`);
          const slug = `${baseSlug}-${Date.now().toString(36)}`;

          const [newVnd] = await db
            .insert(vendors)
            .values({
              businessName: bName,
              slug,
              contactEmail: emailCandidate,
              ownerPhone: matchedUser[0].phone || null,
              status: "approved",
              storeId: sId,
              userId: matchedUser[0].id,
              address: "Hospital Road, Sagamu, Ogun State",
            })
            .returning({ id: vendors.id });
          vendorId = newVnd.id;
        }
      }
    }
  }

  // 3. Match by storeId
  if (vendorId === null && body.storeId) {
    const matched = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.storeId, String(body.storeId))).limit(1);
    if (matched[0]?.id) vendorId = matched[0].id;
  }

  // 4. Match by vendorName
  if (vendorId === null && body.vendorName) {
    const matched = await db
      .select({ id: vendors.id })
      .from(vendors)
      .where(sql`LOWER(${vendors.businessName}) = ${String(body.vendorName).trim().toLowerCase()}`)
      .limit(1);
    if (matched[0]?.id) vendorId = matched[0].id;
  }

  // 5. If still null and email candidate exists, auto-create user and vendor
  if (vendorId === null && emailCandidate && emailCandidate.includes("@")) {
    const bName = String(body.storeName || body.vendorName || emailCandidate.split("@")[0]);
    const baseSlug = bName.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 30) || "store";
    const sId = String(body.storeId || `rest-${baseSlug}-${Date.now().toString(36)}`);
    const slug = `${baseSlug}-${Date.now().toString(36)}`;

    const [createdUser] = await db
      .insert(users)
      .values({
        email: emailCandidate,
        name: bName,
        username: (emailCandidate.split("@")[0].replace(/[^a-zA-Z0-9]/g, "") + Math.random().toString(36).slice(2, 6)).slice(0, 45),
        refCode: ("RF" + Date.now().toString(36).slice(-6)).toUpperCase(),
        publicId: ("pub_" + Date.now().toString(36).slice(-8)),
        role: "VENDOR",
        emailVerified: true,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: { role: "VENDOR", emailVerified: true },
      })
      .returning({ id: users.id });

    const [createdVendor] = await db
      .insert(vendors)
      .values({
        businessName: bName,
        slug,
        contactEmail: emailCandidate,
        status: "approved",
        storeId: sId,
        userId: createdUser?.id,
        address: "Hospital Road, Sagamu, Ogun State",
      })
      .returning({ id: vendors.id });
    vendorId = createdVendor.id;
  }

  // 6. Absolute fallback if no identifier provided at all
  if (vendorId === null) {
    const first = await db.select({ id: vendors.id }).from(vendors).where(eq(vendors.status, "approved")).limit(1);
    vendorId = first[0]?.id ?? null;
  }

  if (vendorId === null) {
    const bName = String(body.storeName || body.vendorName || "My Restaurant");
    const sId = String(body.storeId || `rest-${Date.now()}`);
    const [created] = await db
      .insert(vendors)
      .values({
        businessName: bName,
        slug: `${bName.toLowerCase().replace(/[^a-z0-9]/g, "-").slice(0, 40)}-${Date.now()}`,
        contactEmail: "vendor@chow45.com",
        status: "approved",
        storeId: sId,
        address: "Hospital Road, Sagamu, Ogun State",
      })
      .returning({ id: vendors.id });
    vendorId = created.id;
  }

  const name = String(body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Please give the item a name." }, { status: 400 });
  }

  let category = String(body.category ?? "").trim().toLowerCase();
  if (!category) category = "rice";

  // Normalize common aliases & variations
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

  // Force the price type to match the category so a drink cannot be stored
  // with scoop pricing, and a plated food cannot be stored as per-piece,
  // even if the client sent it.
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

  // Compute effective price for the generic `price` column used for display/sorting
  const effectivePrice = isPiece ? piecePrice : (priceType === 'SCOOP' ? scoopPrice : platePrice) || 0;

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
      price: effectivePrice,
      scoopPrice: isPiece ? null : scoopPrice || null,
      platePrice: isPiece ? null : platePrice || null,
      piecePrice: isPiece ? piecePrice : null,
      status: "pending_verification",
      isPublished: false,
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
        price: effectivePrice,
        scoopPrice: isPiece ? null : scoopPrice || null,
        platePrice: isPiece ? null : platePrice || null,
        piecePrice: isPiece ? piecePrice : null,
        status: "pending_verification",
        isPublished: false,
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
