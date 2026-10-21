import { NextRequest, NextResponse } from "next/server";
import { apiGet, TTL, resolveAssetUrl, lxpwGet } from "@/lib/study-api";

export const dynamic = "force-dynamic";

type RawAttachment = {
  _id?: string;
  id?: string;
  key?: string;
  path?: string;
  baseUrl?: string;
  fileName?: string;
  name?: string;
};

type RawAnnouncement = {
  _id?: string;
  id?: string;
  description?: string;
  content?: string;
  message?: string;
  createdAt?: string;
  updatedAt?: string;
  date?: string;
  attachments?: RawAttachment[];
  attachmentIds?: RawAttachment[];
};

type UnknownResponse = {
  data?: RawAnnouncement[] | { announcements?: RawAnnouncement[]; items?: RawAnnouncement[] } | null;
  announcements?: RawAnnouncement[];
  items?: RawAnnouncement[];
};

function getItems(payload: UnknownResponse | null): RawAnnouncement[] {
  if (!payload) return [];
  if (Array.isArray(payload.data)) return payload.data;
  if (payload.data && !Array.isArray(payload.data)) {
    if (Array.isArray(payload.data.announcements)) return payload.data.announcements;
    if (Array.isArray(payload.data.items)) return payload.data.items;
  }
  if (Array.isArray(payload.announcements)) return payload.announcements;
  if (Array.isArray(payload.items)) return payload.items;
  return [];
}

function normalize(items: RawAnnouncement[]) {
  return items.map((a, i) => ({
    id: a._id ?? a.id ?? `ann-${i}`,
    description: a.description ?? a.content ?? a.message ?? "",
    createdAt: a.createdAt ?? a.updatedAt ?? a.date ?? "",
    attachments: [...(a.attachments ?? []), ...(a.attachmentIds ?? [])]
      .map((at) => ({
        name: at.fileName ?? at.name ?? "Attachment",
        url: resolveAssetUrl(
          at.path ?? at.key ?? at.id ?? at._id ?? "",
          at.baseUrl || "https://static.pw.live/"
        ),
      }))
      .filter((at) => at.url),
  }));
}

/** GET /api/batches/:batchId/announcements. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;
  const encodedBatchId = encodeURIComponent(batchId);
  const variants = [
    `/v2/announcements?batchId=${encodedBatchId}`,
    `/v2/announcements?batchId=${encodedBatchId}&page=1&limit=50`,
    `/v1/batches/${encodedBatchId}/announcements`,
    `/v2/batches/${encodedBatchId}/announcements`,
    `/v2/batches/${encodedBatchId}/announcement?page=1`,
  ];

  for (const path of variants) {
    const res = await apiGet<UnknownResponse>(path, { ttl: TTL.misc, timeoutMs: 15000 });
    const items = getItems(res.data);
    if (items.length > 0) {
      return NextResponse.json({ success: true, announcements: normalize(items) });
    }
  }

  const mirrorPaths = [
    `/Announcements?BatchId=${encodedBatchId}`,
    `/Announcement?BatchId=${encodedBatchId}`,
    `/BatchAnnouncements?BatchId=${encodedBatchId}`,
  ];
  for (const path of mirrorPaths) {
    const mirror = await lxpwGet<UnknownResponse>(path, 15000);
    const items = getItems(mirror);
    if (items.length > 0) {
      return NextResponse.json({
        success: true,
        announcements: normalize(items),
        source: "learnxpw-mirror",
      });
    }
  }

  return NextResponse.json({ success: true, announcements: [] });
}
