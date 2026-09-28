CREATE TABLE "addresses" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"label" varchar(60),
	"address" text NOT NULL,
	"formatted_address" text,
	"latitude" numeric(9, 6) NOT NULL,
	"longitude" numeric(9, 6) NOT NULL,
	"lga" varchar(100),
	"state" varchar(100),
	"place_id" varchar(255),
	"delivery_instructions" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"cart_id" bigint NOT NULL,
	"menu_item_id" varchar(64),
	"name" varchar(255) NOT NULL,
	"img" text,
	"unit_price" integer DEFAULT 0 NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	"item_total" integer DEFAULT 0 NOT NULL,
	"selected_addons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"vendor_id" bigint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"target_type" varchar(20) NOT NULL,
	"target_id" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_configs" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"base_fee" integer DEFAULT 300 NOT NULL,
	"service_fee" integer DEFAULT 400 NOT NULL,
	"rate_per_meter" real DEFAULT 0.15 NOT NULL,
	"min_delivery_fee" integer DEFAULT 300 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_locations" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"latitude" numeric(9, 6) NOT NULL,
	"longitude" numeric(9, 6) NOT NULL,
	"city" varchar(100),
	"type" varchar(30),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_zones" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"state" varchar(100),
	"lga" varchar(100),
	"center" jsonb NOT NULL,
	"max_delivery_distance" integer DEFAULT 3000 NOT NULL,
	"delivery_rules" jsonb NOT NULL,
	"operating_hours" jsonb NOT NULL,
	"polygon" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "state_boundaries" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"polygon" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"order_id" varchar(32) NOT NULL,
	"status" varchar(30) NOT NULL,
	"note" text,
	"actor" varchar(30) DEFAULT 'system' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"order_id" varchar(32) NOT NULL,
	"menu_item_id" varchar(64),
	"name" varchar(255) NOT NULL,
	"qty" integer DEFAULT 1 NOT NULL,
	"unit_price" integer DEFAULT 0 NOT NULL,
	"item_total" integer DEFAULT 0 NOT NULL,
	"selected_addons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" varchar(32) PRIMARY KEY NOT NULL,
	"user_id" bigint NOT NULL,
	"vendor_id" bigint,
	"store_id" varchar(64) NOT NULL,
	"store_name" varchar(255) NOT NULL,
	"customer_name" varchar(255) NOT NULL,
	"customer_phone" varchar(20),
	"delivery_address" text NOT NULL,
	"delivery_notes" text,
	"delivery_location" jsonb,
	"payment_method" varchar(100),
	"subtotal" integer NOT NULL,
	"service_fee" integer DEFAULT 0 NOT NULL,
	"delivery_fee" integer DEFAULT 0 NOT NULL,
	"total" integer NOT NULL,
	"status" varchar(30) DEFAULT 'PAID' NOT NULL,
	"rider_id" varchar(64),
	"rider_name" varchar(255),
	"pin" varchar(4),
	"route_distance_meters" integer,
	"estimated_duration_seconds" integer,
	"rating" integer,
	"review_comment" text,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "riders" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"user_id" bigint,
	"name" varchar(255) NOT NULL,
	"phone" varchar(20),
	"vehicle" varchar(255),
	"avatar" text,
	"rating" real DEFAULT 5 NOT NULL,
	"trips_count" integer DEFAULT 0 NOT NULL,
	"is_online" boolean DEFAULT false NOT NULL,
	"is_available" boolean DEFAULT false NOT NULL,
	"current_lat" numeric(9, 6),
	"current_lng" numeric(9, 6),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "riders_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "disputes" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"order_id" varchar(32) NOT NULL,
	"user_id" bigint,
	"reason" varchar(100) NOT NULL,
	"details" text,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"resolution" text,
	"resolved_by" bigint,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "platform_ledgers" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"total_gmv" integer DEFAULT 0 NOT NULL,
	"total_service_fees" integer DEFAULT 0 NOT NULL,
	"completed_deliveries" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_applications" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"application_id" varchar(64) NOT NULL,
	"user_id" bigint,
	"business_name" varchar(255) NOT NULL,
	"owner_name" varchar(255),
	"owner_email" varchar(255),
	"owner_phone" varchar(20),
	"address" text,
	"lga" varchar(100),
	"pickup_lat" numeric(9, 6),
	"pickup_lng" numeric(9, 6),
	"cuisine" varchar(100),
	"opening_time" varchar(50),
	"closing_time" varchar(50),
	"cover_image" text,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"reviewed_by" bigint,
	"reviewed_at" timestamp with time zone,
	"vendor_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_applications_application_id_unique" UNIQUE("application_id")
);
--> statement-breakpoint
CREATE TABLE "vendor_wallets" (
	"vendor_id" bigint PRIMARY KEY NOT NULL,
	"available" integer DEFAULT 0 NOT NULL,
	"processing" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_withdrawals" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"vendor_id" bigint NOT NULL,
	"amount" integer NOT NULL,
	"bank_name" varchar(120),
	"account_number" varchar(20),
	"status" varchar(20) DEFAULT 'processing' NOT NULL,
	"paid_out_at" timestamp with time zone,
	"expected_pay_date" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vendors" DROP CONSTRAINT "vendors_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "vendors" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
-- `store_id` and `slug` are the public identifiers of a storefront and both are
-- NOT NULL, but `vendors` already holds rows, so they are added nullable,
-- backfilled from the existing id and business name, then tightened. A bare
-- ADD COLUMN ... NOT NULL would fail outright on a non-empty table.
ALTER TABLE "vendors" ADD COLUMN "store_id" varchar(64);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "slug" varchar(255);--> statement-breakpoint
UPDATE "vendors" SET "store_id" = 'rest-legacy-' || "id"::text WHERE "store_id" IS NULL;--> statement-breakpoint
UPDATE "vendors" SET "slug" = COALESCE(NULLIF(lower(regexp_replace("business_name", '[^a-zA-Z0-9]+', '-', 'g')), ''), 'store-' || "id"::text) WHERE "slug" IS NULL;--> statement-breakpoint
ALTER TABLE "vendors" ALTER COLUMN "store_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ALTER COLUMN "slug" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "cuisine" varchar(100);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "owner_name" varchar(255);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "owner_phone" varchar(20);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "banner_image" text;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "rating" real DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "reviews_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "prep_time" varchar(50);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "delivery_fee" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "opening_time" varchar(50);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "closing_time" varchar(50);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "is_open" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "is_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "is_budget" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "is_recommended" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "is_popular" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "is_fast" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "category" varchar(100);--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "tags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "vendors" ADD COLUMN "source" varchar(20) DEFAULT 'vendor' NOT NULL;--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_rider_id_riders_id_fk" FOREIGN KEY ("rider_id") REFERENCES "public"."riders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "riders" ADD CONSTRAINT "riders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_applications" ADD CONSTRAINT "vendor_applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_applications" ADD CONSTRAINT "vendor_applications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_applications" ADD CONSTRAINT "vendor_applications_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_wallets" ADD CONSTRAINT "vendor_wallets_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_withdrawals" ADD CONSTRAINT "vendor_withdrawals_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "addresses_user_id_idx" ON "addresses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cart_items_cart_id_idx" ON "cart_items" USING btree ("cart_id");--> statement-breakpoint
CREATE UNIQUE INDEX "carts_user_id_idx" ON "carts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "favorites_user_target_idx" ON "favorites" USING btree ("user_id","target_type","target_id");--> statement-breakpoint
CREATE INDEX "favorites_user_id_idx" ON "favorites" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "order_events_order_id_idx" ON "order_events" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_order_id_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_user_id_idx" ON "orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orders_vendor_id_idx" ON "orders" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "orders_rider_id_idx" ON "orders" USING btree ("rider_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "disputes_order_id_idx" ON "disputes" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "disputes_status_idx" ON "disputes" USING btree ("status");--> statement-breakpoint
CREATE INDEX "vendor_applications_user_id_idx" ON "vendor_applications" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "vendor_applications_status_idx" ON "vendor_applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "vendor_withdrawals_vendor_id_idx" ON "vendor_withdrawals" USING btree ("vendor_id");--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_store_id_unique" UNIQUE("store_id");--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_slug_unique" UNIQUE("slug");--> statement-breakpoint
-- `delivery_configs` and `platform_ledgers` are single-row tables. The id
-- default of 1 is not enough to keep them that way, because a caller can pass
-- an explicit id, so the check constraint pins it.
ALTER TABLE "delivery_configs" ADD CONSTRAINT "delivery_configs_singleton" CHECK ("id" = 1);--> statement-breakpoint
ALTER TABLE "platform_ledgers" ADD CONSTRAINT "platform_ledgers_singleton" CHECK ("id" = 1);