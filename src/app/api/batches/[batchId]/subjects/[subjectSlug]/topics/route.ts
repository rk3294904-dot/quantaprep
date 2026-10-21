import { NextRequest, NextResponse } from "next/server";
import { apiGet, TTL, lxpwGet } from "@/lib/study-api";

export const dynamic = "force-dynamic";

type TopicsResponse = {
  data?:
    | {
        _id: string;
        name?: string;
        type?: string;
        displayOrder?: number;
        notes?: number;
        exercises?: number;
        videos?: number;
        lectureVideos?: number;
        slug?: string;
      }[]
    | null;
  paginate?: { totalCount?: number };
};

type TopicRow = {
  id: string;
  name: string;
  videos: number;
  notes: number;
  exercises: number;
  displayOrder: number;
};

/** Walk the LearnX PW mirror chapter list ( paginated, identical ids ). */
async function mirrorTopics(
  batchId: string,
  subjectSlug: string
): Promise<{ topics: TopicRow[]; totalCount: number }> {
  const all: TopicRow[] = [];
  for (let page = 1; page <= 15; page++) {
    const d = await lxpwGet<{ data?: TopicsResponse["data"] }>(
      `/SubjectInfo?BatchId=${encodeURIComponent(batchId)}&SubjectId=${encodeURIComponent(subjectSlug)}&page=${page}`,
      15000
    );
    const items = Array.isArray(d?.data) ? d!.data! : [];
    if (items.length === 0) break;
    for (const t of items) {
      all.push({
        id: t._id,
        name: t.name ?? "Chapter",
        videos: Math.max(t.videos ?? 0, t.lectureVideos ?? 0),
        notes: t.notes ?? 0,
        exercises: t.exercises ?? 0,
        displayOrder: t.displayOrder ?? 999,
      });
    }
  }
  all.sort((a, b) => a.displayOrder - b.displayOrder);
  return { topics: all, totalCount: all.length };
}

/**
 * GET /api/batches/:batchId/subjects/:subjectSlug/topics
 * Chapter (topic) list for a subject. Primary upstream first; LearnX PW
 * mirror as fallback when the primary returns nothing.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ batchId: string; subjectSlug: string }> }
) {
  const { batchId, subjectSlug } = await params;
  const all: TopicRow[] = [];
  let totalCount = 0;

  // The upstream paginates 20 per page; walk up to 10 pages.
  for (let page = 1; page <= 10; page++) {
    const res = await apiGet<TopicsResponse>(
      `/v2/batches/${batchId}/subject/${encodeURIComponent(subjectSlug)}/topics?page=${page}`,
      { ttl: TTL.topics, timeoutMs: 20000 }
    );
    const items = Array.isArray(res.data?.data) ? res.data!.data! : [];
    totalCount = res.data?.paginate?.totalCount ?? totalCount;
    if (items.length === 0) break;
    for (const t of items) {
      all.push({
        id: t._id,
        name: t.name ?? "Chapter",
        videos: Math.max(t.videos ?? 0, t.lectureVideos ?? 0),
        notes: t.notes ?? 0,
        exercises: t.exercises ?? 0,
        displayOrder: t.displayOrder ?? 999,
      });
    }
    if (all.length >= totalCount) break;
  }

  // Fallback: LearnX PW mirror when the primary yielded nothing
  if (all.length === 0) {
    const m = await mirrorTopics(batchId, subjectSlug);
    if (m.topics.length) {
      return NextResponse.json({
        success: true,
        topics: m.topics,
        totalCount: m.totalCount,
        source: "learnxpw-mirror",
      });
    }
  }

  all.sort((a, b) => a.displayOrder - b.displayOrder);

  return NextResponse.json({ success: true, topics: all, totalCount });
}
