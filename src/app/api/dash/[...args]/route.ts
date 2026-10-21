import { NextRequest, NextResponse } from "next/server";
import { deltaPlayFetch, BROWSER_UA } from "@/lib/study-api";

export const dynamic = "force-dynamic";

/**
 * Delta Gate DASH bridge.
 *
 * GET /api/dash/manifest?u=<encoded delta-play-url-or-signed-url>
 *   Fetches the MPD through the user-provided Delta Gate play API and rewrites
 *   every <BaseURL> to point at our signature-appending segment proxy, so the
 *   browser player never hits CORS or signature problems.
 *
 * GET /api/dash/seg/<folder>/<b64payload>/<...path>
 *   b64payload = base64url(JSON { sig, host }) — re-attaches the CloudFront
 *   signature query to every upstream segment request (the signing policy is
 *   a folder wildcard, so one signature covers all files of the lecture).
 */

function jsonError(status: number, message: string) {
  return NextResponse.json({ success: false, error: message }, { status });
}

function b64urlDecode(s: string): string {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64").toString("utf8");
}

function b64urlEncode(s: string): string {
  return Buffer.from(s, "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ args: string[] }> }
) {
  const { args } = await params;
  if (!args?.length) return jsonError(400, "path required");

  // ---------- manifest ----------
  if (args[0] === "manifest") {
    const url = new URL(_req.url);
    const u = url.searchParams.get("u");
    if (!u) return jsonError(400, "u required");

    const isDeltaUrl = u.includes("apiserver.deltastudy.fun");
    let mpd: string | null = null;
    if (isDeltaUrl) {
      // `u` is already a complete Delta Gate play URL — fetch it as-is
      try {
        const res = await fetch(u, {
          headers: { Accept: "*/*", "User-Agent": BROWSER_UA },
          signal: AbortSignal.timeout(20000),
        });
        if (res.ok) {
          const t = await res.text();
          if (t.includes("<MPD") || t.includes("#EXTM3U")) mpd = t;
        }
      } catch {
        /* fall through to direct */
      }
    } else {
      // raw signed URL — route through the Delta Gate play API first
      mpd = await deltaPlayFetch(u);
    }
    if (!mpd) {
      // last resort: fetch the signed url directly
      try {
        const direct = isDeltaUrl ? new URL(u).searchParams.get("url") ?? u : u;
        const res = await fetch(direct, {
          headers: { "User-Agent": BROWSER_UA },
          signal: AbortSignal.timeout(15000),
        });
        if (res.ok) {
          const t = await res.text();
          if (t.includes("<MPD")) mpd = t;
        }
      } catch {
        /* ignore */
      }
    }
    if (!mpd) return jsonError(502, "Could not fetch DASH manifest via Delta Gate.");

    // find BaseURL -> derive host + folder + build segment-proxy prefix
    const baseUrlMatch = mpd.match(/<BaseURL>(https:\/\/[^<]+\/)<\/BaseURL>/);
    let host = "https://d1d34p8vz63oiq.cloudfront.net";
    let folder = "";
    if (baseUrlMatch) {
      try {
        const b = new URL(baseUrlMatch[1]);
        host = `${b.protocol}//${b.host}`;
        folder = b.pathname.replace(/^\/+|\/+$/g, "");
      } catch {
        /* keep defaults */
      }
    }
    if (!folder) {
      const m = u.match(/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/i);
      if (m) folder = m[1];
    }

    // extract the signature query from the signed source url (if present)
    let sig = "";
    try {
      const src = new URL(u);
      // the delta url carries the real target inside ?url=
      const inner = src.searchParams.get("url") ?? u;
      const innerUrl = new URL(inner);
      sig = innerUrl.search.replace(/^\?/, "");
    } catch {
      /* no signature available */
    }

    const payload = b64urlEncode(JSON.stringify({ sig, host }));
    const proxyBase = `/api/dash/seg/${folder}/${payload}/`;

    if (folder) {
      mpd = mpd.replace(
        /<BaseURL>(https:\/\/[^<]+\/)<\/BaseURL>/g,
        `<BaseURL>${proxyBase}</BaseURL>`
      );
    }

    return new NextResponse(mpd, {
      headers: {
        "Content-Type": "application/dash+xml",
        "Cache-Control": "public, max-age=120",
      },
    });
  }

  // ---------- segments ----------
  if (args[0] === "seg") {
    const [, folder, payload, ...rest] = args;
    if (!folder || !payload || rest.length === 0) {
      return jsonError(400, "folder, payload and path required");
    }
    let sig = "";
    let host = "https://d1d34p8vz63oiq.cloudfront.net";
    try {
      const parsed = JSON.parse(b64urlDecode(payload));
      sig = typeof parsed.sig === "string" ? parsed.sig : "";
      if (typeof parsed.host === "string" && parsed.host.startsWith("https://")) host = parsed.host;
    } catch {
      return jsonError(400, "bad payload");
    }

    const upstream = `${host}/${folder}/${rest.join("/")}${sig ? `?${sig}` : ""}`;
    try {
      const res = await fetch(upstream, { signal: AbortSignal.timeout(60000) });
      if (!res.ok || !res.body) {
        return jsonError(res.status || 404, `Upstream ${res.status}`);
      }
      const headers = new Headers({
        "Content-Type": res.headers.get("Content-Type") ?? "application/octet-stream",
        "Cache-Control": "public, max-age=86400, immutable",
      });
      const len = res.headers.get("Content-Length");
      if (len) headers.set("Content-Length", len);
      return new NextResponse(res.body, { headers });
    } catch {
      return jsonError(502, "Upstream fetch failed.");
    }
  }

  return jsonError(404, "Unknown route");
}
