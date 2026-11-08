CREATE TABLE "company_registrations" (
	"company_id" uuid PRIMARY KEY NOT NULL,
	"legal_name" text,
	"tax_id" text,
	"tax_office" text,
	"registry_number" text,
	"mersis_number" text,
	"industry_registry_number" text,
	"lei" text,
	"registered_address" text,
	"facility_address" text,
	"monthly_capacity" text,
	"open_supply_hub_id" text,
	"employees" text,
	"nace_codes" text[] DEFAULT '{}'::text[] NOT NULL,
	"certifications" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_review_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"actor_user_id" text NOT NULL,
	"action" text NOT NULL,
	"note" text,
	"changes" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "companies" ADD COLUMN "status" text DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE "companies" ALTER COLUMN "status" SET DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE "company_registrations" ADD CONSTRAINT "company_registrations_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_review_events" ADD CONSTRAINT "company_review_events_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "company_review_events_company_idx" ON "company_review_events" USING btree ("company_id","created_at");