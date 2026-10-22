"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { Flame, Clock3, FileText } from "lucide-react";
import { firebaseDb } from "@/lib/firebase";
import { currentStudyStreak, readStudyActivity, type StudyActivity } from "@/lib/study-activity";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export function StudyActivityButton({ user }: { user: User | null }) {
  const [result, setResult] = useState<{ uid: string; activity?: StudyActivity; failed?: boolean } | null>(null);
  const [open, setOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!user || !open) return;
    return onSnapshot(doc(firebaseDb, "leaderboard", user.uid), (snapshot) => {
      setResult({ uid: user.uid, activity: readStudyActivity(snapshot.data() ?? {}) });
    }, () => setResult({ uid: user.uid, failed: true }));
  }, [user, open, attempt]);

  const current = result?.uid === user?.uid ? result : null;
  const activity = current?.activity;
  const streak = activity?.hasStudyDays ? currentStudyStreak(activity.studyDays) : null;
  const number = new Intl.NumberFormat("en", { maximumFractionDigits: 1 });
  const today = new Date();
  const week = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 6 + index));
    return { key: date.toISOString().slice(0, 10), label: date.toLocaleDateString("en", { weekday: "narrow", timeZone: "UTC" }) };
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Open study activity and lecture streak" title="Study activity" className="flex h-11 min-w-11 shrink-0 items-center justify-center gap-1 rounded-full border border-amber-200/20 bg-amber-200/10 px-3 text-amber-200 transition-colors hover:bg-amber-200/20 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200 lg:hidden">
          <Flame size={19} aria-hidden="true" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={12} className="w-[min(340px,calc(100vw-24px))] rounded-3xl border-amber-200/15 bg-[#0c1524] p-5 text-foreground shadow-2xl">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/80">Your study rhythm</p>
        <h2 className="mt-2 text-xl font-extrabold">Lecture streak</h2>
        {!user ? <p className="mt-4 text-sm text-muted-foreground">Sign in using the account button to see your saved study activity.</p>
          : current?.failed ? <div role="alert" className="mt-4 text-sm"><p>Study activity couldn’t load.</p><button className="mt-3 rounded-lg border border-white/15 px-3 py-2" onClick={() => { setResult(null); setAttempt((value) => value + 1); }}>Try again</button></div>
          : !activity ? <p role="status" className="mt-5 text-sm text-muted-foreground">Loading study activity…</p>
          : <>
            <div className="mt-5 flex items-baseline gap-2"><span className="text-5xl font-black tracking-tight text-amber-200">{streak ?? "—"}</span><span className="text-sm text-muted-foreground">{streak === 1 ? "day" : "days"} in a row</span></div>
            <div className="mt-5 flex justify-between gap-2" aria-label="Lecture study days over the last seven UTC days">
              {week.map(({ key, label }) => {
                const studied = activity.studyDays.includes(key);
                return <div key={key} className="text-center"><span title={`${key}: ${studied ? "studied" : activity.hasStudyDays ? "no study recorded" : "not recorded"}`} aria-label={`${key}: ${studied ? "studied" : "no study recorded"}`} className={`flex h-8 w-8 items-center justify-center rounded-full border ${studied ? "border-amber-200/40 bg-amber-200/20 text-amber-200" : "border-white/10 text-muted-foreground"}`}><Flame size={13} aria-hidden="true" /></span><span className="mt-2 block text-[10px] text-muted-foreground">{label}</span></div>;
              })}
            </div>
            <div className="mt-5 space-y-3 border-t border-white/10 pt-4 text-xs">
              <p className="flex items-center gap-2"><Clock3 size={14} className="text-amber-200" />{activity.hasMinutes ? `${number.format(activity.lectureMinutesWatched)} minutes watched` : "Watched minutes not recorded"}</p>
              <p className="flex items-center gap-2"><FileText size={14} className="text-amber-200" />{activity.hasPdfs ? `${activity.pdfsOpened} PDFs opened` : "PDF opens not recorded"}</p>
            </div>
            <p className="mt-4 text-[11px] leading-5 text-muted-foreground">{activity.hasStudyDays ? "Consecutive lecture study days in UTC. Yesterday’s streak stays active until today ends." : "Study dates aren’t saved in your existing activity yet. A streak appears when lecture study days are available."}</p>
          </>}
      </PopoverContent>
    </Popover>
  );
}
