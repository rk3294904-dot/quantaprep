"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/store";
import {
  GlassBadge,
  GlassButton,
  GlassCard,
  GlassSkeleton,
  SafeImage,
} from "./glass";
import {
  FileText,
  ListVideo,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  MonitorPlay,
  Monitor,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { lxpwWatchUrl } from "@/lib/study-api";
import { firebaseAuth, recordLectureProgress } from "@/lib/firebase";
import { NativePlayer } from "./native-player";

export interface StreamResolution {
  playable: boolean;
  kind: "mp4" | "hls" | "dash" | "unknown";
  url: string;
  reason?: string;
  folder?: string;
  engine?: "hls" | "dash" | "native";
  manifestVia?: string;
  clearKey?: string;
  clearKid?: string;
  sig?: string;
  title?: string;
  duration?: string;
}

/* --------------------------------- component --------------------------------- */

export function WatchView({
  batchId,
  subjectSlug,
  topicId,
  contentId,
  playerOnly = false,
}: {
  batchId: string;
  subjectSlug: string;
  topicId?: string;
  contentId: string;
  playerOnly?: boolean;
}) {
  const { navigate, back } = useApp();
  const appState = useApp();

  const [videoId, setVideoId] = useState<string | undefined>(appState.videoId || undefined);
  const [videoUrl, setVideoUrl] = useState<string | undefined>(appState.videoId || undefined);
  const [urlType, setUrlType] = useState<string>("youtube");
  const [stream, setStream] = useState<StreamResolution | null>(null);
  const [resolving, setResolving] = useState(false);
  const [title, setTitle] = useState(appState.lectureTitle ?? "");
  const [thumbnail, setThumbnail] = useState("");
  const [notes, setNotes] = useState<NoteDoc[]>([]);
  const [playlist, setPlaylist] = useState<PlaylistLecture[]>([]);
  const [loading, setLoading] = useState(!appState.videoId);
  const [bookmarkSet, setBookmarkSet] = useState(false);

  /* ----------------------------- fetch detail ----------------------------- */
  useEffect(() => {
    let alive = true;
    fetch(
      `/api/batches/${batchId}/subjects/${encodeURIComponent(subjectSlug)}/schedule/${contentId}`
    )
      .then((r) => r.json())
      .then(async (d) => {
        if (!alive || !d?.success) {
          if (alive) setLoading(false);
          return;
        }
        const lec = d.lecture ?? {};
        if (lec.title) setTitle(lec.title);
        if (lec.thumbnail) setThumbnail(lec.thumbnail);
        setNotes(d.notes ?? []);
        const type = (lec.urlType ?? "youtube").toLowerCase();
        setUrlType(type);
        setVideoUrl(lec.videoUrl ?? lec.videoId ?? undefined);
        setVideoId(type === "youtube" ? (lec.videoId ?? lec.videoUrl) : undefined);
        if (type === "youtube") {
          if (lec.videoId || lec.videoUrl) setVideoId(lec.videoId ?? lec.videoUrl);
          setLoading(false);
        } else {
          setVideoId(undefined);
          setResolving(false);
          setLoading(false);
          const apiId = lec.videoApiId ?? lec.videoId ?? "";
          if (apiId) {
            const q = lec.videoUrl ? `?url=${encodeURIComponent(lec.videoUrl)}` : "";
            fetch(`/api/streams/${encodeURIComponent(apiId)}${q}`)
              .then((r) => r.json())
              .then((sj) => {
                if (alive) setStream({ ...sj, playable: !!sj.playable });
              })
              .catch(() => {
                if (alive)
                  setStream({ playable: false, kind: "unknown", url: "", reason: "Could not resolve stream." });
              });
          } else if (alive) {
            setStream({ playable: false, kind: "unknown", url: "", reason: "No stream attached yet." });
          }
        }
      })
      .catch(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [batchId, subjectSlug, contentId]);

  /* ------------------------------ playlist -------------------------------- */
  useEffect(() => {
    if (!topicId) return;
    let alive = true;
    fetch(
      `/api/batches/${batchId}/subjects/${encodeURIComponent(subjectSlug)}/contents?contentType=videos&tag=${encodeURIComponent(topicId)}&pages=6`
    )
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setPlaylist(
          (d?.items ?? []).map((x: PlaylistLecture) => ({
            id: x.id,
            title: x.title,
            thumbnail: x.thumbnail,
            duration: x.duration,
            isLocked: x.isLocked,
          }))
        );
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [batchId, subjectSlug, topicId]);

  /* ------------------------------ bookmark -------------------------------- */
  useEffect(() => {
    let alive = true;
    fetch("/api/bookmarks")
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setBookmarkSet((d?.items ?? []).some((b: { contentId: string }) => b.contentId === contentId));
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [contentId]);

  const toggleBookmark = async () => {
    const res = await fetch("/api/bookmarks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "lecture",
        contentId,
        batchId,
        batchName: appState.batchName ?? "",
        subjectName: appState.subjectName ?? "",
        title,
        subtitle: appState.topicName ?? "",
        url: videoId,
        urlType: urlType === "youtube" ? "youtube" : stream?.kind ?? "hls",
        thumbnail: "",
      }),
    });
    const d = await res.json();
    if (d?.success) setBookmarkSet(d.bookmarked);
  };

  /* --------------------------- history tracking --------------------------- */
  const savePosition = useCallback(
    (pos: number) => {
      fetch("/api/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId,
          batchName: appState.batchName ?? "",
          batchImage: appState.batchImage ?? "",
          subjectId: subjectSlug,
          subjectName: appState.subjectName ?? prettify(subjectSlug),
          subjectSlug,
          topicId,
          topicName: appState.topicName ?? "",
          contentId,
          lectureTitle: title,
          videoId,
          videoType: urlType === "youtube" ? "youtube" : stream?.kind ?? "hls",
          positionSec: Math.floor(pos),
        }),
      }).catch(() => {});
      const user = firebaseAuth.currentUser;
      const minute = Math.floor(pos / 60);
      if (user && minute > leaderboardMinuteRef.current) {
        leaderboardMinuteRef.current = minute;
        recordLectureProgress({
          userId: user.uid,
          userName: user.displayName ?? "Learner",
          photoURL: user.photoURL,
          batchId,
          contentId,
          seconds: pos,
        }).catch(() => {});
      }
    },
    [batchId, subjectSlug, topicId, contentId, title, videoId, urlType, stream, appState.batchName, appState.batchImage, appState.subjectName, appState.topicName]
  );

  /* ------------------- history ping (once) -------------------- */
  const historyInitRef = useRef<string | null>(null);
  const leaderboardMinuteRef = useRef(-1);
  useEffect(() => {
    if (historyInitRef.current !== contentId) {
      historyInitRef.current = contentId;
      savePosition(0);
    }
  }, [contentId, savePosition]);

  if (playerOnly && !videoId && (loading || resolving)) {
    return (
      <main className="fixed inset-0 flex items-center justify-center bg-black p-3 sm:p-8">
        <GlassSkeleton className="aspect-video w-full max-w-6xl" />
      </main>
    );
  }

  if (playerOnly) {
    return (
      <main className="fixed inset-0 flex min-h-0 min-w-0 flex-col bg-[#060a14] overflow-y-auto sb-scroll">
        {/* Top bar — static, always visible */}
        <div className="sticky top-0 z-20 flex items-center gap-2 px-3 py-3 sm:px-5 bg-[#060a14]/85 backdrop-blur-md border-b border-white/5">
          <GlassButton variant="glass" size="sm" onClick={back} className="shrink-0">
            <ChevronLeft size={15} /> Back
          </GlassButton>
          {title && (
            <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground/90">
              {title}
            </p>
          )}
        </div>

        {/* Player — responsive, fills width */}
        <div className="w-full bg-black flex-shrink-0">
          <div className="mx-auto w-full max-w-[1600px]">
            <div className="relative w-full min-w-0">
              <PlayerBlock
                batchId={batchId}
                subjectSlug={subjectSlug}
                contentId={contentId}
                urlType={urlType}
                videoId={videoId}
                videoUrl={videoUrl}
                stream={stream}
                title={title}
                notes={notes}
                onPosition={savePosition}
                onOpenNote={(url, name) => navigate({ view: "pdf", lectureTitle: name, videoId: url })}
              />
            </div>
          </div>
        </div>

        {/* Below-player content: meta + notes + playlist, scrollable */}
        <div className="w-full flex-1 px-3 py-5 sm:px-5 sm:py-6">
          <div className="mx-auto max-w-[1600px] grid gap-5 grid-cols-1 xl:grid-cols-[1fr_360px]">
            <div className="space-y-4 min-w-0">
              <GlassCard hover={false} className="p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight leading-snug">{title}</h1>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {appState.batchName && (
                        <button
                          className="cursor-pointer"
                          onClick={() => navigate({ view: "batch", batchId })}
                        >
                          <GlassBadge tone="gold">{appState.batchName}</GlassBadge>
                        </button>
                      )}
                      {appState.subjectName && <GlassBadge>{appState.subjectName}</GlassBadge>}
                      {appState.topicName && <GlassBadge>{appState.topicName}</GlassBadge>}
                    </div>
                  </div>
                  {videoId && (
                    <GlassButton variant={bookmarkSet ? "gold" : "glass"} onClick={toggleBookmark}>
                      {bookmarkSet ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
                      {bookmarkSet ? "Saved" : "Save"}
                    </GlassButton>
                  )}
                </div>
              </GlassCard>

              <NotesCard notes={notes} />
            </div>

            <aside className="min-w-0">
              <PlaylistCard
                playlist={playlist}
                contentId={contentId}
                onOpen={(p) =>
                  navigate({
                    view: "watch",
                    batchId,
                    subjectSlug,
                    topicId,
                    contentId: p.id,
                    lectureTitle: p.title,
                  })
                }
              />
            </aside>
          </div>
        </div>
      </main>
    );
  }

  if (!videoId && (loading || resolving)) {
    return (
      <main className="flex-1 w-full px-3 sm:px-5">
        <div className="mx-auto max-w-7xl pt-6 space-y-4">
          <GlassSkeleton className="aspect-video max-w-4xl" />
          <GlassSkeleton className="h-8 w-2/3 max-w-xl" />
        </div>
      </main>
    );
  }

  if (!videoId) {
    return (
      <main className="flex-1 w-full px-3 sm:px-5">
        <div className="mx-auto max-w-7xl pt-6 pb-8 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <GlassButton variant="glass" size="sm" onClick={back} className="shrink-0">
              <ChevronLeft size={15} /> Back to chapter
            </GlassButton>
          </div>
          <div className="grid gap-5 grid-cols-1 xl:grid-cols-[1fr_360px]">
            <div className="space-y-4 min-w-0">
              <PlayerBlock
                batchId={batchId}
                subjectSlug={subjectSlug}
                contentId={contentId}
                urlType={urlType}
                videoId={videoId}
                videoUrl={videoUrl}
                stream={stream}
                title={title}
                notes={notes}
                onPosition={savePosition}
                onOpenNote={(url, name) => navigate({ view: "pdf", lectureTitle: name, videoId: url })}
              />
              <LectureMetaCard
                title={title}
                appState={appState}
                batchId={batchId}
                navigate={navigate}
                bookmarkSet={bookmarkSet}
                onBookmark={toggleBookmark}
              />
              <NotesCard notes={notes} />
            </div>
            <aside className="min-w-0">
              <PlaylistCard
                playlist={playlist}
                contentId={contentId}
                onOpen={(p) =>
                  navigate({
                    view: "watch",
                    batchId,
                    subjectSlug,
                    topicId,
                    contentId: p.id,
                    lectureTitle: p.title,
                  })
                }
              />
            </aside>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 w-full px-3 sm:px-5">
      <div className="mx-auto max-w-[1400px] pt-6 pb-8 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <GlassButton variant="glass" size="sm" onClick={back} className="shrink-0">
            <ChevronLeft size={15} /> Back to chapter
          </GlassButton>
        </div>

        <div className={cn("grid gap-5", "grid-cols-1 xl:grid-cols-[1fr_360px]")}>
          {/* player column */}
          <div className="space-y-4 min-w-0">
            <PlayerBlock
              batchId={batchId}
              subjectSlug={subjectSlug}
              contentId={contentId}
              urlType={urlType}
              videoId={videoId}
              videoUrl={videoUrl}
              stream={stream}
              title={title}
              notes={notes}
              onPosition={savePosition}
              onOpenNote={(url, name) => navigate({ view: "pdf", lectureTitle: name, videoId: url })}
            />

            <LectureMetaCard
              title={title}
              appState={appState}
              batchId={batchId}
              navigate={navigate}
              bookmarkSet={bookmarkSet}
              onBookmark={toggleBookmark}
            />

            <NotesCard notes={notes} />
          </div>

          {/* playlist column */}
          <aside className="min-w-0">
            <PlaylistCard
              playlist={playlist}
              contentId={contentId}
              onOpen={(p) =>
                navigate({
                  view: "watch",
                  batchId,
                  subjectSlug,
                  topicId,
                  contentId: p.id,
                  lectureTitle: p.title,
                })
              }
            />
          </aside>
        </div>
      </div>
    </main>
  );
}

/* ---------------------- Player (Native / Embed toggle) ---------------------- */

function PlayerBlock({
  batchId,
  subjectSlug,
  contentId,
  urlType,
  videoId,
  videoUrl,
  stream,
  title,
  notes,
  onPosition,
  onOpenNote,
}: {
  batchId: string;
  subjectSlug: string;
  contentId: string;
  urlType: string;
  videoId?: string;
  videoUrl?: string;
  stream: StreamResolution | null;
  title: string;
  notes?: NoteDoc[];
  onPosition?: (seconds: number) => void;
  onOpenNote?: (url: string, name: string) => void;
}) {
  const [mode, setMode] = useState<"embed" | "native">("embed");
  const canNative = urlType !== "youtube" && !!stream?.playable && !!stream.url;

  const embedSrc = lxpwWatchUrl({ batchId, subjectSlug, contentId, urlType, youtubeId: videoId, videoUrl });

  return (
    <div className="w-full min-w-0 space-y-2">
      {/* toggle bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="glass-soft rounded-full p-1 flex gap-1">
          <PlayerToggle active={mode === "embed"} onClick={() => setMode("embed")} icon={<Monitor size={13} />}>
            PW Player
          </PlayerToggle>
          <PlayerToggle active={mode === "native"} onClick={() => setMode("native")} icon={<MonitorPlay size={13} />} disabled={!canNative}>
            In-app
          </PlayerToggle>
        </div>
        {!canNative && mode === "embed" && (
          <span className="text-[11px] text-muted-foreground hidden sm:block">
            In-app player available for playable streams
          </span>
        )}
      </div>

      {/* player */}
      {mode === "native" && canNative ? (
        <NativePlayer
          stream={stream!}
          title={title}
          notes={notes}
          onPosition={onPosition}
          onOpenNote={onOpenNote}
        />
      ) : (
        <div className="sb-pw-embed relative w-full min-w-0 bg-black rounded-2xl overflow-hidden border border-white/10 select-none">
          <iframe
            key={embedSrc}
            src={embedSrc}
            title={title || "PW video player"}
            className="absolute inset-0 w-full h-full border-0"
            allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      )}
    </div>
  );
}

function PlayerToggle({
  active,
  onClick,
  icon,
  disabled,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-1.5 rounded-full px-3 h-8 text-xs font-semibold transition-all cursor-pointer",
        active ? "btn-gold" : "text-muted-foreground hover:text-foreground",
        disabled && "opacity-40 cursor-not-allowed hover:text-muted-foreground"
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/* ------------------------------ shared cards ------------------------------ */

function LectureMetaCard({
  title,
  appState,
  batchId,
  navigate,
  bookmarkSet,
  onBookmark,
}: {
  title: string;
  appState: ReturnType<typeof useApp.getState>;
  batchId: string;
  navigate: ReturnType<typeof useApp.getState>["navigate"];
  bookmarkSet: boolean;
  onBookmark: () => void;
}) {
  return (
    <GlassCard hover={false} className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight leading-snug">{title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {appState.batchName && (
              <button
                className="cursor-pointer"
                onClick={() => navigate({ view: "batch", batchId })}
              >
                <GlassBadge tone="gold">{appState.batchName}</GlassBadge>
              </button>
            )}
            {appState.subjectName && <GlassBadge>{appState.subjectName}</GlassBadge>}
            {appState.topicName && <GlassBadge>{appState.topicName}</GlassBadge>}
          </div>
        </div>
        <GlassButton variant={bookmarkSet ? "gold" : "glass"} onClick={onBookmark}>
          {bookmarkSet ? <BookmarkCheck size={15} /> : <Bookmark size={15} />}
          {bookmarkSet ? "Saved" : "Save"}
        </GlassButton>
      </div>
    </GlassCard>
  );
}

function NotesCard({ notes }: { notes: NoteDoc[] }) {
  const navigate = useApp((s) => s.navigate);
  return (
    <GlassCard hover={false} className="p-5 sm:p-6">
      <h2 className="flex items-center gap-2 font-bold">
        <FileText size={17} className="text-[#4a9eff]" /> Attached Notes & DPPs
      </h2>
      {notes.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No notes attached to this lecture.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {notes.map((n) => (
            <button
              key={n.id}
              onClick={() => navigate({ view: "pdf", lectureTitle: n.name, videoId: n.url })}
              className="flex items-center gap-3 rounded-2xl glass-soft px-4 py-3 group text-left cursor-pointer"
            >
              <span className="w-10 h-10 rounded-xl glass flex items-center justify-center text-[#4a9eff] shrink-0">
                <FileText size={17} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold line-clamp-1 group-hover:text-[#7cc0ff] transition-colors">
                  {n.name}
                </span>
                <span className="block text-[11px] text-muted-foreground">PDF · opens in viewer</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </GlassCard>
  );
}

function PlaylistCard({
  playlist,
  contentId,
  onOpen,
}: {
  playlist: PlaylistLecture[];
  contentId: string;
  onOpen: (p: PlaylistLecture) => void;
}) {
  return (
    <GlassCard hover={false} className="overflow-hidden xl:sticky xl:top-24">
      <div className="flex items-center gap-2 px-5 py-4 border-b border-white/8">
        <ListVideo size={17} className="text-[#4a9eff]" />
        <h2 className="font-bold text-sm">Chapter Playlist</h2>
        <span className="ml-auto text-xs text-muted-foreground">{playlist.length}</span>
      </div>
      <div className="max-h-[60vh] overflow-y-auto sb-scroll">
        {playlist.length === 0 ? (
          <p className="px-5 py-8 text-sm text-muted-foreground text-center">
            Playlist unavailable for this chapter.
          </p>
        ) : (
          playlist.map((p, i) => (
            <button
              key={p.id}
              onClick={() => onOpen(p)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors cursor-pointer border-b border-white/5 last:border-0",
                p.id === contentId ? "bg-[#4a9eff]/10" : "hover:bg-white/5"
              )}
            >
              <span className={cn("text-[11px] font-bold w-5 shrink-0", p.id === contentId ? "text-[#4a9eff]" : "text-muted-foreground")}>
                {i + 1}
              </span>
              <span className="relative w-20 aspect-video rounded-lg overflow-hidden shrink-0 border border-white/10">
                <SafeImage src={p.thumbnail} alt="" className="w-full h-full object-cover" />
              </span>
              <span className={cn("min-w-0 flex-1 text-[13px] leading-snug line-clamp-2 font-medium", p.id === contentId && "text-[#7cc0ff]")}>
                {p.title}
              </span>
            </button>
          ))
        )}
      </div>
    </GlassCard>
  );
}

/* --------------------------------- types ----------------------------------- */

interface NoteDoc {
  id: string;
  name: string;
  url: string;
  note?: string;
}

interface PlaylistLecture {
  id: string;
  title: string;
  thumbnail?: string;
  duration?: string;
  isLocked?: boolean;
}

/* --------------------------------- helpers ---------------------------------- */

function prettify(slug: string): string {
  return slug
    .split("-")
    .slice(0, -1)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}