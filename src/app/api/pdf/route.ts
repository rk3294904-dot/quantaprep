import { NextRequest, NextResponse } from "next/server";
import { getGuestToken } from "@/lib/study-api";

export const dynamic = "force-dynamic";

/** Domains that require the PW guest token for asset access. */
const PW_DOMAINS = ["pw.live", "penpencilvdo", "learnxpw.site"];

function isPwUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return PW_DOMAINS.some((d) => host.includes(d));
  } catch {
    return false;
  }
}

/**
 * GET /api/pdf?url=<encoded-pdf-url>
 * Proxies a remote PDF through our own origin so the in-app pdf.js viewer
 * can load it without CORS restrictions.
 */
export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ success: false, error: "url required" }, { status: 400 });
  }

  try {
    const headers: Record<string, string> = {
      Accept: "application/pdf,*/*",
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    };

    if (isPwUrl(url)) {
      const token = await getGuestToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
        headers["token"] = token;
        headers["client-type"] = "WEB";
        headers["client-version"] = "1.0.0";
      }
    }

    const res = await fetch(url, {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok || !res.body) {
      return NextResponse.json(
        { success: false, error: `Upstream returned ${res.status}` },
        { status: 502 }
      );
    }

    const contentType = res.headers.get("Content-Type") ?? "application/pdf";

    // If the upstream returned HTML (error page), don't pass it through as a PDF
    if (contentType.includes("text/html")) {
      return NextResponse.json(
        { success: false, error: "Upstream returned an error page instead of a PDF." },
        { status: 502 }
      );
    }

    const outHeaders = new Headers({
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=300",
      "Access-Control-Allow-Origin": "*",
    });
    const len = res.headers.get("Content-Length");
    if (len) outHeaders.set("Content-Length", len);

    return new NextResponse(res.body, { headers: outHeaders });
  } catch {
    return NextResponse.json(
      { success: false, error: "Could not fetch the PDF." },
      { status: 502 }
    );
  }
}
