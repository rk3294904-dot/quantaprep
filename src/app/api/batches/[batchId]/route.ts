import { NextRequest, NextResponse } from "next/server";
import { apiGet, TTL, resolveAssetUrl, lxpwGet } from "@/lib/study-api";

export const dynamic = "force-dynamic";

type DetailsResponse = {
  success?: boolean;
  data?: {
    _id?: string;
    name?: string;
    batchName?: string;
    byName?: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    language?: string;
    previewImage?:
      | string
      | { baseUrl?: string; path?: string; key?: string; _id?: string }
      | null;
    feeTotal?: number;
    type?: string;
    subjects?: {
      _id?: string;
      subject?: string;
      subjectId?: string;
      slug?: string;
      displayOrder?: number;
      lectureCount?: number;
      schedules?: number;
      imageId?: string;
      progressCount?: number;
    }[];
  };
};

function normalize(raw: NonNullable<DetailsResponse["data"]>, batchId: string) {
  const subjects = (raw.subjects ?? [])
    .map((s) => ({
      id: s.subjectId ?? s._id ?? "",
      name: (s.subject ?? "").trim(),
      slug: s.slug ?? "",
      lectureCount: s.lectureCount ?? s.schedules ?? 0,
      displayOrder: s.displayOrder ?? 999,
      image: s.imageId ? resolveAssetUrl(s.imageId) : "",
    }))
    .filter((s) => s.id && s.name)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  return {
    success: true,
    batch: {
      id: raw._id ?? batchId,
      name: raw.name ?? raw.batchName ?? "",
      byName: raw.byName ?? "",
      description: raw.description ?? "",
      startDate: raw.startDate ?? "",
      endDate: raw.endDate ?? "",
      language: raw.language ?? "",
      previewImage: raw.previewImage ? resolveAssetUrl(raw.previewImage) : "",
      feeTotal: raw.feeTotal ?? 0,
    },
    subjects,
  };
}

/**
 * GET /api/batches/:batchId
 * Batch details + subjects list. Primary upstream first; LearnX PW mirror as
 * fallback (identical ids, no auth).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;

  const res = await apiGet<DetailsResponse>(
    `/v3/batches/${batchId}/details`,
    { ttl: TTL.details, timeoutMs: 20000 }
  );

  const raw = res.data?.data;
  if (raw) {
    return NextResponse.json(normalize(raw, batchId));
  }

  // Fallback: LearnX PW mirror
  const mirror = await lxpwGet<{ data?: DetailsResponse["data"] }>(
    `/BatchInfo?BatchId=${encodeURIComponent(batchId)}&Type=details`,
    18000
  );
  const mraw = mirror?.data;
  if (mraw) {
    return NextResponse.json(normalize(mraw, batchId));
  }

  return NextResponse.json(
    { success: false, error: res.error ?? "Batch not found" },
    { status: res.status >= 400 ? 502 : 404 }
  );
}
