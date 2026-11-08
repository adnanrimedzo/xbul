CREATE TABLE "company_checks" (
	"company_id" uuid NOT NULL,
	"source" text NOT NULL,
	"outcome" text NOT NULL,
	"summary" text NOT NULL,
	"checked_at" timestamp with time zone NOT NULL,
	CONSTRAINT "company_checks_company_id_source_pk" PRIMARY KEY("company_id","source")
);
--> statement-breakpoint
ALTER TABLE "company_checks" ADD CONSTRAINT "company_checks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;