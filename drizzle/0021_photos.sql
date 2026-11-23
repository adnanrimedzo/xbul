-- pgvector backs photo search (supplier photo and buyer search embeddings).
CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE "photo_checks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"company_id" uuid,
	"visitor_hash" text,
	"decision" text NOT NULL,
	"reason" text,
	"verdict" jsonb NOT NULL,
	"close_up" jsonb,
	"photo_key" text,
	"embedding" vector(768),
	"embedding_model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_photos" (
	"id" uuid PRIMARY KEY NOT NULL,
	"company_id" uuid NOT NULL,
	"article_id" uuid,
	"photo_key" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"tags" jsonb NOT NULL,
	"image_embedding" vector(768) NOT NULL,
	"embedding_model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "photo_checks" ADD CONSTRAINT "photo_checks_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_photos" ADD CONSTRAINT "supplier_photos_company_id_companies_id_fk" FOREIGN KEY ("company_id") REFERENCES "public"."companies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_photos" ADD CONSTRAINT "supplier_photos_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "photo_checks_visitor_idx" ON "photo_checks" USING btree ("visitor_hash","created_at");--> statement-breakpoint
CREATE INDEX "photo_checks_company_idx" ON "photo_checks" USING btree ("company_id","created_at");--> statement-breakpoint
CREATE INDEX "photo_checks_created_idx" ON "photo_checks" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "supplier_photos_company_idx" ON "supplier_photos" USING btree ("company_id");