"use client";

import { useEffect, useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { EmptyState, GlassButton, GlassSkeleton, SafeImage } from "./glass";
import {
  Bell,
  BookOpen,
  CalendarDays,
  GraduationCap,
  Plus,
  Search,
} from "lucide-react";

interface CatalogBatch {
  _id: string;
  name: string;
  byName: string;
  startDate?: string;
  language?: string;
  previewImage?: string;
  feeTotal?: number;
}

type DashboardTab = "all" | "enrolled";

export function DashboardView() {
  const { navigate } = useApp();
  const [batches, setBatches] = useState<CatalogBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<DashboardTab>("all");

  useEffect(() => {
    let alive = true;

    fetch("/api/batches")
      .then((response) => response.json())
      .then((data: { success?: boolean; batches?: CatalogBatch[]; error?: string }) => {
        if (!alive) return;
        if (data.success && Array.isArray(data.batches)) {
          setBatches(data.batches);
        } else {
          setError(data.error ?? "Unable to load batches");
        }
        setLoading(false);
      })
      .catch(() => {
        if (!alive) return;
        setError("Network error while loading batches");
        setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, []);

  const filteredBatches = useMemo(() => {
    if (tab === "enrolled") return [];
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return batches;

    return batches.filter((batch) =>
      `${batch.name} ${batch.byName} ${batch.language ?? ""}`.toLowerCase().includes(normalizedQuery)
    );
  }, [batches, query, tab]);

  const openBatch = (batch: CatalogBatch) => {
    navigate({
      view: "batch",
      batchId: batch._id,
      batchName: batch.name,
      batchImage: batch.previewImage,
    });
  };

  return (
    <main className="flex-1 w-full px-3 sm:px-5">
      <div className="mx-auto max-w-7xl pb-14 pt-12 sm:pt-16">
        <section className="sb-fade-up">
          <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#7ca9e8]">Learning library</p>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">Study Batches</h1>
              <p className="mt-2 text-sm text-[#8ea6c8]">
                {loading ? "Loading available batches..." : `${batches.length.toLocaleString()} batches available — find your course and start learning`}
              </p>
            </div>
            <GlassButton variant="glass" size="sm" onClick={() => navigate({ view: "home", tab: "batches" })}>
              <GraduationCap size={15} /> Explore catalog
            </GlassButton>
          </div>
        </section>

        <div className="mt-8 overflow-hidden rounded-2xl border border-[#263652] bg-[#121c30] p-1 sb-fade-up">
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setTab("all")}
              className={`flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all ${
                tab === "all" ? "bg-[#3d83ed] text-white shadow-[0_8px_22px_rgba(61,131,237,0.25)]" : "text-[#8ea6c8] hover:bg-white/5 hover:text-white"
              }`}
            >
              <BookOpen size={16} /> All Batches
            </button>
            <button
              type="button"
              onClick={() => setTab("enrolled")}
              className={`flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all ${
                tab === "enrolled" ? "bg-[#3d83ed] text-white shadow-[0_8px_22px_rgba(61,131,237,0.25)]" : "text-[#8ea6c8] hover:bg-white/5 hover:text-white"
              }`}
            >
              <GraduationCap size={16} /> Enrolled
            </button>
          </div>
        </div>

        <label className="mt-6 flex h-12 items-center gap-3 rounded-2xl border border-[#263652] bg-[#121c30] px-4 text-[#7892b8] transition-colors focus-within:border-[#3d83ed] focus-within:ring-2 focus-within:ring-[#3d83ed]/15">
          <Search size={18} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search batches by name or category..."
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-[#6f87a9]"
            aria-label="Search batches by name or category"
          />
        </label>

        <div className="mt-6">
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 8 }).map((_, index) => <GlassSkeleton key={index} className="h-[390px] rounded-2xl" />)}
            </div>
          ) : error ? (
            <EmptyState icon={<Search size={22} />} title="Could not load batches" hint={error} />
          ) : tab === "enrolled" ? (
            <EmptyState icon={<GraduationCap size={22} />} title="No enrolled batches yet" hint="Choose a batch from All Batches to start learning." />
          ) : filteredBatches.length === 0 ? (
            <EmptyState icon={<Search size={22} />} title="No batches found" hint="Try a different search term." />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {filteredBatches.map((batch, index) => (
                <BatchCard key={batch._id} batch={batch} index={index} onOpen={() => openBatch(batch)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function BatchCard({ batch, index, onOpen }: { batch: CatalogBatch; index: number; onOpen: () => void }) {
  return (
    <article
      className="group overflow-hidden rounded-2xl border border-[#263652] bg-[#121c30] transition-all duration-300 hover:-translate-y-1 hover:border-[#3d83ed]/70 hover:shadow-[0_18px_38px_rgba(0,0,0,0.28)] sb-fade-up"
      style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }}
    >
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="relative aspect-[16/9] overflow-hidden bg-[#1d2b45]">
          <SafeImage src={batch.previewImage} alt={batch.name} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0c1527]/85 via-transparent to-transparent" />
          <span className="absolute left-3 top-3 rounded-full bg-[#26354c] px-2.5 py-1 text-[11px] font-bold text-white shadow-lg">
            {batch.language ?? "Hinglish"}
          </span>
        </div>
        <div className="p-4 pb-3">
          <h2 className="line-clamp-1 text-[15px] font-extrabold text-white">{batch.name}</h2>
          <p className="mt-1 line-clamp-1 text-xs text-[#8ea6c8]">For {batch.byName || "serious learners"}</p>
          <div className="mt-4 flex items-center gap-2 text-[11px] text-[#7892b8]">
            <span className="rounded-md bg-[#1c2a41] px-2 py-1 font-semibold">E_BATCH</span>
            {batch.startDate && <span>Starts {batch.startDate}</span>}
          </div>
        </div>
      </button>
      <div className="grid grid-cols-2 gap-2 px-4 pb-3">
        <button type="button" onClick={onOpen} className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#22577d] bg-[#132e49] text-[11px] font-bold text-[#65c7f2] transition-colors hover:bg-[#173b5d]">
          <Bell size={13} /> Announcements
        </button>
        <button type="button" onClick={onOpen} className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-[#22577d] bg-[#132e49] text-[11px] font-bold text-[#65c7f2] transition-colors hover:bg-[#173b5d]">
          <CalendarDays size={13} /> Schedule
        </button>
      </div>
      <div className="px-4 pb-4">
        <button type="button" onClick={onOpen} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-[#0da6df] to-[#3d83ed] text-sm font-extrabold text-white shadow-[0_8px_20px_rgba(22,142,232,0.2)] transition-all hover:brightness-110">
          <Plus size={16} /> Enroll
        </button>
      </div>
    </article>
  );
}
