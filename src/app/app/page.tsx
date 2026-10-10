import type { Metadata } from 'next';
import MarketplaceView from '@/components/marketplace/marketplace-view';

export const metadata: Metadata = {
  title: 'Chow45 Marketplace | Order, Sell & Deliver Food',
  description: 'Food ordering, vendor kitchens, and rider dispatch across Lagos & Sagamu.',
};

export default function AppPage() {
  return <MarketplaceView initialRole="customer" />;
}
