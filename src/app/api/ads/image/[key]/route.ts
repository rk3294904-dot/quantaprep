import { getStore } from "@netlify/blobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const entry = await getStore("ad-images").getWithMetadata(key, { type: "arrayBuffer" }).catch(() => null);
  if (!entry) return new Response("Not found", { status: 404 });
  const contentType = typeof entry.metadata.contentType === "string" ? entry.metadata.contentType : "application/octet-stream";
  // Keys are random and never reused, so the image can be cached indefinitely.
  return new Response(entry.data, {
    headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
