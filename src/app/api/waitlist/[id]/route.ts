import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { waitlist } from '@/db/schema/waitlist';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    await db.delete(waitlist).where(eq(waitlist.id, numericId));

    return NextResponse.json({ success: true, message: 'Entry deleted' });
  } catch (error: any) {
    console.error('Failed to delete waitlist entry:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to delete entry' },
      { status: 500 }
    );
  }
}
