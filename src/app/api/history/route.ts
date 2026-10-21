import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/history — recent watch history (newest first). */
export async function GET() {
  try {
    const items = await db.watchHistory.findMany({
      where: { userId: "local" },
      orderBy: { updatedAt: "desc" },
      take: 30,
    });
    return NextResponse.json({ success: true, items });
  } catch (err) {
    return NextResponse.json(
      { success: false, items: [], error: err instanceof Error ? err.message : "db error" },
      { status: 500 }
    );
  }
}

/** POST /api/history — upsert a watch record. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const required = ["batchId", "subjectSlug", "contentId", "lectureTitle"];
    for (const f of required) {
      if (!body?.[f]) {
        return NextResponse.json({ success: false, error: `missing ${f}` }, { status: 400 });
      }
    }

    const record = {
      userId: "local",
      batchId: String(body.batchId),
      batchName: String(body.batchName ?? ""),
      batchImage: body.batchImage ? String(body.batchImage) : null,
      subjectId: String(body.subjectId ?? body.subjectSlug ?? ""),
      subjectName: String(body.subjectName ?? ""),
      subjectSlug: String(body.subjectSlug),
      topicId: body.topicId ? String(body.topicId) : null,
      topicName: body.topicName ? String(body.topicName) : null,
      contentId: String(body.contentId),
      lectureTitle: String(body.lectureTitle),
      videoId: body.videoId ? String(body.videoId) : null,
      videoType: String(body.videoType ?? "youtube"),
      thumbnail: body.thumbnail ? String(body.thumbnail) : null,
      duration: body.duration ? String(body.duration) : null,
      positionSec: Number(body.positionSec ?? 0) || 0,
    };

    const saved = await db.watchHistory.upsert({
      where: { userId_contentId: { userId: "local", contentId: record.contentId } },
      create: record,
      update: { ...record, updatedAt: new Date() },
    });

    return NextResponse.json({ success: true, item: saved });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "db error" },
      { status: 500 }
    );
  }
}

/** DELETE /api/history?contentId=... or clear=all */
export async function DELETE(req: NextRequest) {
  try {
    const contentId = req.nextUrl.searchParams.get("contentId");
    if (contentId === "all" || req.nextUrl.searchParams.get("clear") === "all") {
      await db.watchHistory.deleteMany({ where: { userId: "local" } });
      return NextResponse.json({ success: true, cleared: true });
    }
    if (!contentId) {
      return NextResponse.json({ success: false, error: "contentId required" }, { status: 400 });
    }
    await db.watchHistory.deleteMany({ where: { userId: "local", contentId } });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "db error" },
      { status: 500 }
    );
  }
}
