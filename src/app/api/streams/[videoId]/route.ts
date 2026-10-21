import { NextRequest, NextResponse } from "next/server";
import {
  apiGet,
  TTL,
  cacheGet,
  cacheSet,
  parseVideoFolder,
  isSignedUrl,
  probeHlsFolder,
  deltaPlayFetch,
  signerFetch,
} from "@/lib/study-api";

export const dynamic = "force-dynamic";

type VideoInfoResponse = {
  data?: {
    _id?: string;
    name?: string;
    image?: string;
    videoUrl?: string;
    hls_url?: string;
    duration?: string;
    status?: string;
    types?: string[];
    drmProtected?: boolean;
  };
};

export type StreamResolution = {
  playable: boolean;
  kind: "mp4" | "hls" | "dash" | "unknown";
  url: string;
  reason?: string;
  /** extra playback hints consumed by the premium player */
  folder?: string;
  engine?: "hls" | "dash" | "native";
  manifestVia?: string;
  clearKey?: string;
  clearKid?: string;
  sig?: string;
  title?: string;
  duration?: string;
};

const streamCacheKey = (id: string) => `stream:${id}`;

function classify(url: string): StreamResolution["kind"] {
  const clean = url.split("?")[0].toLowerCase();
  if (clean.endsWith(".m3u8")) return "hls";
  if (clean.endsWith(".mpd")) return "dash";
  if (/\.(mp4|webm|mov|m4v)$/.test(clean)) return "mp4";
  return "unknown";
}

/** Pull the ClearKey KID out of a DASH manifest (PW uses ClearKey PSSH boxes). */
function extractKid(mpd: string): string | undefined {
  const m = mpd.match(/cenc:default_KID="([a-f0-9-]{36})"/i);
  return m ? m[1] : undefined;
}

/**
 * GET /api/streams/:videoId[?url=<rawVideoUrl>]
 * Resolve a penpencilvdo lecture into a playable plan:
 *   1. Universal HLS chain — signed variant playlists/segments/keys through the
 *      public signer relay, rewritten to /api/hls/... (works for all lectures).
 *   2. Delta Gate DASH — for URLs that already carry a CloudFront signature,
 *      the manifest is proxied through apiserver.deltastudy.fun/api/pi/play.
 * The caller may pass the lecture's raw stream URL (?url=...) to skip the
 * upstream /v1/videos lookup (useful when the primary host is degraded).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  const { videoId } = await params;
  if (!videoId) {
    return NextResponse.json({ success: false, error: "videoId required" }, { status: 400 });
  }

  const passedUrl = (req.nextUrl.searchParams.get("url") ?? "").trim();
  const cacheKey = streamCacheKey(passedUrl ? `${videoId}:u` : videoId);

  const cached = cacheGet<StreamResolution>(cacheKey);
  if (cached) {
    return NextResponse.json({ success: true, ...cached });
  }

  let rawUrl = passedUrl;
  let name = "";
  let duration = "";
  let drmProtected = false;

  if (!rawUrl) {
    const res = await apiGet<VideoInfoResponse>(`/v1/videos/${encodeURIComponent(videoId)}`, {
      ttl: TTL.schedule,
      timeoutMs: 15000,
    });

    const vd = res.data?.data;
    rawUrl = vd?.videoUrl ?? vd?.hls_url ?? "";
    name = vd?.name ?? "";
    duration = vd?.duration ?? "";
    drmProtected = !!vd?.drmProtected;
  }

  const finish = (out: StreamResolution, ttlMs = TTL.misc) => {
    cacheSet(cacheKey, out, ttlMs);
    return NextResponse.json({ success: true, ...out });
  };

  if (!rawUrl) {
    return finish({
      playable: false,
      kind: "unknown",
      url: "",
      reason: "No stream URL published yet.",
    });
  }

  if (drmProtected) {
    return finish({
      playable: false,
      kind: classify(rawUrl),
      url: rawUrl,
      reason: "DRM protected stream.",
    });
  }

  // ------------------------------------------------------------------
  // 1) Universal HLS chain (no pre-existing signature required)
  // ------------------------------------------------------------------
  const folder = parseVideoFolder(rawUrl);
  if (folder) {
    const quality = await probeHlsFolder(folder);
    if (quality) {
      return finish(
        {
          playable: true,
          kind: "hls",
          url: `/api/hls/${folder}/master.m3u8`,
          folder,
          engine: "hls",
          manifestVia: "signer-relay",
          title: name,
          duration,
        },
        5 * 60 * 1000
      );
    }
  }

  // ------------------------------------------------------------------
  // 2) Delta Gate DASH (requires the URL to carry its own signature)
  // ------------------------------------------------------------------
  if (isSignedUrl(rawUrl)) {
    const manifest = await deltaPlayFetch(rawUrl);
    if (manifest) {
      const kid = extractKid(manifest);
      const sigQuery = rawUrl.split("?")[1] ?? "";
      // best-effort ClearKey: PW's AES key often matches the CENC key
      let clearKey: string | undefined;
      if (folder && kid) {
        const keyRes = await signerFetch(folder, "enc.key", 12000);
        if (keyRes?.ok) {
          const buf = new Uint8Array(await keyRes.arrayBuffer());
          if (buf.length === 16) {
            clearKey = Array.from(buf)
              .map((b) => b.toString(16).padStart(2, "0"))
              .join("");
          }
        }
      }
      return finish(
        {
          playable: true,
          kind: "dash",
          url: `/api/dash/manifest?u=${encodeURIComponent(
            `https://apiserver.deltastudy.fun/api/pi/play?url=${encodeURIComponent(rawUrl)}`
          )}`,
          folder: folder ?? undefined,
          engine: "dash",
          manifestVia: "delta-gate",
          clearKid: kid,
          clearKey,
          sig: sigQuery,
          title: name,
          duration,
        },
        3 * 60 * 1000
      );
    }
  }

  // ------------------------------------------------------------------
  // 3) Plain fetchable mp4/hls (rare legacy cases)
  // ------------------------------------------------------------------
  const kind = classify(rawUrl);
  if (kind === "mp4" || (kind === "hls" && !rawUrl.includes("cloudfront"))) {
    try {
      const head = await fetch(rawUrl, { method: "HEAD", signal: AbortSignal.timeout(6000) });
      if (head.ok) {
        return finish({ playable: true, kind, url: rawUrl, engine: "native" });
      }
    } catch {
      /* fall through */
    }
  }

  return finish({
    playable: false,
    kind,
    url: rawUrl,
    reason:
      "This lecture streams from PW's signed CDN and no HLS mirror could be reached right now.",
  });
}
