DROP INDEX "claims_one_verified_original";--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "scope" text DEFAULT 'fabric' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "claims_one_verified_original" ON "claims" USING btree ("product_id","scope") WHERE kind = 'original' and status = 'verified';