import { NextRequest, NextResponse } from "next/server";
import { signerFetch, cacheGet, cacheSet } from "@/lib/study-api";

export const dynamic = "force-dynamic";

/**
 * GET /api/hls/<folder>/master.m3u8          -> synthesized multi-quality master
 * GET /api/hls/<folder>/<q>/index.m3u8       -> rewritten signed media playlist
 * GET /api/hls/<folder>/key                  -> 16-byte AES-128 decryption key
 * GET /api/hls/<folder>/<q>/<segment>.ts     -> binary segment passthrough
 *
 * The upstream lecture content lives on PW's signature-protected CDN. We fetch
 * every manifest/segment/key through the public "get-hls-key" signer relay and
 * rewrite manifests so hls.js only ever talks to this route.
 */

const QUALITIES: { q: string; bandwidth: number; resolution: string; codecs: string }[] = [
  { q: "720", bandwidth: 1150000, resolution: "1280x720", codecs: "avc1.64001f,mp4a.40.2" },
  { q: "480", bandwidth: 720000, resolution: "854x480", codecs: "avc1.64001e,mp4a.40.2" },
  { q: "360", bandwidth: 460000, resolution: "640x360", codecs: "avc1.64001e,mp4a.40.2" },
  { q: "240", bandwidth: 260000, resolution: "426x240", codecs: "avc1.640015,mp4a.40.2" },
];

const playlistCacheKey = (folder: string, q: string) => `hlspl:${folder}:${q}`;

function jsonError(status: number, message: string) {
  return NextResponse.json({ success: false, error: message }, { status });
}

/** Fetch + rewrite a variant playlist so every URI points back at this route. */
async function rewrittenPlaylist(folder: string, q: string): Promise<string | null> {
  const ck = playlistCacheKey(folder, q);
  const cached = cacheGet<string>(ck);
  if (cached) return cached;

  const res = await signerFetch(folder, `${q}/main.m3u8`);
  if (!res?.ok) return null;
  const raw = await res.text();
  if (!raw.includes("#EXTM3U")) return null;

  const lines = raw.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    if (line.startsWith("#EXT-X-KEY")) {
      // point the AES-128 key at our own key route
      out.push(line.replace(/URI="[^"]*"/, 'URI="/api/hls/' + folder + '/key"'));
    } else if (line && !line.startsWith("#")) {
      // segment URI -> our binary passthrough
      const seg = line.split("/").pop();
      out.push(`/api/hls/${folder}/${q}/${seg}`);
    } else {
      out.push(line);
    }
  }
  const text = out.join("\n");
  cacheSet(ck, text, 10 * 60 * 1000);
  return text;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ folder: string; path: string[] }> }
) {
  const { folder, path } = await params;
  if (!folder || !path?.length) return jsonError(400, "folder and path required");

  const [head, ...rest] = path;

  // ---- virtual master playlist ----
  if (head === "master.m3u8") {
    const avail: string[] = [];
    for (const { q } of QUALITIES) {
      const pl = await rewrittenPlaylist(folder, q);
      if (pl) avail.push(q);
      if (avail.length >= 1 && q === "480") break; // don't probe all four unnecessarily
    }
    if (avail.length === 0) {
      return jsonError(404, "No HLS variants available for this lecture.");
    }
    const lines = ["#EXTM3U", "#EXT-X-VERSION:3"];
    for (const { q, bandwidth, resolution, codecs } of QUALITIES) {
      if (!avail.includes(q)) continue;
      lines.push(`#EXT-X-STREAM-INF:BANDWIDTH=${bandwidth},RESOLUTION=${resolution},CODECS="${codecs}"`);
      lines.push(`/api/hls/${folder}/${q}/index.m3u8`);
    }
    return new NextResponse(lines.join("\n"), {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  // ---- variant playlist (rewritten) ----
  if (head.match(/^(720|480|360|240)$/) && rest[0]?.endsWith(".m3u8")) {
    const pl = await rewrittenPlaylist(folder, head);
    if (!pl) return jsonError(404, "Variant playlist unavailable.");
    return new NextResponse(pl, {
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "public, max-age=300",
      },
    });
  }

  // ---- AES-128 key ----
  if (head === "key") {
    const res = await signerFetch(folder, "enc.key");
    if (!res?.ok) return jsonError(404, "Key unavailable.");
    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Cache-Control": "private, max-age=600",
      },
    });
  }

  // ---- binary segment passthrough ----
  const keyPath = path.join("/");
  if (!keyPath.match(/^(720|480|360|240)\//) && !keyPath.startsWith("hls/")) {
    return jsonError(403, "Invalid path.");
  }
  const res = await signerFetch(folder, keyPath, 40000);
  if (!res?.ok || !res.body) return jsonError(404, "Segment unavailable.");

  const headers = new Headers({
    "Content-Type": res.headers.get("Content-Type") ?? "application/octet-stream",
    "Cache-Control": "public, max-age=86400, immutable",
  });
  const len = res.headers.get("Content-Length");
  if (len) headers.set("Content-Length", len);
  return new NextResponse(res.body, { headers });
}
