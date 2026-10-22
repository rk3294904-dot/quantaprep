import { createRemoteJWKSet, jwtVerify } from "jose";
import { leaderboardDb } from "../../../../db";
import { leaderboardUsers } from "../../../../db/schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Firebase's public signing keys verify the existing login without a service
// account. Only this project's signed ID tokens can register a profile.
const signingKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));
const projectId = "quanticalearning";
const headers = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    const users = await leaderboardDb.select({
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
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return Response.json({ error: "Sign in required." }, { status: 401, headers });
  }
  let profile: { id: string; displayName: string; photoURL: string };
  try {
    const { payload } = await jwtVerify(authorization.slice(7), signingKeys, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ["RS256"],
      requiredClaims: ["sub", "iat", "exp", "auth_time"],
    });
    if (!payload.sub || payload.sub.length > 128) throw new Error("Invalid subject");
    profile = {
      id: payload.sub,
      displayName: typeof payload.name === "string" ? payload.name.slice(0, 200) : "Learner",
      photoURL: typeof payload.picture === "string" && payload.picture.startsWith("https://") ? payload.picture.slice(0, 2048) : "",
    };
  } catch {
    return Response.json({ error: "Invalid sign-in session." }, { status: 401, headers });
  }
  try {
    await leaderboardDb.insert(leaderboardUsers).values(profile).onConflictDoUpdate({
      target: leaderboardUsers.id,
      set: { displayName: profile.displayName, photoURL: profile.photoURL },
    });
    return Response.json({ success: true }, { headers });
  } catch {
    return Response.json({ error: "Unable to register leaderboard profile." }, { status: 503, headers });
  }
}
