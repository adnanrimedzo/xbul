CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"code" text NOT NULL,
	"slug" text NOT NULL,
	"weight_oz" double precision,
	"composition" text,
	"finish" text,
	"moq_meters" integer,
	"lead_time_weeks" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"kind" text DEFAULT 'fabric_mill' NOT NULL,
	"city" text NOT NULL,
	"country" char(2) NOT NULL,
	"owner_user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "companies_slug_unique" UNIQUE("slug"),
	CONSTRAINT "companies_owner_user_id_unique" UNIQUE("owner_user_id")
);
--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "articles_company_code_uq" ON "articles" USING btree ("company_id","code");--> statement-breakpoint
CREATE UNIQUE INDEX "articles_company_slug_uq" ON "articles" USING btree ("company_id","slug");