import { NextResponse } from 'next/server';
import { desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '@/db';
import { menuItems } from '@/db/schema/menu-items';
import { menuItemSizes } from '@/db/schema/menu-item-sizes';
import { menuExtras } from '@/db/schema/menu-extras';
import { vendors } from '@/db/schema/vendors';
import { users } from '@/db/schema/users';

export async function GET() {
  try {
    // 1. Fetch ALL menu items joined with vendor business name & vendor details
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

    // 3. Fetch ALL vendors from vendors table (regardless of food uploads)
    const vendorRows = await db
      .select({
        id: vendors.id,
        businessName: vendors.businessName,
        contactEmail: vendors.contactEmail,
        ownerPhone: vendors.ownerPhone,
        ownerName: vendors.ownerName,
        status: vendors.status,
        storeId: vendors.storeId,
        userId: vendors.userId,
        source: vendors.source,
        image: vendors.image,
        address: vendors.address,
        createdAt: vendors.createdAt,
      })
      .from(vendors)
      .orderBy(vendors.businessName);

    // 4. Fetch ALL users with VENDOR role who may not have a vendors row yet
    const vendorUsers = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        emailVerified: users.emailVerified,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(sql`LOWER(${users.role}) = 'vendor'`)
      .orderBy(users.createdAt);

    // 5. Build a merged vendor list:
    //    - Start with all vendors rows
    //    - Add any VENDOR-role users who don't have a vendors row (userId not in vendors)
    const linkedUserIds = new Set(vendorRows.map((v) => v.userId).filter(Boolean));

    const orphanVendorUsers = vendorUsers
      .filter((u) => !linkedUserIds.has(u.id))
      .map((u) => ({
        id: null as number | null,
        businessName: u.name || u.email.split('@')[0],
        contactEmail: u.email,
        ownerPhone: null,
        ownerName: u.name,
        status: 'no_profile' as string,
        storeId: null,
        userId: u.id,
        source: 'user_signup',
        image: null,
        address: null,
        createdAt: u.createdAt,
        _isUserOnly: true,
      }));

    // Merge: real vendor rows + orphan vendor users
    const allVendorsList = [
      ...vendorRows.map((v) => ({
        ...v,
        _isUserOnly: false,
        // Attach the linked user's email if the vendor has a userId but no contactEmail
        contactEmail: v.contactEmail || vendorUsers.find((u) => u.id === v.userId)?.email || null,
      })),
      ...orphanVendorUsers,
    ];

    // For the filter dropdown in the admin page (keeps backward compat)
    const allVendorsForFilter = allVendorsList.map((v) => ({
      id: v.id ?? -1,
      businessName: v.businessName || 'Unknown Vendor',
      contactEmail: v.contactEmail,
      ownerPhone: v.ownerPhone || null,
      ownerName: v.ownerName || null,
      status: v.status,
      storeId: v.storeId || null,
      userId: v.userId || null,
      image: v.image || null,
      address: v.address || null,
      createdAt: v.createdAt,
      _isUserOnly: v._isUserOnly,
    }));

    // 6. Calculate stats
    const totalItems = enrichedItems.length;
    const vendorSet = new Set(enrichedItems.map((i) => i.vendorId).filter(Boolean));
    const pendingItems = enrichedItems.filter(
      (i) => (i.status || '').toLowerCase() === 'pending_verification' || !i.isPublished
    ).length;
    const approvedItems = enrichedItems.filter(
      (i) => (i.status || '').toLowerCase() === 'available' && i.isPublished
    ).length;
    const rejectedItems = enrichedItems.filter(
      (i) => (i.status || '').toLowerCase() === 'rejected'
    ).length;
    const outOfStockItems = enrichedItems.filter(
      (i) => (i.status || '').toLowerCase().includes('out_of_stock')
    ).length;

    const stats = {
      totalItems,
      activeVendorsWithItems: vendorSet.size,
      totalRegisteredVendors: allVendorsList.length,
      availableItems: approvedItems,
      pendingItems,
      approvedItems,
      rejectedItems,
      outOfStockItems,
    };

    return NextResponse.json({
      success: true,
      items: enrichedItems,
      vendors: allVendorsForFilter,
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

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { id, action, status, isPublished } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Food item ID is required' },
        { status: 400 }
      );
    }

    let nextStatus = status;
    let nextPublished = typeof isPublished === 'boolean' ? isPublished : undefined;

    if (action === 'approve') {
      nextStatus = 'available';
      nextPublished = true;
    } else if (action === 'reject') {
      nextStatus = 'rejected';
      nextPublished = false;
    } else if (action === 'pending') {
      nextStatus = 'pending_verification';
      nextPublished = false;
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (nextStatus !== undefined) updateData.status = nextStatus;
    if (nextPublished !== undefined) updateData.isPublished = nextPublished;

    const updated = await db
      .update(menuItems)
      .set(updateData)
      .where(eq(menuItems.id, id))
      .returning();

    if (!updated.length) {
      return NextResponse.json(
        { success: false, error: 'Food item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      item: updated[0],
      message:
        action === 'approve'
          ? 'Food item approved and published to marketplace'
          : action === 'reject'
          ? 'Food item rejected'
          : 'Food item marked as pending verification',
    });
  } catch (error: any) {
    console.error('Failed to update food status:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to update food item' },
      { status: 500 }
    );
  }
}
