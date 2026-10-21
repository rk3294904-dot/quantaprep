import { NextRequest, NextResponse } from "next/server";
import { apiGet, TTL, resolveAssetUrl, lxpwGet } from "@/lib/study-api";

export const dynamic = "force-dynamic";

type ScheduleData = {
  _id?: string;
  url?: string;
  urlType?: string;
  videoDetails?: {
    name?: string;
    image?: string;
    description?: string;
    duration?: string;
    videoUrl?: string;
    embedCode?: string;
  };
  attachmentIds?: {
    _id?: string;
    name?: string;
    baseUrl?: string;
    path?: string;
    key?: string;
    fileName?: string;
    fileType?: string;
  }[];
  homeworkIds?: {
    _id?: string;
    topic?: string;
    note?: string;
    attachmentIds?: {
      _id?: string;
      name?: string;
      baseUrl?: string;
      path?: string;
      key?: string;
      fileName?: string;
      fileType?: string;
    }[];
  }[];
  exerciseIds?: unknown[];
};

type ScheduleResponse = { data?: ScheduleData };

type Attachment = {
  id: string;
  name: string;
  url: string;
  note?: string;
};

function attachmentUrl(
  att: { _id?: string; name?: string; baseUrl?: string; path?: string; key?: string; fileName?: string; fileType?: string },
  fallbackId: string,
  idx: number
): Attachment | null {
  const url = resolveAssetUrl(
    att.path ?? att.key ?? "",
    att.baseUrl || "https://static.pw.live/"
  );
  if (!url) return null;
  return {
    id: att._id ?? `${fallbackId}-${idx}`,
    name: att.name ?? att.fileName ?? "Document",
    url,
  };
}

function normalize(raw: NonNullable<ScheduleData>, contentId: string) {
  const notes: Attachment[] = [];

  // Top-level attachmentIds = lecture slides / class notes PDFs
  let idx = 0;
  for (const att of raw.attachmentIds ?? []) {
    const a = attachmentUrl(att, contentId, idx++);
    if (a) notes.push(a);
  }

  // Homework attachments = DPPs and additional notes
  for (const hw of raw.homeworkIds ?? []) {
    let hidx = 0;
    for (const att of hw.attachmentIds ?? []) {
      const a = attachmentUrl(att, hw._id ?? contentId, hidx++);
      if (a) notes.push({ ...a, note: hw.note });
    }
  }

  const vd = raw.videoDetails ?? {};
  const urlType = (raw.urlType ?? "youtube").toLowerCase();

  // videoId: prefer parsing `url`; fall back to the thumbnail (i.ytimg.com/vi/<id>/...)
  let videoId = extractYoutubeId(raw.url ?? "");
  if (!videoId && vd.image) {
    const m = String(vd.image).match(/\/vi\/([^/]+)\//);
    if (m) videoId = m[1];
  }

  return {
    success: true,
    lecture: {
      id: raw._id ?? contentId,
      title: vd.name ?? "",
      description: vd.description ?? "",
      duration: vd.duration ?? "",
      thumbnail: vd.image ?? "",
      urlType,
      videoId,
      videoUrl: urlType !== "youtube" ? (vd.videoUrl ?? raw.url ?? "") : "",
      videoApiId:
        urlType !== "youtube"
          ? ((vd as { _id?: string; video_id?: string })._id ??
             (vd as { _id?: string; video_id?: string }).video_id ??
             "")
          : "",
    },
    notes,
  };
}

/**
 * GET /api/batches/:batchId/subjects/:subjectSlug/schedule/:contentId
 * Full lecture detail: video info + attached notes (PDF homework attachments).
 * Primary upstream first; LearnX PW mirror as fallback.
 */
export async function GET(
  _req: NextRequest,
  {
    params,
  }: { params: Promise<{ batchId: string; subjectSlug: string; contentId: string }> }
) {
  const { batchId, subjectSlug, contentId } = await params;

  const res = await apiGet<ScheduleResponse>(
    `/v1/batches/${batchId}/subject/${encodeURIComponent(subjectSlug)}/schedule/${contentId}`,
    { ttl: TTL.schedule, timeoutMs: 20000 }
  );

  const raw = res.data?.data;
  if (raw) {
    return NextResponse.json(normalize(raw, contentId));
  }

  // Fallback: LearnX PW mirror
  const mirror = await lxpwGet<ScheduleResponse>(
    `/Schedule?BatchId=${encodeURIComponent(batchId)}&SubjectId=${encodeURIComponent(subjectSlug)}&ContentId=${encodeURIComponent(contentId)}`,
    18000
  );
  const mraw = mirror?.data;
  if (mraw) {
    return NextResponse.json({ ...normalize(mraw, contentId), source: "learnxpw-mirror" });
  }

  return NextResponse.json(
    { success: false, error: res.error ?? "Lecture not found" },
    { status: 502 }
  );
}

function extractYoutubeId(url: string): string | undefined {
  if (!url) return undefined;
  const m = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/live\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]{6,20})/
  );
  if (m) return m[1];
  if (/^[A-Za-z0-9_-]{6,20}$/.test(url)) return url;
  return undefined;
}
