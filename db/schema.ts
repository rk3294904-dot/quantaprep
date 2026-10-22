import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// Public leaderboard profile only: never store email addresses or tokens.
export const leaderboardUsers = pgTable("leaderboard_users", {
  id: text("id").primaryKey(),
  displayName: text("display_name").notNull(),
  photoURL: text("photo_url").notNull().default(""),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});
