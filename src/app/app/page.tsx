import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolveSessionUser } from '@/lib/session';
import { db } from '@/db';
import { vendors } from '@/db/schema/vendors';
import { eq, or, sql } from 'drizzle-orm';
import MarketplaceView from '@/components/marketplace/marketplace-view';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Chow45 Marketplace | Order, Sell & Deliver Food',
  description: 'Food ordering, vendor kitchens, and rider dispatch across Lagos & Sagamu.',
};

export default async function AppPage() {
  const reqHeaders = await headers();
  const dummyReq = new Request('http://localhost:3000/app', { headers: reqHeaders });
  const resolved = await resolveSessionUser(dummyReq);

  if (resolved) {
    const userId = resolved.userId;
    const email = (resolved.user.email || '').toLowerCase().trim();
    const roleUpper = String(resolved.user.role || '').toUpperCase();

    // Vendors must NOT have access to the customer /app section.
    if (roleUpper === 'VENDOR') {
      redirect('/vendor');
    }

    // Also check if this user has an active vendor storefront in the database.
    const vendorRows = await db
      .select({ id: vendors.id })
      .from(vendors)
      .where(
        or(
          eq(vendors.userId, userId),
          email ? sql`LOWER(${vendors.contactEmail}) = ${email}` : sql`1 = 0`
        )
      )
      .limit(1);

    if (vendorRows.length > 0) {
      redirect('/vendor');
    }
  }

  return <MarketplaceView initialRole="customer" />;
}
