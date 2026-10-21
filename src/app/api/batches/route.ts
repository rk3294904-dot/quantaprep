import { NextResponse } from "next/server";
import { fetchCatalog, lxpwBatches } from "@/lib/study-api";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

type CatalogBatch = {
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
};

async function persistSnapshot(batches: CatalogBatch[]) {
  try {
    const existing = await db.catalogCache.findUnique({ where: { id: "batches" } });
    const payload = JSON.stringify(batches);
    if (existing) {
      await db.catalogCache.update({
        where: { id: "batches" },
        data: { payload, fetchedAt: new Date() },
      });
    } else {
      await db.catalogCache.create({ data: { id: "batches", payload } });
    }
  } catch {
    /* ignore */
  }
}

/**
 * GET /api/batches
 * Public batch catalog. Fetches the primary upstream catalog and the
 * LearnX PW mirror in parallel — whichever resolves first with batches
 * wins. Falls back to the last persisted DB snapshot when both fail.
 */
export async function GET() {
  const upstreamP = fetchCatalog();
  const mirrorP = lxpwBatches(8);

  // First successful (batches present) result wins.
  const winner = await Promise.any([
    upstreamP.then((u) => (u?.batches?.length ? u.batches : Promise.reject(new Error("empty")))),
    mirrorP.then((m) => (m.length ? m : Promise.reject(new Error("empty")))),
  ]).catch(async () => null);

  if (winner && (winner as CatalogBatch[]).length) {
    const batches = winner as CatalogBatch[];
    persistSnapshot(batches);
    const source = await upstreamP.then((u) => (u?.batches === batches ? "upstream" : "learnxpw-mirror")).catch(() => "learnxpw-mirror");
    return NextResponse.json({ success: true, source, batches });
  }

  // Both sources failed/empty — try the persisted snapshot.
  try {
    const snap = await db.catalogCache.findUnique({ where: { id: "batches" } });
    if (snap) {
      const batches = JSON.parse(snap.payload) as CatalogBatch[];
      return NextResponse.json({ success: true, source: "db-cache", batches });
    }
  } catch {
    /* ignore */
  }

  return NextResponse.json(
    { success: false, batches: [], error: "Catalog temporarily unavailable" },
    { status: 502 }
  );
}
