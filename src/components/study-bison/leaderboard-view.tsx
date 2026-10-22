"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowUpRight, Award, BookOpen, Crown, Medal, RefreshCw, Search, Sparkles, Trophy, Users, X } from "lucide-react";
import { getLeaderboard } from "@/lib/firebase";
import { useApp } from "@/lib/store";
import { GlassButton, SafeImage } from "./glass";
import { cn } from "@/lib/utils";

interface LeaderboardEntry {
  rank: number;
  legacy: boolean;
  points: number;
  id: string;
  displayName?: string;
  photoURL?: string;
  lectureMinutesWatched: number;
  pdfsOpened: number;
  hasMinutes: boolean;
  hasPdfs: boolean;
}

const number = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });
const score = (entry: LeaderboardEntry) => entry.legacy ? entry.points : entry.lectureMinutesWatched;
const podiumNames = ["The pace setter", "One to watch", "Making moves"];

function LearnerAvatar({ entry, podium = false }: { entry: LeaderboardEntry; podium?: boolean }) {
  return (
    <span className={cn("relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/15 bg-[#14233a] font-bold text-[#b7cde9]", podium ? "h-16 w-16 text-2xl sm:h-20 sm:w-20" : "h-10 w-10 text-sm")}>
      {entry.photoURL ? <SafeImage src={entry.photoURL} alt="" className="h-full w-full object-cover" /> : (entry.displayName?.trim().slice(0, 1) || "L").toUpperCase()}
    </span>
  );
}

function PodiumCard({ entry }: { entry: LeaderboardEntry }) {
  return (
    <article className={cn("lb-podium relative flex min-w-0 flex-col items-center rounded-[1.5rem] px-2 pb-5 pt-7 text-center sm:px-5 sm:pb-7", `lb-place-${entry.rank}`)} aria-label={`Rank ${entry.rank}: ${entry.displayName || "Learner"}`}>
      <span className="lb-medallion absolute -top-4 flex h-8 w-8 items-center justify-center rounded-full border text-xs font-black">
        {entry.rank === 1 ? <Crown size={17} aria-hidden="true" /> : `0${entry.rank}`}
      </span>
      <div className="lb-avatar-wrap relative rounded-full p-1.5">
        <LearnerAvatar entry={entry} podium />
        {entry.rank === 1 && <Sparkles className="lb-sparkle absolute -right-2 top-0" size={21} aria-hidden="true" />}
      </div>
      <p className="mt-4 w-full truncate text-xs font-extrabold sm:text-base" title={entry.displayName || "Learner"}>{entry.displayName || "Learner"}</p>
      <p className="mt-1 hidden text-[11px] text-muted-foreground sm:block">{podiumNames[entry.rank - 1]}</p>
      <p className="lb-score mt-4 text-xl font-black tracking-tight sm:text-3xl">{entry.legacy || entry.hasMinutes ? number.format(score(entry)) : "—"}</p>
      <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground sm:text-[10px]">{entry.legacy ? "Learning points" : "Minutes watched"}</span>
      <p className="mt-2 text-[10px] text-muted-foreground">{entry.legacy ? "Previous rankings" : entry.hasPdfs ? `${number.format(entry.pdfsOpened)} PDFs opened` : "PDFs not recorded"}</p>
      <div className="lb-placement mt-5 flex items-center justify-center gap-1.5 text-[10px] font-bold sm:text-xs">
        <Medal size={14} aria-hidden="true" /> {entry.rank === 1 ? "Champion" : entry.rank === 2 ? "Runner-up" : "Third place"}
      </div>
    </article>
  );
}

export function LeaderboardView() {
  const { back, navigate } = useApp();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let alive = true;
    getLeaderboard()
      .then((nextEntries) => { if (alive) setEntries(nextEntries); })
      .catch(() => { if (alive) setFailed(true); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [attempt]);

  const filtered = entries.filter((entry) => (entry.displayName || "Learner").toLowerCase().includes(search.trim().toLowerCase()));
  const legacy = entries[0]?.legacy ?? false;
  const totalMinutes = entries.reduce((total, entry) => total + score(entry), 0);
  const topScore = entries[0] ? score(entries[0]) : 0;
  const podium = [entries[1], entries[0], entries[2]].filter((entry): entry is LeaderboardEntry => !!entry);

  return (
    <main className="lb-page min-w-0 flex-1 px-3 pb-16 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-6xl pt-6 sm:pt-10">
        <div className="flex items-center justify-between gap-3">
          <GlassButton variant="glass" size="sm" onClick={back}><ArrowLeft size={15} /> Back</GlassButton>
          <span className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"><span className="h-1.5 w-1.5 rounded-full bg-[#e7bd6d]" /> All-time rankings</span>
        </div>

        <header className="relative pb-8 pt-10 sm:pb-12 sm:pt-14">
          <span className="lb-eyebrow inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em]"><Trophy size={13} /> The learning league</span>
          <div className="mt-5 flex items-end justify-between gap-6">
            <div>
              <h1 className="text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-6xl">Small steps.<br /><span className="lb-heading-accent">Standout learners.</span></h1>
              <p className="mt-5 max-w-md text-sm leading-6 text-muted-foreground">Every lecture moves you forward. Meet the learners turning consistency into a place at the top.</p>
            </div>
            <div className="lb-hero-trophy hidden h-28 w-28 shrink-0 items-center justify-center rounded-[2rem] sm:flex" aria-hidden="true"><Trophy size={52} strokeWidth={1.25} /></div>
          </div>
        </header>

        {!loading && !failed && legacy && <p role="status" className="mb-6 rounded-2xl border border-amber-200/20 bg-amber-200/5 px-5 py-4 text-sm leading-6 text-amber-100">Showing previous points rankings until watched-minute or PDF activity is available.</p>}

        {loading ? (
          <div role="status" aria-label="Loading leaderboard" className="space-y-6">
            <span className="sr-only">Loading leaderboard</span>
            <div className="grid grid-cols-3 items-end gap-2 sm:gap-5">{[0, 1, 2].map((index) => <div key={index} className={cn("sb-skeleton rounded-3xl", index === 1 ? "h-72" : "h-60")} />)}</div>
            <div className="sb-skeleton h-56 rounded-3xl" />
          </div>
        ) : failed ? (
          <section role="alert" className="lb-panel rounded-3xl px-6 py-14 text-center">
            <RefreshCw size={28} className="mx-auto text-[#e7bd6d]" />
            <h2 className="mt-5 text-xl font-bold">Rankings are taking a break</h2>
            <p className="mt-2 text-sm text-muted-foreground">We couldn’t load the leaderboard. Try again in a moment.</p>
            <GlassButton variant="glass" className="mt-6" onClick={() => { setLoading(true); setFailed(false); setAttempt((value) => value + 1); }}>Try again</GlassButton>
          </section>
        ) : entries.length === 0 ? (
          <section className="lb-panel rounded-3xl px-6 py-14 text-center">
            <Trophy size={38} className="mx-auto text-[#e7bd6d]" />
            <h2 className="mt-5 text-2xl font-extrabold">The podium is waiting</h2>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted-foreground">No saved leaderboard entries are available yet. Signed-in learners appear here even before their first lecture.</p>
            <GlassButton variant="gold" className="mt-6" onClick={() => navigate({ view: "home" })}>Explore lectures <ArrowUpRight size={16} /></GlassButton>
          </section>
        ) : (
          <>
            <section aria-labelledby="podium-heading" className="lb-stage relative rounded-[2rem] px-3 pb-5 pt-6 sm:px-8 sm:pb-8">
              <div className="mb-10 flex items-center justify-between gap-3">
                <h2 id="podium-heading" className="flex items-center gap-2 text-sm font-bold"><Crown size={17} className="text-[#e7bd6d]" /> The top three</h2>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Earned, lecture by lecture</span>
              </div>
              <div className="mx-auto grid max-w-3xl grid-cols-3 items-end gap-2 sm:gap-5">
                {podium.map((entry) => <PodiumCard key={entry.id} entry={entry} />)}
              </div>
            </section>

            <div className="my-6 grid grid-cols-3 divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/[0.02] py-5">
              {[{ icon: Users, value: entries.length, label: "Ranked learners" }, { icon: Award, value: totalMinutes, label: legacy ? "Learners’ points" : "Learners’ minutes" }, { icon: Trophy, value: topScore, label: legacy ? "Leading points" : "Leading minutes" }].map(({ icon: Icon, value, label }) => (
                <div key={label} className="min-w-0 px-2 text-center"><Icon size={15} className="mx-auto mb-2 text-[#e7bd6d]" aria-hidden="true" /><p className="break-words text-lg font-extrabold sm:text-2xl">{number.format(value)}</p><p className="mt-1 text-[10px] text-muted-foreground sm:text-xs">{label}</p></div>
              ))}
            </div>

            <section className="lb-panel overflow-hidden rounded-3xl" aria-labelledby="rankings-heading">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 p-5 sm:px-7">
                <div><h2 id="rankings-heading" className="text-lg font-extrabold">The leaderboard</h2><p className="mt-1 text-xs text-muted-foreground">{legacy ? "All learners · previous points rankings" : "All learners · watched minutes first, PDF opens break ties"}</p></div>
                <div className="flex h-11 w-full items-center gap-2 rounded-xl border border-white/10 bg-[#060d19] px-3 focus-within:border-[#e7bd6d]/60 sm:w-60">
                  <Search size={15} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                  <input aria-label="Search ranked learners" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a learner…" className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
                  {search && <button type="button" aria-label="Clear search" onClick={() => setSearch("")} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg hover:bg-white/10"><X size={14} /></button>}
                </div>
              </div>
              <div className="flex justify-between px-5 pb-2 pt-4 text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground sm:px-7"><span>Rank / Learner</span><span>{legacy ? "Learning points" : "Minutes watched"}</span></div>
              <div className="space-y-2 p-3 sm:px-5 sm:pb-5" aria-live="polite">
                {filtered.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">No ranked learners match “{search}”.</p> : filtered.map((entry) => (
                  <div key={entry.id} className={cn("lb-rank-row flex items-center gap-3 rounded-2xl border px-3 py-3 sm:gap-4 sm:px-4", entry.rank <= 3 ? `lb-rank-${entry.rank}` : "border-white/5 bg-white/[0.015]")}>
                    <span className="w-6 shrink-0 text-center text-xs font-extrabold text-muted-foreground">{entry.rank <= 3 ? <Medal className="mx-auto lb-row-medal" size={20} aria-label={`Rank ${entry.rank}`} /> : String(entry.rank).padStart(2, "0")}</span>
                    <LearnerAvatar entry={entry} />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{entry.displayName || "Learner"}</p><p className="mt-1 text-[10px] text-muted-foreground">{entry.rank === 1 ? "Leading the league" : entry.rank <= 3 ? "Podium finisher" : "Building momentum"}</p></div>
                    <div className="shrink-0 text-right"><p className="text-sm font-extrabold tabular-nums sm:text-base">{entry.legacy || entry.hasMinutes ? number.format(score(entry)) : "—"}</p><span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">{entry.legacy ? "pts" : "min"}</span><p className="mt-1 text-[10px] text-muted-foreground">{entry.legacy ? "Previous rankings" : entry.hasPdfs ? `${number.format(entry.pdfsOpened)} PDFs opened` : "PDFs not recorded"}</p></div>
                  </div>
                ))}
              </div>
            </section>
          </>
        )}

        <footer className="mt-7 flex items-start gap-3 rounded-2xl border border-white/5 bg-white/[0.02] p-5">
          <BookOpen size={19} className="mt-0.5 shrink-0 text-[#e7bd6d]" aria-hidden="true" />
          <div><p className="text-sm font-bold">Your next lecture counts.</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{legacy ? "Previous points rankings stay visible until watched-minute or PDF activity becomes available. Points are not converted into minutes." : "Rankings use saved lecture minutes, then PDF opens. Older points are not converted into minutes."}</p></div>
        </footer>
      </div>
    </main>
  );
}
