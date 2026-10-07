import { NextResponse } from "next/server";
import { db, orders, riders} from "@/db";
import { and, eq, ilike} from "drizzle-orm";
import { serializeOrder } from "@/lib/serializers";
import { currentRole, currentUserId } from "@/lib/session";
import { requireUser, requireRider, requireVendor } from "@/lib/guards";

/* 
Provides the live location of a rider assigned to an order 
in currentLng and currentLat
*/


export async function GET(req: Request, { params }: { params: { id: string } }) {
    try{
  const orderId = params.id;

  const found = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  const order = found[0];

  if (!order) {
    return NextResponse.json({ error: "Order not found." }, { status: 404 });
  }

  const orderRiderId = order.riderId;

  let isAuthorized = false;

  const role = await currentRole(req);
  if (role === "ADMIN") {
    isAuthorized = true;
  }

  if (!isAuthorized) {
    const auth = await requireUser();

    if (auth.authorized) {
      const userId = Number(auth.user.id);
      if (userId === order.userId) {
        isAuthorized = true;
      }
    }
  }

  if (!isAuthorized) {
    const auth = await requireVendor();

    if (auth.authorized && auth.vendor?.id && order.vendorId) {
      if (auth.vendor.id === order.vendorId) {
        isAuthorized = true;
      }
    }
  }

  if (!isAuthorized) {
    const auth = await requireRider();
    const riderId = auth.rider?.id;

    if (auth.authorized && riderId && orderRiderId && riderId === orderRiderId) {
      isAuthorized = true;
    }
  }

  if (!isAuthorized) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

   if (!orderRiderId) {
    return NextResponse.json({ rider: null }, { status: 200 });
  }

  const orderRider = await db
    .select()
    .from(riders)
    .where(eq(riders.id, orderRiderId))
    .limit(1);


  return Response.json({ riderLat: orderRider[0].currentLat, riderLng: orderRider[0].currentLng });
} catch(error){
    return Response.json({ error: "Something went wrong"}, {status: 500})
}

}
