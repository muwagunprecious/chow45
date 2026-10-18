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
  title: 'Chow45 Vendor | My Food & Restaurant Dashboard',
  description: 'Manage your restaurant menu, food items, extras, and live orders on Chow45.',
};

export default async function VendorPage() {
  const reqHeaders = await headers();
  const dummyReq = new Request('http://localhost:3000/vendor', { headers: reqHeaders });
  const resolved = await resolveSessionUser(dummyReq);

  if (resolved) {
    const userId = resolved.userId;
    const email = (resolved.user.email || '').toLowerCase().trim();
    const isAdmin = String(resolved.user.role || '').toUpperCase() === 'ADMIN';

    // Verify if this user has an approved vendor record in vendors table
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

    const isVendor = vendorRows.length > 0 || isAdmin;

    if (!isVendor) {
      // User is logged in as a customer or rider. Prevent account role hijacking.
      redirect('/app?notice=not_a_vendor');
    }
  }

  return <MarketplaceView initialRole="vendor" initialTab="food" />;
}

