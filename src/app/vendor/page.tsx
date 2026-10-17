import type { Metadata } from 'next';
import MarketplaceView from '@/components/marketplace/marketplace-view';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Chow45 Vendor | My Food & Restaurant Dashboard',
  description: 'Manage your restaurant menu, food items, extras, and live orders on Chow45.',
};

export default function VendorPage() {
  return <MarketplaceView initialRole="vendor" initialTab="food" />;
}

