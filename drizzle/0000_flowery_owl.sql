CREATE TABLE IF NOT EXISTS "airtable_account" (
	"user_id" text NOT NULL,
	"type" text NOT NULL,
	"provider" text NOT NULL,
	"provider_account_id" text NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"expires_at" integer,
	"token_type" text,
	"scope" text,
	"id_token" text,
	"session_state" text,
	CONSTRAINT "airtable_account_provider_provider_account_id_pk" PRIMARY KEY("provider","provider_account_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "airtable_base" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "airtable_column" (
	"id" text PRIMARY KEY NOT NULL,
	"table_id" text NOT NULL,
	"name" text NOT NULL,
	"type" text DEFAULT 'text' NOT NULL,
	"order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "airtable_row" (
	"id" text PRIMARY KEY NOT NULL,
	"table_id" text NOT NULL,
	"row_order" integer DEFAULT 0 NOT NULL,
	"cells" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "airtable_session" (
	"session_token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "airtable_table" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"base_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "airtable_user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text,
	"email" text NOT NULL,
	"email_verified" timestamp,
	"image" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "airtable_verification_token" (
	"identifier" text NOT NULL,
	"token" text NOT NULL,
	"expires" timestamp NOT NULL,
	CONSTRAINT "airtable_verification_token_identifier_token_pk" PRIMARY KEY("identifier","token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "airtable_view" (
	"id" text PRIMARY KEY NOT NULL,
	"table_id" text NOT NULL,
	"name" text NOT NULL,
	"config" jsonb DEFAULT '{"filters":[],"sorts":[],"hiddenColumns":[],"searchQuery":""}'::jsonb NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "airtable_account" ADD CONSTRAINT "airtable_account_user_id_airtable_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."airtable_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "airtable_base" ADD CONSTRAINT "airtable_base_user_id_airtable_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."airtable_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "airtable_column" ADD CONSTRAINT "airtable_column_table_id_airtable_table_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."airtable_table"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "airtable_row" ADD CONSTRAINT "airtable_row_table_id_airtable_table_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."airtable_table"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "airtable_session" ADD CONSTRAINT "airtable_session_user_id_airtable_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."airtable_user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "airtable_table" ADD CONSTRAINT "airtable_table_base_id_airtable_base_id_fk" FOREIGN KEY ("base_id") REFERENCES "public"."airtable_base"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "airtable_view" ADD CONSTRAINT "airtable_view_table_id_airtable_table_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."airtable_table"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "account_user_id_idx" ON "airtable_account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "base_user_id_idx" ON "airtable_base" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "column_table_id_idx" ON "airtable_column" USING btree ("table_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "row_tableId_rowOrder_id_idx" ON "airtable_row" USING btree ("table_id","row_order","id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "session_user_id_idx" ON "airtable_session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "table_base_id_idx" ON "airtable_table" USING btree ("base_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "view_table_id_idx" ON "airtable_view" USING btree ("table_id");