import { drizzle } from "drizzle-orm/netlify-db";
import * as schema from "./schema";

export const leaderboardDb = drizzle({ schema });
