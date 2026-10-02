import { NextResponse } from "next/server";
import { db,riders } from "@/db";
import { and, eq, ilike } from "drizzle-orm";
import { serializeRider } from "@/lib/serializers";

export async function GET(req: Request){
    try{
        const { searchParams } = new URL(req.url);
        const location = searchParams.get("location")?.toLowerCase().trim();

        const conditions = [
            eq(riders.isOnline, true),
            eq(riders.isAvailable, true),
        ];

        //Filtering by location
        if(location){
            conditions.push(ilike(riders.location, `%${location}%`));
        }

        const onlineRiders = await db
        .select()
        .from(riders)
        .where(and(...conditions));

        return NextResponse.json({ 
            success: true,
            count: onlineRiders.length,
            riders:onlineRiders.map(serializeRider)
        });
    } catch (error: any){
        return NextResponse.json({ error: error.message || "Failed to fetch riders" }, { status: 500 });
    }
} 