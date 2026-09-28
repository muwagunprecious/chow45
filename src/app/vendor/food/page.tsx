import type { Metadata } from 'next';
import MarketplaceView from '@/components/marketplace/marketplace-view';

export const metadata: Metadata = {
  title: 'My Food | Chow45 Vendor Menu',
  description: 'Add and manage the food you sell on Chow45.',
};

export default function VendorFoodPage() {
  return <MarketplaceView initialRole="vendor" initialTab="food" />;
}
