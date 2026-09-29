import { NextResponse } from "next/server";

import { db } from "@/db";
import {
  importLocalState,
  isImportScope,
  type Executor,
  type ImportScope,
} from "@/lib/import-local-state";
import { currentRole, currentUserId } from "@/lib/session";

/**
 * Imports the legacy `chow45_marketplace_state_v2` localStorage blob into
 * Postgres.
 *
 *   POST /api/import
 *     body = {
 *       state: <the parsed localStorage object>,
 *       commit?: boolean,        // default false — dry run
 *       only?: ImportScope[],    // default all of catalog, user, vendor
 *     }
 *
 * The blob lives in one browser, so it cannot be read from a script; it is
 * posted from the console by the admin who holds it:
 *
 *   fetch("/api/import", {
 *     method: "POST",
 *     headers: { "content-type": "application/json" },
 *     body: JSON.stringify({
 *       state: JSON.parse(localStorage.getItem("chow45_marketplace_state_v2")),
 *       commit: true,
 *     }),
 *   }).then((r) => r.json()).then(console.log)
 *
 * Admin-only. The blob is one browser's entire view of the platform, so letting
 * a customer post it would let them write the catalog and every order in it.
 *
 * Per-user rows are attributed to the caller's session, not to anything in the
 * body — the blob has no user identity attached to it, and taking one from the
 * request would let a caller file orders and addresses under someone else.
 */

/** Enough for a blob carrying a full menu and a long order history. */
export const maxDuration = 60;

export async function POST(request: Request) {
  const role = await currentRole(request);
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Admins only." }, { status: 403 });
  }

  const userId = await currentUserId(request);
  if (userId === null) {
    return NextResponse.json({ error: "Your admin session could not be resolved." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const commit = body.commit === true;
  const scopes = readScopes(body.only);

  if (scopes === null) {
    return NextResponse.json(
      { error: '`only` must be an array of "catalog", "user" or "vendor".' },
      { status: 400 },
    );
  }

  if (body.state === null || body.state === undefined) {
    return NextResponse.json({ error: "Missing `state`." }, { status: 400 });
  }

  try {
    // A committed import runs in one transaction: half a catalog with all the
    // orders still pointing at stores that do not exist would be worse than
    // importing nothing. The dry run reads through the pool and writes nothing.
    const report = commit
      ? await db.transaction((tx) =>
          importLocalState(body.state, userId, true, scopes, tx as Executor),
        )
      : await importLocalState(body.state, userId, false, scopes);

    return NextResponse.json({ report });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function readScopes(value: unknown): ImportScope[] | null {
  if (value === undefined || value === null) return ["catalog", "user", "vendor"];
  if (!Array.isArray(value)) return null;
  return value.every(isImportScope) ? (value as ImportScope[]) : null;
}
