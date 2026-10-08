import { NextResponse } from "next/server";
import { db,riders } from "@/db";
import { and, eq, ilike } from "drizzle-orm";
import { serializeRider } from "@/lib/serializers";

export async function GET(req: Request){
    try{
        const { searchParams } = new URL(req.url);
        const location = searchParams.get("location")?.toLowerCase().trim();
        const showAll = searchParams.get("all") === "true" || searchParams.get("status") === "all";

        const conditions = [];
        if (!showAll) {
            conditions.push(eq(riders.isOnline, true));
            conditions.push(eq(riders.isAvailable, true));
        }

        //Filtering by location
        if(location && location !== "all"){
            conditions.push(ilike(riders.location, `%${location}%`));
        }

        const onlineRiders = await db
        .select()
        .from(riders)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

        return NextResponse.json({ 
            success: true,
            count: onlineRiders.length,
            riders:onlineRiders.map(serializeRider)
        });
    } catch (error: any){
        return NextResponse.json({ error: error.message || "Failed to fetch riders" }, { status: 500 });
    }
} 