"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { ArrowUpRight, ImagePlus, Loader2, Megaphone, Plus, Trash2, X } from "lucide-react";
import { firebaseAuth } from "@/lib/firebase";
import { GlassButton } from "./glass";
import { cn } from "@/lib/utils";

interface Ad {
  id: number;
  title: string;
  description: string;
  linkUrl: string;
  imageUrl: string;
}

async function authHeaders(user: User | null): Promise<HeadersInit> {
  return user ? { Authorization: `Bearer ${await user.getIdToken()}` } : {};
}

// Ad placement shown just below the navbar. The admin account also gets
// controls here to publish and remove ads.
export function AdsSection() {
  const [user, setUser] = useState<User | null>(firebaseAuth.currentUser);
  const [ads, setAds] = useState<Ad[]>([]);
  const [admin, setAdmin] = useState(false);
  const [active, setActive] = useState(0);
  const [managing, setManaging] = useState(false);

  useEffect(() => onAuthStateChanged(firebaseAuth, setUser), []);

  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => {
    let alive = true;
    authHeaders(user)
      .then((headers) => fetch("/api/ads", { cache: "no-store", headers }))
      .then((response) => response.json() as Promise<{ ads?: Ad[]; admin?: boolean }>)
      .then((data) => { if (alive) { setAds(data.ads ?? []); setAdmin(!!data.admin); } })
      .catch(() => { if (alive) setAds([]); });
    return () => { alive = false; };
  }, [user, version]);

  // Rotate between ads when more than one is published.
  useEffect(() => {
    if (ads.length < 2) return;
    const timer = setInterval(() => setActive((index) => (index + 1) % ads.length), 6000);
    return () => clearInterval(timer);
  }, [ads.length]);

  if (ads.length === 0 && !admin) return null;
  const current = ads[active % Math.max(ads.length, 1)];

  return (
    <section aria-label="Sponsored" className="px-3 pt-3 sm:px-5">
      <div className="mx-auto w-full max-w-7xl">
        {current ? (
          <div className="relative">
            <AdBanner ad={current} />
            {ads.length > 1 && (
              <div className="absolute bottom-2.5 left-1/2 flex -translate-x-1/2 gap-1.5">
                {ads.map((ad, index) => (
                  <button key={ad.id} type="button" aria-label={`Show ad ${index + 1}`} onClick={() => setActive(index)} className={cn("h-1.5 rounded-full transition-all", index === active % ads.length ? "w-5 bg-white" : "w-1.5 bg-white/40")} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex min-h-20 items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] text-xs text-muted-foreground">
            <Megaphone size={15} /> Ad space — no ads published yet
          </div>
        )}

        {admin && (
          <div className="mt-2 flex justify-end">
            <GlassButton variant="ghost" size="sm" onClick={() => setManaging(true)}><Plus size={14} /> Manage ads</GlassButton>
          </div>
        )}
      </div>

      {admin && managing && <AdManager user={user} ads={ads} onClose={() => setManaging(false)} onChange={reload} />}
    </section>
  );
}

function AdBanner({ ad }: { ad: Ad }) {
  const content = (
    <div className="flex min-h-20 items-center gap-4 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-r from-[#10203a] to-[#0c172b] p-3 pr-4 transition-colors hover:border-white/20 sm:p-4">
      {ad.imageUrl && <img src={ad.imageUrl} alt="" className="h-16 w-24 shrink-0 rounded-xl object-cover sm:h-20 sm:w-36" />}
      <div className="min-w-0 flex-1">
        <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#e7bd6d]">Sponsored</span>
        <p className="mt-0.5 truncate text-sm font-extrabold sm:text-base">{ad.title}</p>
        {ad.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{ad.description}</p>}
      </div>
      {ad.linkUrl && <ArrowUpRight size={18} className="shrink-0 text-muted-foreground" aria-hidden="true" />}
    </div>
  );
  return ad.linkUrl
    ? <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer sponsored" className="block">{content}</a>
    : content;
}

function AdManager({ user, ads, onClose, onChange }: { user: User | null; ads: Ad[]; onClose: () => void; onChange: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState<number | null>(null);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/ads", { method: "POST", body: new FormData(form), headers: await authHeaders(user) });
      const data = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Unable to save the ad.");
      form.reset();
      onChange();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save the ad.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    setRemoving(id);
    setError(null);
    try {
      const response = await fetch(`/api/ads?id=${id}`, { method: "DELETE", headers: await authHeaders(user) });
      if (!response.ok) throw new Error();
      onChange();
    } catch {
      setError("Unable to remove the ad.");
    } finally {
      setRemoving(null);
    }
  };

  const field = "mt-1.5 w-full rounded-xl border border-white/10 bg-[#060d19] px-3 py-2.5 text-sm outline-none focus:border-[#4a9eff]/60";

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="ad-manager-title" className="fixed inset-0 z-[90] flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm">
      <div className="glass w-full max-w-lg rounded-3xl p-6">
        <div className="flex items-center justify-between">
          <h2 id="ad-manager-title" className="flex items-center gap-2 text-lg font-extrabold"><Megaphone size={18} className="text-[#e7bd6d]" /> Manage ads</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/10"><X size={16} /></button>
        </div>

        <form onSubmit={submit} className="mt-5 space-y-3">
          <label className="block text-xs font-semibold">Title<input name="title" required maxLength={120} className={field} placeholder="e.g. JEE crash course — 50% off" /></label>
          <label className="block text-xs font-semibold">Description<textarea name="description" maxLength={300} rows={2} className={field} placeholder="Optional short text" /></label>
          <label className="block text-xs font-semibold">Link<input name="linkUrl" type="url" className={field} placeholder="https://example.com" /></label>
          <label className="block text-xs font-semibold">
            <span className="flex items-center gap-1.5"><ImagePlus size={14} /> Image (PNG, JPG, WEBP or GIF, up to 4 MB)</span>
            <input name="image" type="file" accept="image/png,image/jpeg,image/webp,image/gif" className={cn(field, "file:mr-3 file:rounded-full file:border-0 file:bg-white/10 file:px-3 file:py-1 file:text-xs file:text-foreground")} />
          </label>
          {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
          <GlassButton type="submit" variant="gold" className="w-full" disabled={saving}>
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />} {saving ? "Publishing..." : "Publish ad"}
          </GlassButton>
        </form>

        <div className="mt-6">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Published ({ads.length})</p>
          <ul className="mt-3 max-h-60 space-y-2 overflow-y-auto">
            {ads.length === 0 && <li className="text-sm text-muted-foreground">No ads yet.</li>}
            {ads.map((ad) => (
              <li key={ad.id} className="flex items-center gap-3 rounded-xl border border-white/10 p-2">
                {ad.imageUrl ? <img src={ad.imageUrl} alt="" className="h-10 w-14 shrink-0 rounded-lg object-cover" /> : <span className="flex h-10 w-14 shrink-0 items-center justify-center rounded-lg bg-white/5"><Megaphone size={14} /></span>}
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{ad.title}</span>
                <button type="button" aria-label={`Remove ${ad.title}`} onClick={() => void remove(ad.id)} disabled={removing === ad.id} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-red-300 hover:bg-red-500/10 disabled:opacity-50">
                  {removing === ad.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
