"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import {
  GlassBadge,
  GlassButton,
  GlassCard,
  GlassSkeleton,
  SafeImage,
  EmptyState,
} from "./glass";
import {
  ArrowLeft,
  Users2,
  BookOpen,
  CalendarDays,
  Megaphone,
  ClipboardList,
  Play,
  FileText,
  Radio,
  Clock,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SubjectItem {
  id: string;
  name: string;
  slug: string;
  lectureCount: number;
}

interface BatchInfo {
  id: string;
  name: string;
  byName: string;
  description: string;
  startDate: string;
  endDate: string;
  language: string;
  previewImage: string;
  feeTotal: number;
}

type TabKey = "subjects" | "today" | "announcements" | "tests";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "subjects", label: "Subjects & Modules", icon: <BookOpen size={14} /> },
  { key: "today", label: "Today's Classes", icon: <CalendarDays size={14} /> },
  { key: "announcements", label: "Announcements", icon: <Megaphone size={14} /> },
  { key: "tests", label: "Test Series", icon: <ClipboardList size={14} /> },
];

export function BatchDetail({ batchId }: { batchId: string }) {
  const { navigate, back } = useApp();
  const fallbackImage = useApp((s) => s.batchImage);
  const [payload, setPayload] = useState<{
    id: string;
    batch: BatchInfo | null;
    subjects: SubjectItem[];
  } | null>(null);
  const [tab, setTab] = useState<TabKey>("subjects");

  const loading = !payload || payload.id !== batchId;
  const batch = loading ? null : payload!.batch;
  const subjects = loading ? [] : payload!.subjects;

  useEffect(() => {
    let alive = true;
    fetch(`/api/batches/${batchId}`)
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setPayload({
          id: batchId,
          batch: d?.success ? (d.batch as BatchInfo) : null,
          subjects: d?.success ? (d.subjects ?? []) : [],
        });
      })
      .catch(() => {
        if (alive) setPayload({ id: batchId, batch: null, subjects: [] });
      });
    return () => {
      alive = false;
    };
  }, [batchId]);

  return (
    <main className="flex-1 w-full px-3 sm:px-5">
      <div className="mx-auto max-w-7xl space-y-6 pb-6">
        {/* breadcrumb actions */}
        <div className="flex items-center gap-2 pt-6">
          <GlassButton variant="glass" size="sm" onClick={back}>
            <ArrowLeft size={15} /> Back
          </GlassButton>
        </div>

        {/* hero */}
        {loading ? (
          <div className="glass rounded-3xl overflow-hidden">
            <GlassSkeleton className="h-56 rounded-none" />
          </div>
        ) : batch ? (
          <GlassCard hover={false} sheen={false} className="overflow-hidden">
            <div className="relative">
              <div className="absolute inset-0">
                <SafeImage
                  src={batch.previewImage || fallbackImage}
                  alt={batch.name}
                  className="w-full h-full object-cover opacity-35 blur-md scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#07070b] via-[#07070b]/70 to-[#07070b]/30" />
              </div>
              <div className="relative p-6 sm:p-10 flex flex-col sm:flex-row gap-6 items-start">
                <div className="w-32 h-32 sm:w-40 sm:h-40 rounded-3xl overflow-hidden border border-white/15 shadow-[0_16px_50px_rgba(0,0,0,0.5)] shrink-0">
                  <SafeImage src={batch.previewImage || fallbackImage} alt={batch.name} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    {batch.language && <GlassBadge tone="gold">{batch.language}</GlassBadge>}
                    {batch.startDate && (
                      <GlassBadge>
                        <CalendarDays size={10} /> {fmtDate(batch.startDate)} → {fmtDate(batch.endDate)}
                      </GlassBadge>
                    )}
                  </div>
                  <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight">
                    {batch.name}
                  </h1>
                  <p className="mt-2 text-sm text-muted-foreground flex items-center gap-1.5">
                    <Users2 size={14} className="text-[#4a9eff]" /> {batch.byName}
                  </p>
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <span className="text-2xl font-extrabold text-gold">
                      {batch.feeTotal === 0 ? "Free" : `₹${batch.feeTotal.toLocaleString()}`}
                    </span>
                    <GlassBadge tone="green">Available to enrolled learners</GlassBadge>
                  </div>
                </div>
              </div>
            </div>

            {/* tabs */}
            <div className="relative border-t border-white/8 px-3 sm:px-6 py-3">
              <div className="flex gap-1.5 overflow-x-auto sb-scroll">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    className={cn(
                      "shrink-0 flex items-center gap-1.5 rounded-full px-4 h-9 text-[13px] font-semibold transition-all cursor-pointer",
                      tab === t.key
                        ? "btn-gold"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                    )}
                  >
                    {t.icon}
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          </GlassCard>
        ) : (
          <EmptyState title="Batch not found" hint="It may have been removed from the catalog." />
        )}

        {/* tab content */}
        {tab === "subjects" && (
          <SubjectsTab subjects={subjects} loading={loading} batchId={batchId} batchName={batch?.name} batchImage={batch?.previewImage} />
        )}
        {tab === "today" && batch && <TodayTab batchId={batchId} batchName={batch.name} batchImage={batch.previewImage} />}
        {tab === "announcements" && <AnnouncementsTab batchId={batchId} />}
        {tab === "tests" && <TestsTab batchId={batchId} />}
      </div>
    </main>
  );
}

/* ------------------------------- Subjects tab ------------------------------- */

function SubjectsTab({
  subjects,
  loading,
  batchId,
  batchName,
  batchImage,
}: {
  subjects: SubjectItem[];
  loading: boolean;
  batchId: string;
  batchName?: string;
  batchImage?: string;
}) {
  const { navigate } = useApp();
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => <GlassSkeleton key={i} className="h-28" />)}
      </div>
    );
  }
  if (subjects.length === 0) {
    return <EmptyState icon={<BookOpen size={22} />} title="No subjects published yet" hint="Check back soon." />;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sb-fade-up">
      {subjects.map((s) => (
        <button
          key={s.id}
          className="glass glass-sheen glass-hover rounded-3xl p-5 text-left cursor-pointer w-full"
          onClick={() =>
            navigate({
              view: "subject",
              batchId,
              batchName: batchName,
              batchImage: batchImage,
              subjectSlug: s.slug,
              subjectName: s.name,
            })
          }
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl btn-glass flex items-center justify-center text-[#4a9eff] shrink-0">
              <BookOpen size={20} />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold text-[15px] leading-snug line-clamp-2">{s.name}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {s.lectureCount} Lectures
              </p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

/* -------------------------------- Today tab --------------------------------- */

interface TodayClass {
  id: string;
  title: string;
  subject: string;
  startTime: string;
  endTime: string;
  thumbnail: string;
  duration: string;
  videoId: string;
}

function TodayTab({
  batchId,
  batchName,
  batchImage,
}: {
  batchId: string;
  batchName: string;
  batchImage?: string;
}) {
  const { navigate } = useApp();
  const [classes, setClasses] = useState<TodayClass[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/batches/${batchId}/today`)
      .then((r) => r.json())
      .then((d) => alive && setClasses(d?.classes ?? []))
      .catch(() => alive && setClasses([]));
    return () => {
      alive = false;
    };
  }, [batchId]);

  if (classes === null) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => <GlassSkeleton key={i} className="h-28" />)}
      </div>
    );
  }
  if (classes.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays size={22} />}
        title="No classes scheduled today"
        hint="Enjoy the rest day or revise a previous lecture."
      />
    );
  }
  return (
    <div className="space-y-4 sb-fade-up">
      {classes.map((c) => (
        <GlassCard key={c.id} className="p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="w-full sm:w-40 aspect-video rounded-2xl overflow-hidden shrink-0 relative border border-white/10">
              <SafeImage src={c.thumbnail} alt={c.title} className="w-full h-full object-cover" />
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="w-10 h-10 rounded-full btn-gold flex items-center justify-center">
                  <Play size={15} className="ml-0.5" />
                </span>
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <GlassBadge tone="red" className="mb-2">
                <Radio size={10} /> {c.subject || "Class"}
              </GlassBadge>
              <h3 className="font-bold text-[15px] leading-snug line-clamp-2">{c.title}</h3>
              <p className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1.5">
                <Clock size={12} />
                {fmtTime(c.startTime)}
                {c.duration ? ` · ${c.duration}` : ""}
              </p>
            </div>
            <GlassButton
              variant="gold"
              onClick={() =>
                navigate({
                  view: "batch",
                  batchId,
                  batchName,
                  batchImage,
                })
              }
            >
              Open Batch
            </GlassButton>
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

/* ---------------------------- Announcements tab ----------------------------- */

interface Announcement {
  id: string;
  description: string;
  createdAt: string;
  attachments: { name: string; url: string }[];
}

function AnnouncementsTab({ batchId }: { batchId: string }) {
  const [items, setItems] = useState<Announcement[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/batches/${batchId}/announcements`)
      .then((r) => r.json())
      .then((d) => alive && setItems(d?.announcements ?? []))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, [batchId]);

  if (items === null) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => <GlassSkeleton key={i} className="h-24" />)}
      </div>
    );
  }
  if (items.length === 0) {
    return <EmptyState icon={<Megaphone size={22} />} title="No announcements yet" hint="Faculty posts will appear here." />;
  }
  return (
    <div className="space-y-4 sb-fade-up max-h-[70vh] overflow-y-auto sb-scroll pr-1">
      {items.map((a) => (
        <GlassCard key={a.id} hover={false} className="p-5">
          <p className="text-xs text-muted-foreground mb-2">{fmtTime(a.createdAt)}</p>
          <div
            className="sb-prose text-sm line-clamp-6"
            dangerouslySetInnerHTML={{ __html: sanitize(a.description) }}
          />
          {a.attachments.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {a.attachments.map((att) => (
                <a
                  key={att.url}
                  href={att.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-full btn-glass px-3.5 h-8 text-xs font-semibold"
                >
                  <FileText size={12} className="text-[#4a9eff]" /> {att.name}
                </a>
              ))}
            </div>
          )}
        </GlassCard>
      ))}
    </div>
  );
}

/* ------------------------------- Tests tab ---------------------------------- */

interface TestItem {
  id: string;
  name: string;
  totalQuestions: number;
  marks: number;
  duration: string;
  type: string;
  subjects: string[];
}

function TestsTab({ batchId }: { batchId: string }) {
  const [tests, setTests] = useState<TestItem[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/batches/${batchId}/tests`)
      .then((r) => r.json())
      .then((d) => alive && setTests(d?.tests ?? []))
      .catch(() => alive && setTests([]));
    return () => {
      alive = false;
    };
  }, [batchId]);

  if (tests === null) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {Array.from({ length: 6 }).map((_, i) => <GlassSkeleton key={i} className="h-40" />)}
      </div>
    );
  }
  if (tests.length === 0) {
    return <EmptyState icon={<ClipboardList size={22} />} title="No tests published yet" hint="Mock tests will appear here." />;
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sb-fade-up max-h-[70vh] overflow-y-auto sb-scroll p-1">
      {tests.map((t) => (
        <GlassCard key={t.id} className="p-5">
          <div className="flex items-center justify-between gap-2 mb-3">
            <GlassBadge tone="violet">{t.type}</GlassBadge>
            <span className="text-[11px] text-muted-foreground">{t.duration}</span>
          </div>
          <h3 className="font-bold text-[15px] leading-snug line-clamp-2 min-h-[2.6em]">{t.name}</h3>
          <p className="mt-2 text-xs text-muted-foreground">
            {t.totalQuestions} Questions{t.marks ? ` · ${t.marks} marks` : ""}
          </p>
          <GlassButton variant="glass" size="sm" className="mt-4 w-full" disabled>
            <ClipboardList size={13} /> View on Platform
          </GlassButton>
        </GlassCard>
      ))}
    </div>
  );
}

/* --------------------------------- helpers ---------------------------------- */

function fmtDate(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function fmtTime(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Very small allowlist sanitizer for upstream HTML snippets. */
function sanitize(html: string): string {
  if (!html) return "";
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/ on\w+="[^"]*"/gi, "")
    .replace(/ on\w+='[^']*'/gi, "");
}
