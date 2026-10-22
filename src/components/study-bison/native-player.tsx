"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Loader2,
  Gauge,
  FileText,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StreamResolution } from "./player-view";
import { GlassCard } from "./glass";

interface NoteDoc {
  id: string;
  name: string;
  url: string;
  note?: string;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

export function NativePlayer({
  stream,
  title,
  notes,
  onPosition,
  onOpenNote,
}: {
  stream: StreamResolution;
  title: string;
  notes?: NoteDoc[];
  onPosition?: (seconds: number) => void;
  onOpenNote?: (url: string, name: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<unknown>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [showSpeed, setShowSpeed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showSlides, setShowSlides] = useState(false);

  /* ---- attach hls.js / dash.js ---- */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let destroyed = false;
    setLoading(true);
    setError(null);

    const handleLoaded = () => {
      if (destroyed) return;
      setDuration(video.duration || 0);
      setLoading(false);
      video.playbackRate = speed;
    };
    const handleTime = () => {
      if (destroyed) return;
      setCurrent(video.currentTime);
      onPosition?.(video.currentTime);
    };
    const handlePlay = () => !destroyed && setPlaying(true);
    const handlePause = () => !destroyed && setPlaying(false);
    const handleErr = () => {
      if (destroyed) return;
      setError("Playback failed. Try the embedded player instead.");
      setLoading(false);
    };

    video.addEventListener("loadedmetadata", handleLoaded);
    video.addEventListener("timeupdate", handleTime);
    video.addEventListener("play", handlePlay);
    video.addEventListener("pause", handlePause);
    video.addEventListener("error", handleErr);

    (async () => {
      const url = stream.url;
      const kind = stream.kind;

      try {
        if (kind === "hls") {
          // Safari native HLS
          if (video.canPlayType("application/vnd.apple.mpegurl")) {
            video.src = url;
            return;
          }
          const Hls = (await import("hls.js")).default;
          if (Hls.isSupported()) {
            const hls = new Hls({ enableWorker: true, lowLatencyMode: false });
            hlsRef.current = hls;
            hls.loadSource(url);
            hls.attachMedia(video);
            hls.on(Hls.Events.ERROR, (_e: unknown, data: { fatal: boolean; details: string }) => {
              if (data.fatal && !destroyed) {
                setError("Stream error. Try the embedded player.");
                setLoading(false);
              }
            });
          } else {
            setError("HLS not supported in this browser.");
            setLoading(false);
          }
        } else if (kind === "dash") {
          const dashjs = await import("dashjs");
          const MediaPlayerFactory = (dashjs as unknown as { MediaPlayer: () => { create: () => { initialize: (el: HTMLVideoElement, url: string, autoPlay: boolean) => void; setProtectionData: (data: Record<string, unknown>) => void } } }).MediaPlayer;
          const player = MediaPlayerFactory().create();
          hlsRef.current = player;
          player.initialize(video, url, false);

          if (stream.clearKey && stream.clearKid) {
            player.setProtectionData({
              "org.w3.clearkey": {
                clearkeys: { [stream.clearKid]: stream.clearKey },
              },
            });
          }
        } else {
          // mp4 / webm / direct
          video.src = url;
        }
      } catch {
        if (!destroyed) {
          setError("Could not initialize the player.");
          setLoading(false);
        }
      }
    })();

    return () => {
      destroyed = true;
      video.removeEventListener("loadedmetadata", handleLoaded);
      video.removeEventListener("timeupdate", handleTime);
      video.removeEventListener("play", handlePlay);
      video.removeEventListener("pause", handlePause);
      video.removeEventListener("error", handleErr);
      try {
        const hls = hlsRef.current as { destroy?: () => void; reset?: () => void } | null;
        hls?.destroy?.();
      } catch {
        /* noop */
      }
      hlsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stream.url, stream.kind]);

  /* ---- fullscreen tracking ---- */
  useEffect(() => {
    const onFs = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) void v.play();
    else v.pause();
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement) void document.exitFullscreen();
    else void el.requestFullscreen();
  }, []);

  const changeSpeed = useCallback((s: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = s;
    setSpeed(s);
    setShowSpeed(false);
  }, []);

  const seek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const t = Number(e.target.value);
    v.currentTime = t;
    setCurrent(t);
  }, []);

  const fmt = (s: number) => {
    if (!s || !isFinite(s)) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <div ref={containerRef} className="relative w-full aspect-video bg-black rounded-2xl overflow-hidden border border-white/10 select-none group">
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full"
        playsInline
        onClick={togglePlay}
      />

      {/* loading */}
      {loading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <Loader2 size={32} className="text-[#4a9eff] animate-spin" />
        </div>
      )}

      {/* error */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 px-6 text-center">
          <p className="max-w-md text-sm text-white/85">{error}</p>
        </div>
      )}

      {/* slides toggle (top-left) */}
      {notes && notes.length > 0 && (
        <button
          onClick={() => setShowSlides((s) => !s)}
          className="absolute top-3 left-3 z-20 flex items-center gap-1.5 rounded-full glass-soft px-3 py-1.5 text-xs font-semibold text-white/90 transition-colors hover:bg-white/15 cursor-pointer"
        >
          <FileText size={13} /> Slides
          <span className="rounded-full bg-white/15 px-1.5 text-[10px]">{notes.length}</span>
        </button>
      )}

      {/* slides panel */}
      {showSlides && notes && notes.length > 0 && (
        <div className="absolute top-12 left-3 z-30 w-64 max-w-[80%] rounded-2xl glass border border-white/10 shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/8">
            <span className="text-xs font-bold text-white/90">Lecture Slides</span>
            <button onClick={() => setShowSlides(false)} className="text-white/60 hover:text-white cursor-pointer">
              <X size={14} />
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto sb-scroll">
            {notes.map((n) => (
              <button
                key={n.id}
                onClick={() => onOpenNote?.(n.url, n.name)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-white/8 border-b border-white/5 last:border-0 cursor-pointer"
              >
                <span className="w-8 h-8 rounded-lg glass-soft flex items-center justify-center text-[#4a9eff] shrink-0">
                  <FileText size={13} />
                </span>
                <span className="min-w-0 flex-1 text-[12px] font-medium text-white/85 line-clamp-1">{n.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* controls */}
      {!error && (
        <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-8 pb-2 px-3 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {/* seek bar */}
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[11px] tabular-nums text-white/80 w-9 text-right">{fmt(current)}</span>
            <input
              type="range"
              min={0}
              max={duration || 0}
              value={current}
              onChange={seek}
              className="flex-1 h-1.5 accent-[#4a9eff] cursor-pointer"
              aria-label="Seek"
            />
            <span className="text-[11px] tabular-nums text-white/80 w-9">{fmt(duration)}</span>
          </div>

          {/* buttons */}
          <div className="flex items-center gap-2">
            <button onClick={togglePlay} className="text-white/90 hover:text-white cursor-pointer" aria-label={playing ? "Pause" : "Play"}>
              {playing ? <Pause size={18} /> : <Play size={18} />}
            </button>
            <button onClick={toggleMute} className="text-white/90 hover:text-white cursor-pointer" aria-label={muted ? "Unmute" : "Mute"}>
              {muted ? <VolumeX size={17} /> : <Volume2 size={17} />}
            </button>

            {/* speed */}
            <div className="relative">
              <button
                onClick={() => setShowSpeed((s) => !s)}
                className="flex items-center gap-1 rounded-full glass-soft px-2.5 py-1 text-[11px] font-bold text-white/90 hover:bg-white/15 transition-colors cursor-pointer"
                aria-label="Playback speed"
              >
                <Gauge size={12} /> {speed}x
              </button>
              {showSpeed && (
                <div className="absolute bottom-8 left-0 rounded-xl glass border border-white/10 shadow-2xl py-1 min-w-[90px]">
                  {SPEEDS.map((s) => (
                    <button
                      key={s}
                      onClick={() => changeSpeed(s)}
                      className={cn(
                        "w-full px-3 py-1.5 text-left text-xs font-semibold transition-colors hover:bg-white/10 cursor-pointer",
                        s === speed ? "text-[#4a9eff]" : "text-white/80"
                      )}
                    >
                      {s}x{s === 1 && " (Normal)"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex-1" />
            <span className="text-[11px] font-medium text-white/60 line-clamp-1 hidden sm:block max-w-[40%]">{title}</span>
            <button onClick={toggleFullscreen} className="text-white/90 hover:text-white cursor-pointer ml-2" aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
              {fullscreen ? <Minimize size={17} /> : <Maximize size={17} />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
