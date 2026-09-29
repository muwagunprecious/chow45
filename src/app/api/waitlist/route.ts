import { NextResponse } from 'next/server';
import { desc, sql } from 'drizzle-orm';
import { db } from '@/db';
import { waitlist } from '@/db/schema/waitlist';

export async function GET() {
  try {
    const entries = await db
      .select()
      .from(waitlist)
      .orderBy(desc(waitlist.createdAt));

    let students = 0;
    let vendors = 0;
    let staff = 0;
    let others = 0;
    let today = 0;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    for (const entry of entries) {
      const role = (entry.userType || '').toLowerCase();
      if (role.includes('student')) {
        students++;
      } else if (role.includes('vendor')) {
        vendors++;
      } else if (role.includes('staff')) {
        staff++;
      } else {
        others++;
      }

      if (entry.createdAt && new Date(entry.createdAt) >= todayStart) {
        today++;
      }
    }

    const stats = {
      total: entries.length,
      students,
      vendors,
      staff,
      others,
      today,
    };

    return NextResponse.json({
      success: true,
      entries,
      stats,
    });
  } catch (error: any) {
    console.error('Failed to fetch waitlist:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to fetch waitlist' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const phone = String(body.phone || '').trim();
    const userType = String(body.user_type || body.userType || 'Student').trim();
    const department = String(body.department || '').trim();

    if (!name || !email) {
      return NextResponse.json(
        { success: false, error: 'Name and email are required.' },
        { status: 400 }
      );
    }

    const [newEntry] = await db
      .insert(waitlist)
      .values({
        name,
        email,
        phone: phone || null,
        userType: userType || 'Student',
        department: department || null,
      })
      .returning();

    return NextResponse.json({
      success: true,
      message: 'Added to waitlist successfully',
      data: newEntry,
    });
  } catch (error: any) {
    console.error('Failed to process waitlist entry:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Failed to process waitlist request' },
      { status: 500 }
    );
  }
}
