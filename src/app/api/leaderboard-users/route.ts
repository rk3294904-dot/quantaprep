import { verifyFirebaseRequest } from "@/lib/server/firebase-token";
import { getLeaderboardDb } from "../../../../db";
import { leaderboardUsers } from "../../../../db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    const users = await getLeaderboardDb().select({
      id: leaderboardUsers.id,
      displayName: leaderboardUsers.displayName,
      photoURL: leaderboardUsers.photoURL,
    }).from(leaderboardUsers);
    return Response.json({ users }, { headers });
  } catch {
    return Response.json({ error: "Unable to load leaderboard users." }, { status: 503, headers });
  }
}

export async function POST(request: Request) {
  const payload = await verifyFirebaseRequest(request);
  if (!payload?.sub) {
    return Response.json({ error: "Invalid sign-in session." }, { status: 401, headers });
  }
  const profile = {
    id: payload.sub,
    displayName: typeof payload.name === "string" ? payload.name.slice(0, 200) : "Learner",
    photoURL: typeof payload.picture === "string" && payload.picture.startsWith("https://") ? payload.picture.slice(0, 2048) : "",
  };
  try {
    await getLeaderboardDb().insert(leaderboardUsers).values(profile).onConflictDoUpdate({
      target: leaderboardUsers.id,
      set: { displayName: profile.displayName, photoURL: profile.photoURL },
    });
    return Response.json({ success: true }, { headers });
  } catch {
    return Response.json({ error: "Unable to register leaderboard profile." }, { status: 503, headers });
  }
}
