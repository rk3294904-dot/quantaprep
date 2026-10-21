import { NextRequest, NextResponse } from "next/server";
import { apiGet, TTL, lxpwGet } from "@/lib/study-api";

export const dynamic = "force-dynamic";

type RawContent = {
  _id: string;
  topic?: string;
  url?: string;
  urlType?: string;
  date?: string;
  startTime?: string;
  status?: string;
  lectureType?: string;
  isLocked?: boolean;
  videoDetails?: {
    name?: string;
    image?: string;
    description?: string;
    duration?: string;
  };
  tags?: { name?: string }[];
};

type ContentsResponse = {
  data?: RawContent[] | null;
  paginate?: { totalCount?: number };
};

type ContentRow = {
  id: string;
  title: string;
  date?: string;
  startTime?: string;
  status?: string;
  isLocked?: boolean;
  videoId?: string;
  videoType?: string;
  thumbnail?: string;
  duration?: string;
  description?: string;
  chapter?: string;
};

const CONTENT_TYPES = new Set(["videos", "notes", "DppNotes", "DPP_QUIZ"]);

function mapRow(c: RawContent, contentType: string): ContentRow {
  const vd = c.videoDetails;
  const title = (vd?.name ?? c.topic ?? "Untitled").trim();
  let videoId: string | undefined;
  const videoType = (c.urlType ?? "youtube").toLowerCase();

  if (contentType === "videos") {
    if (videoType === "youtube") {
      const raw = (c.url ?? "").trim();
      // Upstream sometimes stores the YT id directly in `url`
      videoId = raw && raw.length <= 16 && !raw.includes("/") ? raw : extractYoutubeId(raw);
      if (!videoId && vd?.image) {
        const m = vd.image.match(/\/vi\/([^/]+)\//);
        if (m) videoId = m[1];
      }
    } else if (c.url) {
      videoId = c.url;
    }
  }

  return {
    id: c._id,
    title,
    date: c.date,
    startTime: c.startTime,
    status: c.status,
    isLocked: c.isLocked,
    videoId,
    videoType,
    thumbnail: vd?.image ?? "",
    duration: vd?.duration ?? "",
    description: vd?.description ?? "",
    chapter: c.tags?.[0]?.name ?? "",
  };
}

/**
 * Walk the LearnX PW mirror content list (paginated, identical ids).
 * ContentType: videos | notes — the mirror serves the same chapter content.
 */
async function mirrorContents(
  batchId: string,
  subjectSlug: string,
  tag: string,
  contentType: string,
  maxPages: number
): Promise<{ items: ContentRow[]; totalCount: number }> {
  if (contentType !== "videos" && contentType !== "notes") {
    return { items: [], totalCount: 0 };
  }
  const items: ContentRow[] = [];
  for (let page = 1; page <= maxPages * 2; page++) {
    const d = await lxpwGet<{ data?: RawContent[] }>(
      `/TopicInfo?BatchId=${encodeURIComponent(batchId)}&SubjectId=${encodeURIComponent(subjectSlug)}` +
        `&TopicId=${encodeURIComponent(tag)}&ContentType=${contentType}&page=${page}`,
      15000
    );
    const arr = Array.isArray(d?.data) ? d!.data! : [];
    if (arr.length === 0) break;
    for (const c of arr) items.push(mapRow(c, contentType));
  }
  return { items, totalCount: items.length };
}

/**
 * GET /api/batches/:batchId/subjects/:subjectSlug/contents
 *   ?contentType=videos|notes|DppNotes|DPP_QUIZ &tag=<topicId> &pages=<n>
 * Normalized lecture / note listing for a chapter. Primary upstream first;
 * LearnX PW mirror as fallback when the primary returns nothing.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string; subjectSlug: string }> }
) {
  const { batchId, subjectSlug } = await params;
  const searchParams = req.nextUrl.searchParams;
  const contentType = searchParams.get("contentType") ?? "videos";
  const tag = searchParams.get("tag") ?? "";
  const maxPages = Math.min(Number(searchParams.get("pages") ?? 3) || 3, 6);

  if (!CONTENT_TYPES.has(contentType)) {
    return NextResponse.json(
      { success: false, error: "Invalid contentType" },
      { status: 400 }
    );
  }
  if (!tag) {
    return NextResponse.json(
      { success: false, error: "tag (topicId) is required" },
      { status: 400 }
    );
  }

  const items: ContentRow[] = [];
  let totalCount = 0;

  for (let page = 1; page <= maxPages; page++) {
    const res = await apiGet<ContentsResponse>(
      `/v2/batches/${batchId}/subject/${encodeURIComponent(subjectSlug)}/contents?page=${page}&contentType=${contentType}&tag=${encodeURIComponent(tag)}`,
      { ttl: TTL.contents, timeoutMs: 20000 }
    );
    const arr = Array.isArray(res.data?.data) ? res.data!.data! : [];
    totalCount = res.data?.paginate?.totalCount ?? totalCount;
    if (arr.length === 0) break;

    for (const c of arr) items.push(mapRow(c, contentType));
    if (items.length >= totalCount) break;
  }

  // Fallback: LearnX PW mirror when the primary yielded nothing
  if (items.length === 0) {
    const m = await mirrorContents(batchId, subjectSlug, tag, contentType, maxPages);
    if (m.items.length) {
      return NextResponse.json({
        success: true,
        items: m.items,
        totalCount: m.totalCount,
        source: "learnxpw-mirror",
      });
    }
  }

  return NextResponse.json({ success: true, items, totalCount });
}

function extractYoutubeId(url: string): string | undefined {
  if (!url) return undefined;
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/live\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{6,20})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return undefined;
}
