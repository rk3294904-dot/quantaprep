CREATE TABLE "leaderboard_users" (
	"id" text PRIMARY KEY,
	"display_name" text NOT NULL,
	"photo_url" text DEFAULT '' NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
