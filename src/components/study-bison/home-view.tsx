"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { firebaseAuth, enrollInBatch, getEnrolledBatchIds, signInWithGoogle } from "@/lib/firebase";
import { GlassBadge, GlassButton, GlassCard, GlassSkeleton, SafeImage, EmptyState } from "./glass";
import { BookOpen, ChevronDown, Search, Trophy, Check, Loader2 } from "lucide-react";

interface CatalogBatch {
  _id: string;
  name: string;
  byName: string;
  startDate?: string;
  endDate?: string;
  language?: string;
  previewImage?: string;
  feeTotal?: number;
  type?: string;
  slug?: string;
}

const PAGE_SIZE = 24;

export function HomeView() {
  const { navigate, searchQuery, setSearchQuery } = useApp();
  const [batches, setBatches] = useState<CatalogBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"all" | "enrolled">("all");
  const [enrolledIds, setEnrolledIds] = useState<Set<string>>(new Set());
  const [savingId, setSavingId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();

    fetch("/api/batches", { signal: controller.signal })
      .then((response) => response.json())
      .then((data: { success?: boolean; batches?: CatalogBatch[]; error?: string }) => {
        if (!alive) return;
        if (data.success && Array.isArray(data.batches)) {
          setBatches(data.batches);
        } else {
          setError(data.error ?? "Unable to load courses");
        }
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setError("Unable to connect to the course catalog");
        setLoading(false);
      });

    return () => {
      alive = false;
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const user = firebaseAuth.currentUser;
    if (!user) return;
    getEnrolledBatchIds(user.uid).then((ids) => setEnrolledIds(new Set(ids))).catch(() => {});
  }, []);

  const saveEnrollment = async (batch: CatalogBatch) => {
    if (enrolledIds.has(batch._id)) return;
    setSavingId(batch._id);
    try {
      let user = firebaseAuth.currentUser;
      if (!user) {
        await signInWithGoogle();
        user = firebaseAuth.currentUser;
      }
      if (!user) return;
      await enrollInBatch({ userId: user.uid, batch: { id: batch._id, name: batch.name, image: batch.previewImage, byName: batch.byName } });
      setEnrolledIds((current) => new Set(current).add(batch._id));
    } catch {
      setError("Sign in is required to enroll in a batch.");
    } finally {
      setSavingId(null);
    }
  };

  const filtered = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (activeTab === "enrolled") return batches.filter((batch) => enrolledIds.has(batch._id));
    if (!query) return batches;
    return batches.filter((batch) =>
      `${batch.name} ${batch.byName} ${batch.language ?? ""}`.toLowerCase().includes(query)
    );
  }, [activeTab, batches, enrolledIds, searchQuery]);

  const openBatch = (batch: CatalogBatch) =>
    navigate({
      view: "batch",
      batchId: batch._id,
      batchName: batch.name,
      batchImage: batch.previewImage,
    });

  return (
    <main className="flex-1 px-4 pb-20 text-foreground sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl pt-10 sm:pt-16">
        <div className="mb-8 sb-fade-up">
          <p className="mb-2 text-sm font-bold uppercase tracking-[0.22em] text-[#4a9eff]">Quantica Digital</p>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Study Batches</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {loading ? "Loading courses..." : `${batches.length.toLocaleString()} batches available`} · Find your course and start learning
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-2xl glass-soft p-1">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition ${
              activeTab === "all" ? "btn-gold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <BookOpen size={16} /> All Batches
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("enrolled")}
            className={`flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition ${
              activeTab === "enrolled" ? "btn-gold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Trophy size={16} /> Enrolled
          </button>
        </div>

        <label className="mb-6 flex h-12 items-center gap-3 rounded-2xl glass-soft px-4 text-muted-foreground focus-within:border-[#4a9eff]/50">
          <Search size={19} />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search batches by name or category..."
            className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
            aria-label="Search batches"
          />
        </label>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="glass overflow-hidden rounded-3xl">
                <GlassSkeleton className="aspect-[1.7] rounded-none" />
                <div className="space-y-3 p-4"><GlassSkeleton className="h-4 w-4/5" /><GlassSkeleton className="h-3 w-1/2" /><GlassSkeleton className="h-10 w-full" /></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <EmptyState icon={<Search size={22} />} title="Courses are unavailable" hint={error} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<BookOpen size={22} />} title={activeTab === "enrolled" ? "No enrolled batches yet" : "No batches found"} hint={activeTab === "enrolled" ? "Enroll in a batch to see it here." : "Try a different search term."} />
        ) : (
          <BatchGrid batches={filtered} onOpen={openBatch} onEnroll={saveEnrollment} enrolledIds={enrolledIds} savingId={savingId} />
        )}
      </div>

    </main>
  );
}

function BatchGrid({ batches, onOpen, onEnroll, enrolledIds, savingId }: { batches: CatalogBatch[]; onOpen: (batch: CatalogBatch) => void; onEnroll: (batch: CatalogBatch) => void; enrolledIds: Set<string>; savingId: string | null }) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {batches.slice(0, visible).map((batch) => <BatchCard key={batch._id} batch={batch} onOpen={() => onOpen(batch)} onEnroll={() => onEnroll(batch)} enrolled={enrolledIds.has(batch._id)} saving={savingId === batch._id} />)}
      </div>
      {visible < batches.length && <div className="mt-8 flex justify-center"><GlassButton variant="glass" onClick={() => setVisible((value) => value + PAGE_SIZE)}>Load more <ChevronDown size={16} /></GlassButton></div>}
    </>
  );
}

function BatchCard({ batch, onOpen, onEnroll, enrolled, saving }: { batch: CatalogBatch; onOpen: () => void; onEnroll: () => void; enrolled: boolean; saving: boolean }) {
  return (
    <GlassCard className="overflow-hidden rounded-3xl" hover={false} sheen={false}>
      <div>
        <button type="button" onClick={onOpen} className="group block w-full text-left">
        <div className="relative aspect-[1.7] overflow-hidden bg-black/30">
          <SafeImage src={batch.previewImage} alt={batch.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
          <GlassBadge className="absolute left-3 top-3 bg-black/70 text-white" tone="neutral">{batch.language ?? "Hinglish"}</GlassBadge>
        </div>
        <div className="space-y-3 p-4">
          <h2 className="line-clamp-2 min-h-11 text-base font-bold text-white">{batch.name}</h2>
          <p className="line-clamp-1 text-sm text-muted-foreground">For {batch.byName || "serious learners"}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground"><span className="rounded-full bg-white/8 px-2 py-1">{batch.type ?? "E_BATCH"}</span><span>Starts {batch.startDate ?? "Soon"}</span></div>
        </div>
        </button>
        <div className="px-4 pb-4">
          <GlassButton type="button" variant={enrolled ? "glass" : "gold"} size="sm" className="w-full" disabled={enrolled || saving} onClick={onEnroll}>
            {saving ? <Loader2 size={15} className="animate-spin" /> : enrolled ? <Check size={15} /> : <Trophy size={15} />}
            {saving ? "Saving..." : enrolled ? "Enrolled" : "Enroll now"}
          </GlassButton>
        </div>
      </div>
    </GlassCard>
  );
}
