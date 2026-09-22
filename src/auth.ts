import "server-only";
import { betterAuth} from "better-auth";
import {drizzleAdapter} from "better-auth/adapters/drizzle";
import { db } from './db';
import { nanoid } from "nanoid";
import * as schema from "./db/schema/users";

export const auth = betterAuth({
    baseURL: process.env.BASE_AUTH_URL,
    secret: process.env.BASE_AUTH_SECRET,

    databaseHooks:{
        user:{
           create:{
            before: async (user) => ({
                data: {...user, publicId: nanoid()},
            })
           }
        }
    },
    advanced: {
        database:{
      generateId: false
    }
    },

    database: drizzleAdapter(db, {
        provider: "pg",
        schema
    }),
    emailAndPassword: {enabled: true},
    socialProviders: {
        google: {
        clientId: process.env.GOOGLE_CLIENT_ID!,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET!
    },
},
    user: {
        additionalFields: {
            role: { type: "string", input: false}, 
        },
    },
});

