import { boolean, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// Public leaderboard profile only: never store email addresses or tokens.
export const leaderboardUsers = pgTable("leaderboard_users", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  photoURL: text("photo_url").notNull().default(""),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

// Sponsored placements shown below the navbar. Images live in Netlify Blobs
// (store "ad-images") under imageKey; only the admin can create or remove ads.
export const ads = pgTable("ads", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  linkUrl: text("link_url").notNull().default(""),
  imageKey: text("image_key").notNull().default(""),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
