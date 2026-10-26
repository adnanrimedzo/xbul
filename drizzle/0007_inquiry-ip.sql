ALTER TABLE "inquiries" ADD COLUMN "client_ip_hash" text;--> statement-breakpoint
CREATE INDEX "inquiries_ip_created_idx" ON "inquiries" USING btree ("client_ip_hash","created_at");