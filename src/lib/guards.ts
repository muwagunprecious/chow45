import { userAuth, vendorAuth } from "@/auth";
import { db } from "@/db";
import { vendors } from "@/db/schema/vendors";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";

   function createGuard(authInstance: typeof userAuth, role: "USER" | "VENDOR") {
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
       return { authorized: true as const, user: session.user };
     };
   }
   export const requireUser = createGuard(userAuth, "USER");
   export const requireVendor = createGuard(vendorAuth, "VENDOR");