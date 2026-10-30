CREATE TABLE "search_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"matched" boolean NOT NULL,
	"visitor_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
