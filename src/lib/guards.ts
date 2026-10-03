import { userAuth, vendorAuth, riderAuth } from "@/auth";
import { db, riders } from "@/db";
import { vendors } from "@/db/schema/vendors";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";

   function createGuard(authInstance: typeof userAuth, role: "USER" | "VENDOR" | "RIDER") {
     return async function guard() {
       const session = await authInstance.api.getSession({ headers: await headers() });
       if (!session || session.user.role !== role) return { authorized: false as const };
       
       if (role === "VENDOR") {
      const vendor = await db.query.vendors.findFirst({
        where: eq(vendors.userId, Number(session.user.id)),
      }); 
      if (!vendor) return { authorized: false as const };
      return { authorized: true as const, user: session.user, vendor };
    }

      if(role === "RIDER") {
         const rider = await db.query.riders.findFirst({
            where: eq (riders.userId, Number(session.user.id)),
         });
        if (!rider) return { authorized: false as const };
  return { authorized: true as const, user: session.user, rider };
      }
     
       return { authorized: true as const, user: session.user };
     };
   }
   export const requireUser = createGuard(userAuth, "USER");
   export const requireVendor = createGuard(vendorAuth, "VENDOR");
   export const requireRider = createGuard(riderAuth, "RIDER");