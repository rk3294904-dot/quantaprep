import { getStore } from "@netlify/blobs";
import { desc, eq } from "drizzle-orm";
import { getLeaderboardDb } from "../../../../db";
import { ads } from "../../../../db/schema";
import { isAdmin, verifyFirebaseRequest } from "@/lib/server/firebase-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const headers = { "Cache-Control": "no-store" };
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

const imageStore = () => getStore({ name: "ad-images", consistency: "strong" });

function toPublicAd(ad: typeof ads.$inferSelect) {
  return {
    id: ad.id,
    title: ad.title,
    description: ad.description,
    linkUrl: ad.linkUrl,
    imageUrl: ad.imageKey ? `/api/ads/image/${encodeURIComponent(ad.imageKey)}` : "",
  };
}

function safeLink(value: string) {
  if (!value) return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const admin = isAdmin(await verifyFirebaseRequest(request));
  try {
    const rows = await getLeaderboardDb().select().from(ads).where(eq(ads.active, true)).orderBy(desc(ads.createdAt));
    return Response.json({ ads: rows.map(toPublicAd), admin }, { headers });
  } catch {
    return Response.json({ error: "Unable to load ads.", admin }, { status: 503, headers });
  }
}

export async function POST(request: Request) {
  if (!isAdmin(await verifyFirebaseRequest(request))) {
    return Response.json({ error: "Only the admin can add ads." }, { status: 403, headers });
  }
  const form = await request.formData().catch(() => null);
  if (!form) return Response.json({ error: "Invalid form data." }, { status: 400, headers });

  const title = String(form.get("title") ?? "").trim().slice(0, 120);
  const description = String(form.get("description") ?? "").trim().slice(0, 300);
  const linkUrl = safeLink(String(form.get("linkUrl") ?? "").trim());
  const image = form.get("image");
  if (!title) return Response.json({ error: "Add a title for the ad." }, { status: 400, headers });
  if (linkUrl === null) return Response.json({ error: "The link must start with http:// or https://." }, { status: 400, headers });

  let imageKey = "";
  if (image instanceof File && image.size > 0) {
    if (!IMAGE_TYPES.includes(image.type)) return Response.json({ error: "Use a PNG, JPG, WEBP or GIF image." }, { status: 400, headers });
    if (image.size > MAX_IMAGE_BYTES) return Response.json({ error: "Images must be 4 MB or smaller." }, { status: 400, headers });
    imageKey = crypto.randomUUID();
    await imageStore().set(imageKey, await image.arrayBuffer(), { metadata: { contentType: image.type } });
  }

  try {
    const [ad] = await getLeaderboardDb().insert(ads).values({ title, description, linkUrl, imageKey }).returning();
    return Response.json({ ad: toPublicAd(ad) }, { status: 201, headers });
  } catch {
    if (imageKey) await imageStore().delete(imageKey).catch(() => {});
    return Response.json({ error: "Unable to save the ad." }, { status: 503, headers });
  }
}

export async function DELETE(request: Request) {
  if (!isAdmin(await verifyFirebaseRequest(request))) {
    return Response.json({ error: "Only the admin can remove ads." }, { status: 403, headers });
  }
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "Invalid ad." }, { status: 400, headers });
  try {
    const [ad] = await getLeaderboardDb().delete(ads).where(eq(ads.id, id)).returning();
    if (ad?.imageKey) await imageStore().delete(ad.imageKey).catch(() => {});
    return Response.json({ success: true }, { headers });
  } catch {
    return Response.json({ error: "Unable to remove the ad." }, { status: 503, headers });
  }
}
