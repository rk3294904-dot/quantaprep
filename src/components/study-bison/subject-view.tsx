"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import {
  GlassBadge,
  GlassButton,
  GlassCard,
  GlassSkeleton,
  EmptyState,
  SectionHeading,
} from "./glass";
import {
  ArrowLeft,
  ChevronRight,
  Search,
  Layers,
  FileText,
  PlayCircle,
  Home,
} from "lucide-react";

interface Topic {
  id: string;
  name: string;
  videos: number;
  notes: number;
  exercises: number;
}

export function SubjectView({
  batchId,
  subjectSlug,
}: {
  batchId: string;
  subjectSlug: string;
}) {
  const { navigate, back } = useApp();
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [subjectName, setSubjectName] = useState<string>("");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;
    fetch(`/api/batches/${batchId}/subjects/${encodeURIComponent(subjectSlug)}/topics`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setTopics(d?.topics ?? []);
        setSubjectName(prettifySlug(subjectSlug));
      })
      .catch(() => alive && setTopics([]));
    return () => {
      alive = false;
    };
  }, [batchId, subjectSlug]);

  const shownName = useApp((s) => s.subjectName) || subjectName || prettifySlug(subjectSlug);

  const filtered = useMemo(() => {
    if (!topics) return [];
    const q = query.trim().toLowerCase();
    if (!q) return topics;
    return topics.filter((t) => t.name.toLowerCase().includes(q));
  }, [topics, query]);

  const totals = useMemo(() => {
    if (!topics) return { lectures: 0, notes: 0 };
    return {
      lectures: topics.reduce((a, t) => a + t.videos, 0),
      notes: topics.reduce((a, t) => a + t.notes, 0),
    };
  }, [topics]);

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
            <button
              className="hover:text-[#7cc0ff] cursor-pointer line-clamp-1 max-w-[180px]"
              onClick={() => navigate({ view: "batch", batchId })}
            >
              {useApp.getState().batchName ?? "Batch"}
            </button>
            <ChevronRight size={12} />
            <span className="text-foreground/80 line-clamp-1 max-w-[240px]">{shownName}</span>
          </nav>
        </div>

        {/* header */}
        <div className="glass rounded-3xl p-6 sm:p-8 sb-fade-up">
          <GlassBadge tone="gold" className="mb-3">
            <Layers size={10} /> SUBJECT
          </GlassBadge>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">{shownName}</h1>
              {topics && (
                <p className="mt-2 text-sm text-muted-foreground">
                  {topics.length} chapters · {totals.lectures} lectures · {totals.notes} notes
                </p>
              )}
            </div>
            <div className="flex items-center glass-soft rounded-full px-4 w-full sm:w-80">
              <Search size={15} className="text-[#4a9eff] shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search chapters (e.g. Kinematics, Thermodynamics)..."
                className="w-full bg-transparent px-2.5 h-10 text-sm outline-none placeholder:text-muted-foreground/70"
                aria-label="Search chapters"
              />
            </div>
          </div>
        </div>

        {/* chapters */}
        <div>
          {topics === null ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 9 }).map((_, i) => <GlassSkeleton key={i} className="h-24" />)}
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<Search size={22} />}
              title="No chapters found"
              hint={query ? "Try another keyword." : "This subject has no chapters published yet."}
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sb-fade-up">
              {filtered.map((t, i) => (
                <button
                  key={t.id}
                  className="glass glass-sheen glass-hover rounded-3xl p-4 sm:p-5 text-left cursor-pointer w-full"
                  onClick={() =>
                    navigate({
                      view: "topic",
                      batchId,
                      subjectSlug,
                      topicId: t.id,
                      topicName: t.name,
                    })
                  }
                >
                  <div className="flex items-start gap-3">
                    <span className="w-9 h-9 rounded-xl btn-glass flex items-center justify-center text-xs font-extrabold text-[#7cc0ff] shrink-0">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-sm leading-snug line-clamp-2">{t.name}</h3>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <GlassBadge tone={t.videos > 0 ? "gold" : "neutral"}>
                          <PlayCircle size={10} /> {t.videos} Lectures
                        </GlassBadge>
                        <GlassBadge tone={t.notes > 0 ? "green" : "neutral"}>
                          <FileText size={10} /> {t.notes} Notes
                        </GlassBadge>
                        {t.exercises > 0 && <GlassBadge tone="violet">{t.exercises} DPP</GlassBadge>}
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* footer note */}
        <SectionHeading
          className="pt-4"
          title=""
        />
      </div>
    </main>
  );
}

function prettifySlug(slug: string): string {
  return slug
    .split("-")
    .slice(0, -1)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
