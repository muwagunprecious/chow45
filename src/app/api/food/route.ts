import { db, menuItems, vendors } from "@/db";
import { requireUser } from "@/lib/guards";
import { NextResponse } from "next/server";
import { eq, and, inArray  } from "drizzle-orm";

const VALID_LOCATIONS = ["ibogun", "sagamu"] as const;
type Location = typeof VALID_LOCATIONS[number];

export async function GET(req: Request) {
    //User Authentication
    const check = await requireUser();

    if(!check.authorized ){
        return NextResponse.json( {error: "Unauthorized"}, {status:401});
    }

    //Parsing query params
    const { searchParams } = new URL(req.url);
    const locationParam = searchParams.get("location")?.toLowerCase().trim();
    const categoryFilter = searchParams.get("category");

    if (!locationParam || !VALID_LOCATIONS.includes(locationParam as Location)){
        return NextResponse.json(
            {
                error: "A valid location is required: 'ibogun' or 'sagamu'"
            },
            {
                status: 400
            }
        );
    }
    
    try{
        //Finding approved and open vendors in user location
        const matchedVendors = await db.query.vendors.findMany({
            where: and(
                eq(vendors.status, "approved"),
                eq(vendors.isOpen, true),
                eq(vendors.locationOfOperation, `%${locationParam}%`)
 ),
        });

        if(matchedVendors.length === 0){
           return NextResponse.json(
                { success: true,
                    count: 0,
                    data: [],
                    message: `No active restaurants found in ${locationParam}.`
                }
            )
        }

        const vendorIds = matchedVendors.map((v) => v.id);

        //Fetching available menu items for available vendors
        const whereCondition = categoryFilter ? and(
            inArray(menuItems.vendorId, vendorIds),
            eq(menuItems.status, "AVAILABLE"),
            eq(menuItems.category, categoryFilter)
        ) : and ( 
             inArray(menuItems.vendorId, vendorIds),
             eq(menuItems.status, "AVAILABLE")
        );

        const items = await db.query.menuItems.findMany({ where: whereCondition,
          with: {
             sizes: true,
             extras: true,
        },
    });
    
    //Attaching vendor details to each food item
    const vendorMap = new Map(matchedVendors.map((v) => [v.id,v]));
    const results = items.map((dish) => {
        const vendor = vendorMap.get(dish.vendorId);
         return{
            ...dish,
            vendor: {
                id: vendor?.id,
                storeId: vendor?.storeId,
                name: vendor?.businessName,
                rating: vendor?.rating,
                prepTime: vendor?.prepTime,
                deliveryFee: vendor?.deliveryFee,
                address: vendor?.address,
            }
         }
    });

     return NextResponse.json({
        success: true,
        location: locationParam,
        count: results.length,
        data: results,
     });
    } catch(error: any) {
        return NextResponse.json(
            { error: "Failed to fetch food items", details: error.message},
            {status: 500}
        );
    }
}

