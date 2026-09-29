import { NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { db } from '@/db';
import { waitlist } from '@/db/schema/waitlist';

export async function GET() {
  try {
    const entries = await db
      .select()
      .from(waitlist)
      .orderBy(desc(waitlist.createdAt));

    const csvRows = [
      ['ID', 'Name', 'Email', 'Phone', 'Role', 'Department', 'Joined Date'].join(','),
      ...entries.map((e) =>
        [
          e.id,
          `"${(e.name || '').replace(/"/g, '""')}"`,
          `"${(e.email || '').replace(/"/g, '""')}"`,
          `"${(e.phone || '').replace(/"/g, '""')}"`,
          `"${(e.userType || '').replace(/"/g, '""')}"`,
          `"${(e.department || '').replace(/"/g, '""')}"`,
          `"${e.createdAt ? new Date(e.createdAt).toISOString() : ''}"`,
        ].join(',')
      ),
    ];

    const csvContent = csvRows.join('\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="chow45-waitlist-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error: any) {
    console.error('Failed to export waitlist CSV:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to export CSV' },
      { status: 500 }
    );
  }
}
