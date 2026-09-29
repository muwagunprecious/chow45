import { NextResponse } from 'next/server';
import { desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db';
import { menuItems } from '@/db/schema/menu-items';
import { menuItemSizes } from '@/db/schema/menu-item-sizes';
import { menuExtras } from '@/db/schema/menu-extras';
import { vendors } from '@/db/schema/vendors';

export async function GET() {
  try {
    // 1. Fetch all menu items joined with vendor business name & vendor details
    const items = await db
      .select({
        id: menuItems.id,
        vendorId: menuItems.vendorId,
        vendorName: vendors.businessName,
        vendorImage: vendors.image,
        vendorPhone: vendors.ownerPhone,
        vendorEmail: vendors.contactEmail,
        name: menuItems.name,
        description: menuItems.description,
        imageUrl: menuItems.imageUrl,
        category: menuItems.category,
        priceType: menuItems.priceType,
        price: menuItems.price,
        scoopPrice: menuItems.scoopPrice,
        platePrice: menuItems.platePrice,
        piecePrice: menuItems.piecePrice,
        status: menuItems.status,
        isPublished: menuItems.isPublished,
        preorderEnabled: menuItems.preorderEnabled,
        preorderDate: menuItems.preorderDate,
        preorderTime: menuItems.preorderTime,
        createdAt: menuItems.createdAt,
      })
      .from(menuItems)
      .leftJoin(vendors, eq(menuItems.vendorId, vendors.id))
      .orderBy(desc(menuItems.createdAt));

    // 2. Fetch sizes & extras for these items if any exist
    const itemIds = items.map((i) => i.id);
    let sizes: any[] = [];
    let extras: any[] = [];

    if (itemIds.length > 0) {
      sizes = await db
        .select()
        .from(menuItemSizes)
        .where(inArray(menuItemSizes.menuItemId, itemIds));

      extras = await db
        .select()
        .from(menuExtras)
        .where(inArray(menuExtras.menuItemId, itemIds));
    }

    // Attach sizes and extras
    const enrichedItems = items.map((item) => ({
      ...item,
      sizes: sizes.filter((s) => s.menuItemId === item.id),
      extras: extras.filter((e) => e.menuItemId === item.id),
    }));

    // 3. Fetch all vendors for the filter dropdown
    const allVendors = await db
      .select({
        id: vendors.id,
        businessName: vendors.businessName,
        status: vendors.status,
      })
      .from(vendors)
      .orderBy(vendors.businessName);

    // 4. Calculate stats
    const totalItems = enrichedItems.length;
    const vendorSet = new Set(enrichedItems.map((i) => i.vendorId).filter(Boolean));
    const availableItems = enrichedItems.filter(
      (i) => (i.status || '').toLowerCase() === 'available'
    ).length;
    const outOfStockItems = enrichedItems.filter(
      (i) => (i.status || '').toLowerCase().includes('out_of_stock')
    ).length;

    const stats = {
      totalItems,
      activeVendorsWithItems: vendorSet.size,
      totalRegisteredVendors: allVendors.length,
      availableItems,
      outOfStockItems,
    };

    return NextResponse.json({
      success: true,
      items: enrichedItems,
      vendors: allVendors,
      stats,
    });
  } catch (error: any) {
    console.error('Failed to fetch admin food items:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch food items' },
      { status: 500 }
    );
  }
}
