CREATE TABLE "products" (
	"id" uuid PRIMARY KEY NOT NULL,
	"canonical_url" text NOT NULL,
	"source_url" text NOT NULL,
	"brand" text NOT NULL,
	"name" text NOT NULL,
	"image_url" text,
	"composition" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_canonical_url_unique" UNIQUE("canonical_url")
);
