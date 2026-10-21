import { NextRequest, NextResponse } from "next/server";
import { apiGet, TTL, resolveAssetUrl } from "@/lib/study-api";

export const dynamic = "force-dynamic";

type TodayItem = {
  type?: string;
  _id?: string;
  data?: {
    _id?: string;
    topic?: string;
    date?: string;
    startTime?: string;
    endTime?: string;
    urlType?: string;
    url?: string;
    batchSubjectId?: string;
    tag?: string | { name?: string };
    tags?: { name?: string }[];
    videoDetails?: { name?: string; image?: string; duration?: string };
  };
};

type TodayResponse = { data?: TodayItem[] | null } | TodayItem[];

function tagName(tag: unknown): string {
  if (!tag) return "";
  if (typeof tag === "string") return tag;
  const t = tag as { name?: string };
  return t.name ?? "";
}

/** GET /api/batches/:batchId/today — today's live/scheduled classes. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;

  const variants = [
    `/v2/batches/${batchId}/todays-schedule`,
    `/batch-service/v1/batch-subject-schedules/today?batchId=${batchId}`,
    `/batch-service/v1/batch-schedules/today?batchId=${batchId}`,
  ];

  for (const path of variants) {
    const res = await apiGet<TodayResponse>(path, { ttl: TTL.misc, timeoutMs: 20000 });
    const payload = res.data;
    const arr: TodayItem[] = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : [];
    if (arr.length > 0) {
      return NextResponse.json({
        success: true,
        classes: arr.map((row) => {
          const c = row.data ?? {};
          return {
            id: c._id ?? (row as TodayItem)._id ?? "",
            type: (row as TodayItem).type ?? "LECTURE",
            title: c.videoDetails?.name ?? c.topic ?? "Class",
            subject: tagName(c.tag) || c.tags?.[0]?.name || "",
            subjectSlug: "",
            batchSubjectId: c.batchSubjectId ?? "",
            startTime: c.startTime ?? c.date ?? "",
            endTime: c.endTime ?? "",
            thumbnail: c.videoDetails?.image ?? "",
            duration: c.videoDetails?.duration ?? "",
            videoId: (c.urlType ?? "") === "youtube" ? c.url ?? "" : "",
          };
        }),
      });
    }
    if (res.status === 200 && res.data !== null) break;
  }

  return NextResponse.json({ success: true, classes: [] });
}

// silence unused import warning if resolveAssetUrl unused later
void resolveAssetUrl;
