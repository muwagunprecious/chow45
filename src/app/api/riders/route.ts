import { NextResponse } from "next/server";
import { db,riders } from "@/db";
import { and, eq } from "drizzle-orm";
import { serializeRider } from "@/lib/serializers";

export async function GET(){
    try{
        const onlineRiders = await db.select().from(riders).where(and(
            eq(riders.isOnline, true),
            eq(riders.isAvailable, true)
        ));

        return NextResponse.json({ riders:
            onlineRiders.map(serializeRider)
        });
    } catch (error: any){
        return NextResponse.json({ error: error.message || "Failed to fetch riders" }, { status: 500 });
    }
} 