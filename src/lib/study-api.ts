/**
 * Study Bison — upstream data client
 *
 * Talks to the public PenPencil-compatible study APIs used by the platform.
 * Features:
 *  - Multi-host fallback (tries hosts in order, remembers the fastest one)
 *  - Anonymous guest token handling (cached in memory, 10 min TTL)
 *  - In-memory response cache with TTL per endpoint kind
 *  - Timeouts + graceful failure (returns null instead of throwing)
 */

const API_HOSTS = [
  "https://api.studyspark.study/api/penpencil",
  "https://vidcloud.eu.org/api",
  "https://api.penpencil.co",
];

const TOKEN_SOURCES = [
  "https://vidcloud.eu.org/generate_token.php",
  "https://proxy.streamvideo.co.in/generate_token.php",
];

const FALLBACK_TOKEN =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTMCda8Yhe3iZaWbvV5XKSTbuAn0M";

export const BATCH_CATALOG_URL =
  "https://rarestudy.github.io/rarestudy/batches.json";

/**
 * Delta Gate — lecture playback service (user-provided API).
 * Proxies signed PW DASH/HLS manifests: /api/pi/play?url=<signed-url>
 * It requires the upstream URL to already carry CloudFront signature params.
 */
export const DELTA_PLAY_BASE = "https://apiserver.deltastudy.fun/api/pi/play";

/** Browser-like UA — some upstream hosts (Cloudflare) reject default server UAs. */
export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/**
 * Public PW "get-hls-key" signer relay. Given a video folder id and a relative
 * path under the video's hls/ directory, it returns the file through a freshly
 * signed sec1.pw.live URL. This is what makes universal lecture playback work:
 *   key=enc.key        -> 16-byte AES-128 key
 *   key=720/main.m3u8  -> signed HLS media playlist
 *   key=720/000.ts     -> signed media segment (binary)
 */
const HLS_SIGN_HOSTS = [
  "https://api.studyspark.study/api/penpencil",
  "https://vidcloud.eu.org/api",
];

/** Parse the video folder id out of a PW CloudFront / pw.live URL. */
export function parseVideoFolder(url: string): string | null {
  if (!url) return null;
  const m = url.match(
    /(?:cloudfront\.net|pw\.live)\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\//i
  );
  return m ? m[1] : null;
}

/** True when the URL already carries CloudFront signature params. */
export function isSignedUrl(url: string): boolean {
  return !!url && url.includes("Signature=") && url.includes("Key-Pair-Id=");
}

/**
 * Fetch a signed file under `<folder>/hls/<keyPath>` through the signer relay.
 * Tries hosts in order (remembers the fastest) and follows the signed redirect.
 * Returns the upstream Response or null when every host fails.
 */
export async function signerFetch(
  folder: string,
  keyPath: string,
  timeoutMs = 25000
): Promise<Response | null> {
  const token = await getGuestToken();
  const fast = globalCache.__sbFastSignHost;
  const hosts = fast
    ? [fast, ...HLS_SIGN_HOSTS.filter((h) => h !== fast)]
    : HLS_SIGN_HOSTS;

  for (const host of hosts) {
    try {
      const res = await fetch(
        `${host}/v1/videos/get-hls-key?videoKey=${encodeURIComponent(folder)}&key=${encodeURIComponent(keyPath)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            token,
            "client-type": "WEB",
            "client-version": "1.0.0",
            Accept: "*/*",
            "User-Agent": BROWSER_UA,
          },
          redirect: "follow",
          signal: AbortSignal.timeout(timeoutMs),
        }
      );
      if (res.ok) {
        globalCache.__sbFastSignHost = host;
        return res;
      }
    } catch {
      /* try next host */
    }
  }
  return null;
}

/** Cached probe: does this folder have an HLS variant at all? */
export async function probeHlsFolder(
  folder: string
): Promise<string | null> {
  const key = `hlsprobe:${folder}`;
  const cached = cacheGet<string | null>(key);
  if (cached !== null) return cached;
  // highest quality first
  for (const q of ["720", "480", "360", "240"]) {
    const res = await signerFetch(folder, `${q}/main.m3u8`, 15000);
    if (res?.ok) {
      cacheSet(key, q, 10 * 60 * 1000);
      return q;
    }
  }
  cacheSet(key, null as unknown as string, 5 * 60 * 1000);
  return null;
}

/** Try the Delta Gate play API server-side; returns the manifest text or null. */
export async function deltaPlayFetch(
  signedUrl: string,
  timeoutMs = 20000
): Promise<string | null> {
  try {
    const res = await fetch(
      `${DELTA_PLAY_BASE}?url=${encodeURIComponent(signedUrl)}`,
      {
        headers: { Accept: "*/*", "User-Agent": BROWSER_UA },
        signal: AbortSignal.timeout(timeoutMs),
      }
    );
    if (!res.ok) return null;
    const text = await res.text();
    if (text.includes("<MPD") || text.includes("#EXTM3U")) return text;
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// LearnX PW mirror (learnxpw.site) — fallback data source
//
// learnxpw.site proxies the same PenPencil-compatible upstream and exposes a
// browser-only JSON API. Every id matches our primary sources, so it can serve
// as a full mirror: batches, batch details, chapters, lectures/notes and the
// per-lecture schedule (notes/PDFs/DPPs).
//
// ---------------------------------------------------------------------------

export const LXPW_BASE = "https://www.learnxpw.site/api";

/** Build the self-contained player URL for a lecture on the LearnX PW mirror. */
export function lxpwWatchUrl(opts: {
  batchId: string;
  subjectSlug: string;
  contentId: string;
  urlType: string;
  youtubeId?: string;
  videoUrl?: string;
}): string {
  const type = opts.urlType === "youtube" ? "youtube" : "penpencilvdo";
  const rawVideoUrl =
    opts.videoUrl ||
    (opts.youtubeId ? `https://www.youtube.com/watch?v=${opts.youtubeId}` : "");
  const videoUrl = encodeURIComponent(rawVideoUrl);
  return (
    `https://www.learnxpw.site/watch?batchId=${encodeURIComponent(opts.batchId)}` +
    `&SubjectId=${encodeURIComponent(opts.subjectSlug)}` +
    `&ChildId=${encodeURIComponent(opts.contentId)}` +
    `&Type=${type}&VideoUrl=${videoUrl}&isLocked=false`
  );
}

/** Plain JSON GET against the LearnX PW mirror (no auth required). */
export async function lxpwGet<T = unknown>(
  path: string,
  timeoutMs = 15000
): Promise<T | null> {
  try {
    const res = await fetch(`${LXPW_BASE}${path}`, {
      headers: {
        Accept: "application/json, text/plain, */*",
        "User-Agent": BROWSER_UA,
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** LearnX batch catalog page: { success, batches: BatchCatalogItem[] } */
export async function lxpwBatches(maxPages = 8): Promise<BatchCatalogItem[]> {
  const all: BatchCatalogItem[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const d = await lxpwGet<{ batches?: BatchCatalogItem[] }>(
      `/AllBatches?page=${page}`,
      12000
    );
    const items = d?.batches ?? [];
    if (items.length === 0) break;
    all.push(...items);
  }
  return all;
}

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

type CacheEntry = { data: unknown; expiry: number };

const globalCache = globalThis as unknown as {
  __sbCache?: Map<string, CacheEntry>;
  __sbFastHost?: string;
  __sbToken?: string;
  __sbTokenExpiry?: number;
  __sbFastSignHost?: string;
};

const memCache: Map<string, CacheEntry> =
  globalCache.__sbCache ?? new Map<string, CacheEntry>();
globalCache.__sbCache = memCache;

export function cacheGet<T>(key: string): T | null {
  const hit = memCache.get(key);
  if (hit && hit.expiry > Date.now()) return hit.data as T;
  if (hit) memCache.delete(key);
  return null;
}

export function cacheSet(key: string, data: unknown, ttlMs: number) {
  // keep the cache bounded
  if (memCache.size > 500) {
    const firstKey = memCache.keys().next().value;
    if (firstKey) memCache.delete(firstKey);
  }
  memCache.set(key, { data, expiry: Date.now() + ttlMs });
}

/** TTL presets (ms) */
export const TTL = {
  catalog: 30 * 60 * 1000, // batch catalog — 30 min
  details: 10 * 60 * 1000, // batch details + subjects — 10 min
  topics: 10 * 60 * 1000, // chapters — 10 min
  contents: 5 * 60 * 1000, // lectures/notes — 5 min
  schedule: 10 * 60 * 1000, // single lecture detail — 10 min
  misc: 5 * 60 * 1000, // announcements / tests
};

// ---------------------------------------------------------------------------
// Guest token
// ---------------------------------------------------------------------------

function looksLikeToken(v: string): boolean {
  return (
    !!v &&
    v.length >= 15 &&
    !v.includes("<html") &&
    !v.toLowerCase().includes("<!doctype")
  );
}

export async function getGuestToken(): Promise<string> {
  const now = Date.now();
  if (globalCache.__sbToken && (globalCache.__sbTokenExpiry ?? 0) > now) {
    return globalCache.__sbToken;
  }
  for (const src of TOKEN_SOURCES) {
    try {
      const res = await fetch(src, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) continue;
      let txt = (await res.text()).trim();
      try {
        const parsed = JSON.parse(txt);
        if (typeof parsed === "string") txt = parsed;
        else if (parsed?.token) txt = parsed.token;
        else if (parsed?.access_token) txt = parsed.access_token;
        else if (parsed?.data?.token) txt = parsed.data.token;
        else if (parsed?.data?.access_token) txt = parsed.data.access_token;
      } catch {
        /* plain text token */
      }
      txt = txt.replace(/^Bearer\s+/i, "").replace(/^["']|["']$/g, "").trim();
      if (looksLikeToken(txt)) {
        globalCache.__sbToken = txt;
        globalCache.__sbTokenExpiry = now + 10 * 60 * 1000;
        return txt;
      }
    } catch {
      /* try next */
    }
  }
  return FALLBACK_TOKEN;
}

// ---------------------------------------------------------------------------
// Core fetch with host fallback
// ---------------------------------------------------------------------------

function baseHeaders(token: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json, text/plain, */*",
    "client-type": "WEB",
    "client-version": "1.0.0",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
    headers["token"] = token;
  }
  return headers;
}

export type UpstreamResult<T> = {
  data: T | null;
  status: number;
  error?: string;
};

/**
 * GET an upstream PenPencil path (e.g. `/v3/batches/:id/details`).
 * Tries the remembered fast host first, then the remaining hosts.
 */
export async function apiGet<T = unknown>(
  path: string,
  opts: { ttl?: number; timeoutMs?: number; skipCache?: boolean } = {}
): Promise<UpstreamResult<T>> {
  const { ttl = TTL.misc, timeoutMs = 15000, skipCache = false } = opts;
  const key = `GET:${path}`;

  if (!skipCache) {
    const cached = cacheGet<UpstreamResult<T>>(key);
    if (cached) return cached;
  }

  const token = await getGuestToken();
  const headers = baseHeaders(token);

  const fastHost = globalCache.__sbFastHost;
  const hosts = fastHost
    ? [fastHost, ...API_HOSTS.filter((h) => h !== fastHost)]
    : API_HOSTS;

  let lastStatus = 0;
  let lastError = "no host reachable";

  for (const host of hosts) {
    try {
      const res = await fetch(`${host}${path}`, {
        headers,
        signal: AbortSignal.timeout(timeoutMs),
      });
      lastStatus = res.status;

      if (res.status === 401 || res.status === 403) {
        // token might be stale on this host — refresh once and retry inline
        const fresh = await getGuestToken();
        const retry = await fetch(`${host}${path}`, {
          headers: baseHeaders(fresh),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (retry.ok) {
          const json = (await retry.json()) as T;
          globalCache.__sbFastHost = host;
          const out: UpstreamResult<T> = { data: json, status: 200 };
          if (!skipCache) cacheSet(key, out, ttl);
          return out;
        }
        lastStatus = retry.status;
        lastError = `upstream ${retry.status}`;
        continue;
      }

      if (!res.ok) {
        lastError = `upstream ${res.status}`;
        continue;
      }

      const json = (await res.json()) as T;
      globalCache.__sbFastHost = host;
      const out: UpstreamResult<T> = { data: json, status: 200 };
      if (!skipCache) cacheSet(key, out, ttl);
      return out;
    } catch (err) {
      lastError = err instanceof Error ? err.message : "network error";
    }
  }

  return { data: null, status: lastStatus, error: lastError };
}

/** Unauthenticated plain JSON fetch (used for the public batch catalog). */
export async function fetchCatalog(): Promise<{
  batches: BatchCatalogItem[];
} | null> {
  const cached = cacheGet<{ batches: BatchCatalogItem[] }>("catalog");
  if (cached) return cached;

  try {
    const res = await fetch(BATCH_CATALOG_URL, {
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { success: boolean; batches: BatchCatalogItem[] };
    if (!json?.batches) return null;
    const out = { batches: json.batches };
    cacheSet("catalog", out, TTL.catalog);
    return out;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Shared upstream types (only the fields we consume)
// ---------------------------------------------------------------------------

export interface BatchCatalogItem {
  _id: string;
  name: string;
  byName: string;
  startDate?: string;
  endDate?: string;
  language?: string;
  previewImage?: string;
  feeTotal?: number;
  type?: string;
  slug?: string;
  subBatches?: {
    _id?: string;
    name?: string;
    slug?: string;
    previewImage?: string;
    language?: string;
    byName?: string;
    endDate?: string;
    feeTotal?: number;
  }[];
}

export interface UpstreamSubject {
  _id?: string;
  subject?: string;
  subjectId?: string;
  slug?: string;
  displayOrder?: number;
  lectureCount?: number;
  notesCount?: number;
  imageId?: string;
  progressCount?: number;
  tagCount?: number;
}

export interface UpstreamTopic {
  _id: string;
  name?: string;
  type?: string;
  typeId?: string;
  displayOrder?: number;
  notes?: number;
  exercises?: number;
  videos?: number;
  lectureVideos?: number;
  slug?: string;
}

export interface UpstreamContent {
  _id: string;
  topic?: string;
  url?: string;
  urlType?: string;
  date?: string;
  startTime?: string;
  endTime?: string;
  status?: string;
  isLocked?: boolean;
  lectureType?: string;
  isVideoLecture?: boolean;
  videoDetails?: {
    name?: string;
    image?: string;
    description?: string;
    duration?: string;
    publishedAt?: string;
    embedCode?: string;
  };
  tags?: { _id?: string; name?: string }[];
  homeworkIds?: {
    _id?: string;
    topic?: string;
    note?: string;
    attachmentIds?: {
      _id?: string;
      name?: string;
      baseUrl?: string;
      path?: string;
      fileName?: string;
      fileType?: string;
    }[];
  }[];
}

/** Build a full asset URL from a PW asset id or path. */
export function resolveAssetUrl(
  idOrPath?:
    | string
    | { baseUrl?: string; path?: string; key?: string; _id?: string }
    | null,
  base?: string
): string {
  if (!idOrPath) return "";
  if (typeof idOrPath !== "string") {
    // Asset descriptors can arrive as { baseUrl, path | key } or { _id }
    const obj = idOrPath as { baseUrl?: string; path?: string; key?: string; _id?: string };
    const rel = obj.path ?? obj.key;
    if (rel) {
      return `${(obj.baseUrl || base || "https://static.pw.live/").replace(/\/+$/, "")}/${String(rel).replace(/^\/+/, "")}`;
    }
    if (obj._id) {
      return `${(base || "https://static.pw.live/").replace(/\/+$/, "")}/${obj._id}`;
    }
    return "";
  }
  const v = idOrPath.trim();
  if (!v || v === "[object Object]") return "";
  if (v.startsWith("http://") || v.startsWith("https://")) return v;
  const root = base && base.length > 0 ? base : "https://static.pw.live/";
  return `${root.replace(/\/+$/, "")}/${v.replace(/^\/+/, "")}`;
}

/** Extract the playable stream URL from a content / schedule payload. */
export function extractVideoUrl(payload: unknown): string {
  const p = payload as {
    videoDetails?: { videoUrl?: string; streamUrl?: string; url?: string };
    url?: string;
  };
  const vd = p?.videoDetails;
  return (
    vd?.videoUrl ||
    vd?.streamUrl ||
    vd?.url ||
    (typeof p?.url === "string" ? p.url : "") ||
    ""
  );
}
