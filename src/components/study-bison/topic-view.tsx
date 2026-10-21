"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import {
  GlassBadge,
  GlassButton,
  GlassCard,
  GlassSkeleton,
  EmptyState,
} from "./glass";
import {
  ArrowLeft,
  ChevronRight,
  Home,
  PlayCircle,
  FileText,
  Search,
  Play,
  BookMarked,
  Loader2,
  ClipboardPen,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LectureItem {
  id: string;
  title: string;
  date?: string;
  startTime?: string;
  status?: string;
  isLocked?: boolean;
  videoId?: string;
  videoType?: string;
  thumbnail?: string;
  duration?: string;
}

interface NoteItem {
  id: string;
  title: string;
  date?: string;
}

type Mode = "lectures" | "notes" | "dpps";

export function TopicView({
  batchId,
  subjectSlug,
  topicId,
}: {
  batchId: string;
  subjectSlug: string;
  topicId: string;
}) {
  // Keyed remount resets all data state whenever the chapter changes
  return (
    <TopicData
      key={`${batchId}:${subjectSlug}:${topicId}`}
      batchId={batchId}
      subjectSlug={subjectSlug}
      topicId={topicId}
    />
  );
}

function TopicData({
  batchId,
  subjectSlug,
  topicId,
}: {
  batchId: string;
  subjectSlug: string;
  topicId: string;
}) {
  const { navigate, back } = useApp();
  const appState = useApp();
  const [mode, setMode] = useState<Mode>("lectures");
  const [lectures, setLectures] = useState<LectureItem[] | null>(null);
  const [notes, setNotes] = useState<NoteItem[] | null>(null);
  const [dpps, setDpps] = useState<NoteItem[] | null>(null);
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(
      `/api/batches/${batchId}/subjects/${encodeURIComponent(subjectSlug)}/contents?contentType=videos&tag=${encodeURIComponent(topicId)}&pages=6`
    )
      .then((r) => r.json())
      .then((d) => alive && setLectures(d?.items ?? []))
      .catch(() => alive && setLectures([]));
    fetch(
      `/api/batches/${batchId}/subjects/${encodeURIComponent(subjectSlug)}/contents?contentType=notes&tag=${encodeURIComponent(topicId)}&pages=4`
    )
      .then((r) => r.json())
      .then((d) => alive && setNotes(d?.items ?? []))
      .catch(() => alive && setNotes([]));
    fetch(
      `/api/batches/${batchId}/subjects/${encodeURIComponent(subjectSlug)}/contents?contentType=DppNotes&tag=${encodeURIComponent(topicId)}&pages=4`
    )
      .then((r) => r.json())
      .then((d) => alive && setDpps(d?.items ?? []))
      .catch(() => alive && setDpps([]));
    return () => {
      alive = false;
    };
  }, [batchId, subjectSlug, topicId]);

  const filteredLectures = useMemo(() => {
    if (!lectures) return [];
    const q = query.trim().toLowerCase();
    return q ? lectures.filter((l) => l.title.toLowerCase().includes(q)) : lectures;
  }, [lectures, query]);

  const filteredNotes = useMemo(() => {
    if (!notes) return [];
    const q = query.trim().toLowerCase();
    return q ? notes.filter((n) => n.title.toLowerCase().includes(q)) : notes;
  }, [notes, query]);

  const filteredDpps = useMemo(() => {
    if (!dpps) return [];
    const q = query.trim().toLowerCase();
    return q ? dpps.filter((n) => n.title.toLowerCase().includes(q)) : dpps;
  }, [dpps, query]);

  const openLecture = (l: LectureItem) => {
    if (!l.videoId) {
      // need detail lookup
      setPlaying(l.id);
      fetch(
        `/api/batches/${batchId}/subjects/${encodeURIComponent(subjectSlug)}/schedule/${l.id}`
      )
        .then((r) => r.json())
        .then((d) => {
          setPlaying(null);
          if (d?.success) {
            navigate({
              view: "watch",
              batchId,
              subjectSlug,
              topicId,
              contentId: l.id,
              lectureTitle: d.lecture.title || l.title,
              videoId: d.lecture.videoId ?? d.lecture.videoUrl ?? "",
              videoType: d.lecture.urlType ?? "youtube",
            });
          }
        })
        .catch(() => setPlaying(null));
      return;
    }
    navigate({
      view: "watch",
      batchId,
      subjectSlug,
      topicId,
      contentId: l.id,
      lectureTitle: l.title,
      videoId: l.videoId,
      videoType: l.videoType ?? "youtube",
    });
  };

  return (
    <main className="flex-1 w-full px-3 sm:px-5">
      <div className="mx-auto max-w-7xl space-y-6 pb-6">
        {/* breadcrumb */}
        <div className="flex flex-wrap items-center gap-2 pt-6 text-xs text-muted-foreground">
          <GlassButton variant="glass" size="sm" onClick={back}>
            <ArrowLeft size={14} /> Back
          </GlassButton>
          <nav className="flex items-center gap-1.5 flex-wrap" aria-label="Breadcrumb">
            <button className="hover:text-[#7cc0ff] cursor-pointer flex items-center gap-1" onClick={() => navigate({ view: "home" })}>
              <Home size={12} /> Home
            </button>
            <ChevronRight size={12} />
            <button className="hover:text-[#7cc0ff] cursor-pointer line-clamp-1 max-w-[160px]" onClick={() => navigate({ view: "batch", batchId })}>
              {appState.batchName ?? "Batch"}
            </button>
            <ChevronRight size={12} />
            <button
              className="hover:text-[#7cc0ff] cursor-pointer line-clamp-1 max-w-[200px]"
              onClick={() => navigate({ view: "subject", batchId, subjectSlug })}
            >
              {appState.subjectName ?? "Subject"}
            </button>
            <ChevronRight size={12} />
            <span className="text-foreground/80 line-clamp-1 max-w-[220px]">{appState.topicName ?? "Chapter"}</span>
          </nav>
        </div>

        {/* header + tabs */}
        <div className="glass rounded-3xl p-6 sm:p-8 sb-fade-up">
          <GlassBadge tone="gold" className="mb-3">
            <BookMarked size={10} /> CHAPTER
          </GlassBadge>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
            {appState.topicName ?? "Chapter"}
          </h1>

          <div className="mt-6 grid gap-3">
            <div className="w-full overflow-x-auto sb-scroll">
              <div className="glass-soft rounded-full p-1 flex w-max min-w-full sm:min-w-0 gap-1">
                <ModeTab active={mode === "lectures"} onClick={() => setMode("lectures")} icon={<PlayCircle size={14} />} count={lectures?.length}>
                  Lectures
                </ModeTab>
                <ModeTab active={mode === "notes"} onClick={() => setMode("notes")} icon={<FileText size={14} />} count={notes?.length}>
                  Notes
                </ModeTab>
                <ModeTab active={mode === "dpps"} onClick={() => setMode("dpps")} icon={<ClipboardPen size={14} />} count={dpps?.length}>
                  DPPs
                </ModeTab>
              </div>
            </div>
            <div className="flex items-center glass-soft rounded-full px-4 w-full">
              <Search size={15} className="text-[#4a9eff] shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={mode === "lectures" ? "Search lectures..." : mode === "notes" ? "Search notes..." : "Search DPPs..."}
                className="w-full bg-transparent px-2.5 h-10 text-sm outline-none placeholder:text-muted-foreground/70"
                aria-label={`Search ${mode}`}
              />
            </div>
          </div>
        </div>

        {/* content */}
        {mode === "lectures" ? (
          <LectureList
            items={filteredLectures}
            loading={lectures === null}
            playing={playing}
            onPlay={openLecture}
          />
        ) : mode === "notes" ? (
          <NoteList items={filteredNotes} loading={notes === null} />
        ) : (
          <DppList items={filteredDpps} loading={dpps === null} />
        )}
      </div>
    </main>
  );
}

function ModeTab({
  active,
  onClick,
  icon,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 sm:gap-2 rounded-full px-3 sm:px-5 h-10 text-sm font-semibold transition-all cursor-pointer whitespace-nowrap shrink-0",
        active ? "btn-gold" : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
      {children}
      {typeof count === "number" && (
        <span className={cn("text-[11px] rounded-full px-1.5 py-0.5", active ? "bg-black/20" : "bg-white/8")}>
          {count}
        </span>
      )}
    </button>
  );
}

function LectureList({
  items,
  loading,
  playing,
  onPlay,
}: {
  items: LectureItem[];
  loading: boolean;
  playing: string | null;
  onPlay: (l: LectureItem) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => <GlassSkeleton key={i} className="h-24" />)}
      </div>
    );
  }
  if (items.length === 0) {
    return <EmptyState icon={<PlayCircle size={22} />} title="No lectures here yet" hint="This chapter has no published lectures." />;
  }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sb-fade-up">
      {items.map((l, i) => (
        <GlassCard key={l.id} className="p-3.5 cursor-pointer">
          <div className="flex gap-3.5">
            <button
              onClick={() => onPlay(l)}
              className="relative w-32 sm:w-44 aspect-video rounded-2xl overflow-hidden shrink-0 group border border-white/10 cursor-pointer"
              aria-label={`Play ${l.title}`}
            >
              { }
              <img
                src={l.thumbnail || "/logo.png"}
                alt=""
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                onError={(e) => ((e.currentTarget.src = "/logo.png"))}
              />
              <span className="absolute inset-0 bg-black/25 flex items-center justify-center">
                {playing === l.id ? (
                  <Loader2 size={22} className="text-white animate-spin" />
                ) : (
                  <span className="w-10 h-10 rounded-full btn-gold flex items-center justify-center opacity-95 group-hover:scale-110 transition-transform">
                    <Play size={15} className="ml-0.5" />
                  </span>
                )}
              </span>
              {l.duration && (
                <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/70 backdrop-blur px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {l.duration}
                </span>
              )}
            </button>
            <div className="min-w-0 flex-1 py-0.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Lecture {i + 1}
                {l.date ? ` · ${new Date(l.date).toLocaleDateString()}` : ""}
              </p>
              <h3
                className="mt-1 font-bold text-sm leading-snug line-clamp-2 cursor-pointer hover:text-[#7cc0ff] transition-colors"
                onClick={() => onPlay(l)}
              >
                {l.title}
              </h3>
              <div className="mt-2 flex items-center gap-1.5">
                {l.videoId && <GlassBadge tone="green">Ready to play</GlassBadge>}
              </div>
            </div>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

function NoteList({ items, loading }: { items: NoteItem[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => <GlassSkeleton key={i} className="h-16" />)}
      </div>
    );
  }
  if (items.length === 0) {
    return <EmptyState icon={<FileText size={22} />} title="No notes here yet" hint="Class notes and DPPs will appear here." />;
  }
  return (
    <div className="space-y-3 sb-fade-up max-h-[70vh] overflow-y-auto sb-scroll pr-1">
      {items.map((n, i) => (
        <GlassCard key={n.id} className="px-4 py-3.5 flex items-center gap-3 sm:gap-4" hover sheen={false}>
          <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl glass-soft flex items-center justify-center text-[#4a9eff] shrink-0">
            <FileText size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Note {i + 1}{n.date ? ` · ${new Date(n.date).toLocaleDateString()}` : ""}
            </p>
            <h3 className="font-semibold text-sm line-clamp-1">{n.title}</h3>
          </div>
          <NoteOpenButton contentId={n.id} />
        </GlassCard>
      ))}
    </div>
  );
}

function DppList({ items, loading }: { items: NoteItem[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => <GlassSkeleton key={i} className="h-16" />)}
      </div>
    );
  }
  if (items.length === 0) {
    return <EmptyState icon={<ClipboardPen size={22} />} title="No DPPs here yet" hint="Daily Practice Problems will appear here." />;
  }
  return (
    <div className="space-y-3 sb-fade-up max-h-[70vh] overflow-y-auto sb-scroll pr-1">
      {items.map((n, i) => (
        <GlassCard key={n.id} className="px-3 py-3 sm:px-4 sm:py-3.5 flex items-center gap-3 sm:gap-4" hover sheen={false}>
          <span className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl glass-soft flex items-center justify-center text-violet-300 shrink-0">
            <ClipboardPen size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              DPP {i + 1}{n.date ? ` · ${new Date(n.date).toLocaleDateString()}` : ""}
            </p>
            <h3 className="font-semibold text-sm line-clamp-1">{n.title}</h3>
          </div>
          <NoteOpenButton contentId={n.id} />
        </GlassCard>
      ))}
    </div>
  );
}

/** Resolve the PDF url via the schedule endpoint, then open the in-app viewer. */
function NoteOpenButton({ contentId }: { contentId: string }) {
  const [busy, setBusy] = useState(false);
  const appState = useApp();

  const open = async () => {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/batches/${appState.batchId}/subjects/${encodeURIComponent(appState.subjectSlug!)}/schedule/${contentId}`
      );
      const d = await res.json();
      const url: string | undefined = d?.notes?.[0]?.url;
      if (url) {
        appState.navigate({
          view: "pdf",
          batchId: appState.batchId,
          subjectSlug: appState.subjectSlug,
          contentId,
          lectureTitle: d?.notes?.[0]?.name ?? "PDF Document",
          videoId: url,
        });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <GlassButton variant="glass" size="sm" onClick={open} disabled={busy} className="shrink-0">
      {busy ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
      Open
    </GlassButton>
  );
}
