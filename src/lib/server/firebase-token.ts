import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

// Firebase's public signing keys verify the existing login without a service
// account. Only this project's signed ID tokens are accepted.
const signingKeys = createRemoteJWKSet(new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"));
const projectId = "quanticalearning";

export const ADMIN_EMAIL = "vk1719676@gmail.com";

// Returns the verified token payload, or null when the request isn't signed in.
export async function verifyFirebaseRequest(request: Request): Promise<JWTPayload | null> {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  try {
    const { payload } = await jwtVerify(authorization.slice(7), signingKeys, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ["RS256"],
      requiredClaims: ["sub", "iat", "exp", "auth_time"],
    });
    if (!payload.sub || payload.sub.length > 128) return null;
    return payload;
  } catch {
    return null;
  }
}

export function isAdmin(payload: JWTPayload | null) {
  return payload?.email_verified === true
    && typeof payload.email === "string"
    && payload.email.toLowerCase() === ADMIN_EMAIL;
}
