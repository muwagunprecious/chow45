import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/db';

export async function GET() {
  const start = Date.now();
  try {
    await db.execute(sql`SELECT 1`);
    const latency = Date.now() - start;
    return NextResponse.json({
      status: 'ok',
      database: 'connected',
      latencyMs: latency,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        status: 'error',
        database: 'disconnected',
        error: err?.message,
      },
      { status: 503 }
    );
  }
}
