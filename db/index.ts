import { drizzle } from "drizzle-orm/netlify-db";
import * as schema from "./schema";

let leaderboardDb: ReturnType<typeof createLeaderboardDb> | undefined;

function createLeaderboardDb() {
  return drizzle({ schema });
}

// Next.js imports API routes while collecting page data. Only initialize the
// connection during a request, when the runtime database configuration is needed.
export function getLeaderboardDb() {
  return leaderboardDb ??= createLeaderboardDb();
}
