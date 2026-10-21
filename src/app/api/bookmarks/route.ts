import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** GET /api/bookmarks — saved lectures & notes. */
export async function GET() {
  try {
    const items = await db.bookmark.findMany({
      where: { userId: "local" },
      orderBy: { createdAt: "desc" },
      take: 60,
    });
    return NextResponse.json({ success: true, items });
  } catch (err) {
    return NextResponse.json(
      { success: false, items: [], error: err instanceof Error ? err.message : "db error" },
      { status: 500 }
    );
  }
}

/** POST /api/bookmarks — toggle a bookmark. */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { kind = "lecture", contentId, batchId, batchName, title } = body ?? {};
    if (!contentId || !batchId || !title) {
      return NextResponse.json(
        { success: false, error: "contentId, batchId and title are required" },
        { status: 400 }
      );
    }

    const existing = await db.bookmark.findUnique({
      where: {
        userId_kind_contentId: { userId: "local", kind, contentId },
      },
    });

    if (existing) {
      await db.bookmark.delete({ where: { id: existing.id } });
      return NextResponse.json({ success: true, bookmarked: false });
    }

    const created = await db.bookmark.create({
      data: {
        userId: "local",
        kind,
        batchId,
        batchName: batchName ?? "",
        subjectName: body.subjectName ?? null,
        contentId,
        title,
        subtitle: body.subtitle ?? null,
        url: body.url ?? null,
        urlType: body.urlType ?? null,
        thumbnail: body.thumbnail ?? null,
      },
    });
    return NextResponse.json({ success: true, bookmarked: true, item: created });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "db error" },
      { status: 500 }
    );
  }
}
