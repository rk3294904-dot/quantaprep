"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Maximize,
  Minimize,
  AlertCircle,
  FileText,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useApp } from "@/lib/store";
import { GlassButton } from "./glass";
import { cn } from "@/lib/utils";

export function PdfViewerView() {
  const { back, navigate } = useApp();
  const appState = useApp();
  const url = appState.videoId || "";
  const title = appState.lectureTitle || "PDF Document";

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<unknown>(null);
  const pdfDocRef = useRef<unknown>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const renderPage = useCallback(
    async (page: unknown, desiredScale: number) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const viewport = (page as { getViewport: (o: { scale: number }) => { width: number; height: number } }).getViewport({ scale: desiredScale });

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const outputScale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const renderTask = (page as { render: (o: unknown) => { promise: Promise<void>; cancel: () => void } }).render({
        canvasContext: ctx,
        viewport,
        transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined,
      });
      renderTaskRef.current = renderTask;
      await renderTask.promise;
    },
    []
  );

  useEffect(() => {
    if (!url) {
      setError("No PDF URL provided.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    // Route through our proxy to avoid CORS issues with remote PDFs
    const proxyUrl = url.startsWith("/") ? url : `/api/pdf?url=${encodeURIComponent(url)}`;

    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.mjs",
          import.meta.url
        ).toString();
        const loadingTask = pdfjsLib.getDocument({ url: proxyUrl });
        const pdf = await loadingTask.promise;
        if (cancelled) return;

        pdfDocRef.current = pdf;
        setNumPages(pdf.numPages);
        setPageNum(1);

        const page = await pdf.getPage(1);
        if (cancelled) return;
        await renderPage(page, scale);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setError("Could not load this PDF. It may be blocked by CORS or unavailable.");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        try {
          (renderTaskRef.current as { cancel: () => void }).cancel();
        } catch {
          /* noop */
        }
      }
      if (pdfDocRef.current) {
        try {
          (pdfDocRef.current as { destroy: () => void }).destroy();
        } catch {
          /* noop */
        }
        pdfDocRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    const pdf = pdfDocRef.current;
    if (!pdf || loading) return;

    let cancelled = false;
    (async () => {
      try {
        const page = await (pdf as { getPage: (n: number) => Promise<unknown> }).getPage(pageNum);
        if (cancelled) return;
        await renderPage(page, scale);
      } catch {
        /* noop */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pageNum, scale, loading, renderPage]);

  const goPrev = () => pageNum > 1 && setPageNum(pageNum - 1);
  const goNext = () => pageNum < numPages && setPageNum(pageNum + 1);
  const zoomIn = () => setScale((s) => Math.min(s + 0.25, 3));
  const zoomOut = () => setScale((s) => Math.max(s - 0.25, 0.5));

  const toggleFullscreen = () => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen();
  };

  if (!url) {
    return (
      <main className="flex-1 px-4 pb-20 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-3xl pt-10">
          <GlassButton variant="glass" size="sm" onClick={back}>
            <ArrowLeft size={15} /> Back
          </GlassButton>
          <div className="mt-10 flex flex-col items-center gap-3 text-center">
            <AlertCircle className="text-muted-foreground" size={32} />
            <p className="text-sm text-muted-foreground">No document was provided to display.</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 flex flex-col">
      {/* Toolbar */}
      <div className="sticky top-0 z-20 flex items-center gap-2 px-3 py-3 sm:px-5 bg-[#060a14]/90 backdrop-blur-md border-b border-white/5">
        <GlassButton variant="glass" size="sm" onClick={back} className="shrink-0">
          <ArrowLeft size={15} /> Back
        </GlassButton>
        <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground/90">{title}</p>

        <div className="hidden items-center gap-1 sm:flex">
          <button onClick={zoomOut} disabled={loading || !!error} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground disabled:opacity-40" aria-label="Zoom out">
            <ZoomOut size={16} />
          </button>
          <span className="w-14 text-center text-xs font-semibold tabular-nums text-muted-foreground">{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn} disabled={loading || !!error} className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground disabled:opacity-40" aria-label="Zoom in">
            <ZoomIn size={16} />
          </button>
        </div>

        <a href={url.startsWith("/") ? url : `/api/pdf?url=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer" download className="shrink-0">
          <GlassButton variant="glass" size="sm">
            <Download size={15} /> <span className="hidden sm:inline">Download</span>
          </GlassButton>
        </a>
        <button onClick={toggleFullscreen} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground" aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
          {fullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
        </button>
      </div>

      {/* PDF canvas area */}
      <div ref={containerRef} className="flex-1 overflow-auto sb-scroll bg-[#1a1a24] flex flex-col items-center py-4">
        {loading && (
          <div className="flex flex-col items-center gap-3 py-20">
            <Loader2 className="animate-spin text-[#4a9eff]" size={32} />
            <p className="text-sm text-muted-foreground">Loading document...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
            <AlertCircle className="text-red-400" size={32} />
            <p className="max-w-md text-sm text-white/85">{error}</p>
            <a href={url.startsWith("/") ? url : `/api/pdf?url=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer">
              <GlassButton variant="gold" size="sm">
                <FileText size={14} /> Open in new tab
              </GlassButton>
            </a>
          </div>
        )}

        {!loading && !error && (
          <canvas ref={canvasRef} className="rounded-lg shadow-2xl bg-white" />
        )}
      </div>

      {/* Page navigation */}
      {!loading && !error && numPages > 0 && (
        <div className="sticky bottom-0 z-20 flex items-center justify-center gap-3 bg-[#060a14]/90 backdrop-blur-md border-t border-white/5 px-4 py-2.5">
          <button onClick={goPrev} disabled={pageNum <= 1} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground disabled:opacity-30" aria-label="Previous page">
            <ChevronLeft size={18} />
          </button>
          <span className="text-xs font-semibold tabular-nums text-foreground/80">
            Page {pageNum} <span className="text-muted-foreground">of {numPages}</span>
          </span>
          <button onClick={goNext} disabled={pageNum >= numPages} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-white/10 hover:text-foreground disabled:opacity-30" aria-label="Next page">
            <ChevronRight size={18} />
          </button>
        </div>
      )}
    </main>
  );
}
