import { NextRequest, NextResponse } from "next/server";
import { apiGet, TTL } from "@/lib/study-api";

export const dynamic = "force-dynamic";

type TestsResponse = {
  data?:
    | {
        _id: string;
        name?: string;
        slug?: string;
        totalQuestions?: number;
        marks?: number;
        duration?: string | number;
        testType?: string;
        type?: string;
        currentType?: string;
        startDate?: string;
        expiresOn?: string;
        isScheduled?: boolean;
        subjects?: { name?: string }[];
      }[]
    | null;
};

/** GET /api/batches/:batchId/tests — test series listing. */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const { batchId } = await params;

  const variants = [
    `/v3/test-service/tests?batchId=${batchId}&limit=50`,
    `/v3/test-service/batches/${batchId}/tests`,
    `/v2/batches/${batchId}/tests`,
  ];

  for (const path of variants) {
    const res = await apiGet<TestsResponse>(path, { ttl: TTL.misc, timeoutMs: 20000 });
    const arr = Array.isArray(res.data?.data) ? res.data!.data! : [];
    if (arr.length > 0) {
      return NextResponse.json({
        success: true,
        tests: arr.map((t) => ({
          id: t._id,
          name: t.name ?? "Test",
          totalQuestions: t.totalQuestions ?? 0,
          marks: t.marks ?? 0,
          duration: typeof t.duration === "number" ? `${t.duration} min` : t.duration ?? "",
          type: t.currentType ?? t.testType ?? t.type ?? "Test",
          startDate: t.startDate ?? "",
          expiresOn: t.expiresOn ?? "",
          subjects: (t.subjects ?? []).map((s) => s.name ?? "").filter(Boolean),
        })),
      });
    }
    if (res.data !== null && res.status === 200) {
      // endpoint exists but empty — stop trying variants
      break;
    }
  }

  return NextResponse.json({ success: true, tests: [] });
}
