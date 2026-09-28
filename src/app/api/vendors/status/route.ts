import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { vendorApplications } from "@/db";

/**
 * The status an applicant polls while they wait for a review.
 *
 *   GET /api/vendors/status?applicationId=APL-XXXXXX
 *
 * Publishes nothing the applicant does not own: just the decision and, when it
 * was a rejection, the reason given. Handles are public by design — the point
 * of the handle is that the applicant can type it in on any device — so this
 * route is deliberately unauthenticated.
 */
export async function GET(request: Request) {
  const applicationId = new URL(request.url).searchParams.get("applicationId");

  if (!applicationId || applicationId.length > 64) {
    return NextResponse.json({ error: "Application id is required." }, { status: 400 });
  }

  try {
    const found = await db
      .select()
      .from(vendorApplications)
      .where(eq(vendorApplications.applicationId, applicationId))
      .limit(1);

    const application = found[0];
    if (!application) {
      return NextResponse.json({ error: "No application matches that id." }, { status: 404 });
    }

    return NextResponse.json({
      status: application.status,
      rejectionReason: application.rejectionReason,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Server error" }, { status: 500 });
  }
}