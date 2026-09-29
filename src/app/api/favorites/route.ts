import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { favorites } from "@/db";
import { currentUserId } from "@/lib/session";
import { readClientId } from "@/lib/validation";
import { serializeFavorites } from "@/lib/serializers";

/**
 * Saved foods and stores.
 *
 *   POST /api/favorites   { targetType, targetId }
 *
 * A toggle rather than separate add and remove endpoints, because the client
 * never knows which of the two it needs. The response always returns the full
 * pair of lists so the caller does not have to keep its own count in step.
 *
 * The unique index on (userId, targetType, targetId) is what makes the toggle
 * safe: two rapid taps cannot leave two identical rows behind.
 */

const TARGET_TYPES = new Set(["food", "store"]);

export async function POST(request: Request) {
  const userId = await currentUserId(request);
  if (userId === null) {
    return NextResponse.json({ error: "Sign in to save items." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const targetType = String(body.targetType ?? "");
  const targetId = readClientId(body.targetId);

  if (!TARGET_TYPES.has(targetType) || targetId === null) {
    return NextResponse.json({ error: "Unknown favourite." }, { status: 400 });
  }

  try {
    const removed = await db
      .delete(favorites)
      .where(
        and(
          eq(favorites.userId, userId),
          eq(favorites.targetType, targetType),
          eq(favorites.targetId, targetId),
        ),
      )
      .returning({ id: favorites.id });

    // Nothing was deleted, so this was an add.
    if (removed.length === 0) {
      await db
        .insert(favorites)
        .values({ userId, targetType, targetId })
        .onConflictDoNothing();
    }

    const rows = await db.select().from(favorites).where(eq(favorites.userId, userId));
    const serialized = serializeFavorites(rows);

    return NextResponse.json({
      favorites: serialized,
      added: removed.length === 0,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const userId = await currentUserId(request);
  if (userId === null) {
    return NextResponse.json({ favorites: { foods: [], stores: [] } });
  }

  const rows = await db.select().from(favorites).where(eq(favorites.userId, userId));
  return NextResponse.json({ favorites: serializeFavorites(rows) });
}
