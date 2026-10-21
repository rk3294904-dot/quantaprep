"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Loader2, Medal, Trophy } from "lucide-react";
import { getLeaderboard } from "@/lib/firebase";
import { useApp } from "@/lib/store";
import { GlassButton, GlassCard, SafeImage } from "./glass";

interface LeaderboardEntry {
  rank: number;
  id: string;
  displayName?: string;
  photoURL?: string;
  points?: number;
}

export function LeaderboardView() {
  const { back } = useApp();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getLeaderboard()
      .then((nextEntries) => alive && setEntries(nextEntries))
      .catch(() => alive && setEntries([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="flex-1 px-4 pb-20 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-4xl pt-8 sm:pt-12">
        <GlassButton variant="glass" size="sm" onClick={back}>
          <ArrowLeft size={15} /> Back
        </GlassButton>
        <div className="mt-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl btn-glass text-[#4a9eff]">
            <Trophy size={30} />
          </div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.24em] text-[#4a9eff]">Study Bison</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-5xl">Learning leaderboard</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-muted-foreground">Earn points by watching lectures and see how your learning progress compares.</p>
        </div>

        <GlassCard hover={false} className="mt-10 overflow-hidden p-2 sm:p-4">
          <div className="flex items-center gap-2 border-b border-white/10 px-3 py-4 sm:px-5">
            <Medal size={18} className="text-[#4a9eff]" />
            <h2 className="font-bold">Top learners</h2>
            <span className="ml-auto text-xs text-muted-foreground">Points from lectures</span>
          </div>
          {loading ? (
            <div className="flex justify-center py-16"><Loader2 size={25} className="animate-spin text-[#4a9eff]" /></div>
          ) : entries.length === 0 ? (
            <p className="px-5 py-16 text-center text-sm text-muted-foreground">Start watching lectures to appear here.</p>
          ) : (
            <div className="space-y-2 p-2 sm:p-3">
              {entries.map((entry) => (
                <div key={entry.id} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] px-3 py-3 sm:gap-4 sm:px-5">
                  <span className="w-7 text-center text-sm font-extrabold text-[#4a9eff]">{entry.rank}</span>
                  <SafeImage src={entry.photoURL} alt="" className="h-10 w-10 rounded-full object-cover" />
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{entry.displayName ?? "Learner"}</span>
                  <span className="text-sm font-extrabold text-[#7cc0ff]">{entry.points ?? 0} pts</span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>
    </main>
  );
}
