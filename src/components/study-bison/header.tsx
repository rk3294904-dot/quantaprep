"use client";

import { useEffect, useRef, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { useApp } from "@/lib/store";
import { Search, Menu, X, Trophy, LogIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { firebaseAuth, signInWithGoogle } from "@/lib/firebase";

export function SiteHeader() {
  const { navigate, searchQuery, setSearchQuery, view } = useApp();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => onAuthStateChanged(firebaseAuth, setUser), []);

  const openProfile = () => {
    setMobileOpen(false);
    navigate({ view: "profile" });
  };

  const goHome = () => {
    setMobileOpen(false);
    navigate({ view: "home" });
  };

  const openLeaderboard = () => {
    setMobileOpen(false);
    navigate({ view: "leaderboard" });
  };

  return (
    <header className="sb-nav-static top-0 px-3 pt-3 sm:px-5">
      <div className="sb-nav-surface relative mx-auto w-full max-w-7xl rounded-3xl shadow-[0_10px_30px_rgba(0,0,0,0.45)]">
        <div className="flex min-h-16 items-center gap-3 px-3 sm:px-5">
          <button onClick={goHome} className="group flex min-w-0 shrink-0 cursor-pointer items-center gap-2.5" aria-label="Quantica Digital home">
            <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-white/15 bg-black shadow-[0_0_24px_rgba(74,158,255,0.25)] transition-shadow group-hover:shadow-[0_0_32px_rgba(74,158,255,0.45)] sm:h-11 sm:w-11">
              <img src="/logo.png" alt="Quantica Digital logo" className="h-full w-full object-cover" />
            </span>
            <span className="hidden min-w-0 flex-col text-left leading-none sm:flex">
              <span className="truncate text-sm font-extrabold tracking-[0.08em] text-gold sm:text-base">QUANTICA DIGITAL</span>
              <span className="mt-1 text-[9px] font-semibold tracking-[0.2em] text-muted-foreground">DIGITAL LEARNING</span>
            </span>
          </button>

          <div className="hidden h-7 w-px bg-white/10 lg:block" />
          <button type="button" onClick={openLeaderboard} aria-label="Open leaderboard" title="Leaderboard" aria-current={view === "leaderboard" ? "page" : undefined} className={cn("sb-leaderboard-button flex h-11 shrink-0 items-center justify-center gap-2 rounded-full px-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-200", view === "leaderboard" && "sb-leaderboard-active")}>
            <Trophy size={20} strokeWidth={2.2} aria-hidden="true" />
            <span className="hidden text-xs font-bold lg:inline">Leaderboard</span>
          </button>

          <div className="min-w-0 flex-1" />
          <label className="hidden h-10 w-[min(260px,32vw)] min-w-0 items-center rounded-full border border-white/10 bg-white/5 px-3 backdrop-blur-md md:flex">
            <Search size={15} className="shrink-0 text-muted-foreground" />
            <input ref={searchRef} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search your batch..." className="h-full min-w-0 w-full bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground/70" aria-label="Search batches" />
          </label>

          {user ? (
            <button type="button" onClick={openProfile} aria-label="Open profile" title={user.displayName ?? "Your profile"} className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 text-sm font-bold text-foreground ring-1 ring-white/10 transition-colors hover:bg-white/15">
              {user.photoURL ? <img src={user.photoURL} alt="" className="h-full w-full object-cover" /> : (user.displayName?.[0] ?? "U").toUpperCase()}
            </button>
          ) : (
            <button type="button" onClick={() => void signInWithGoogle()} aria-label="Sign in with Google" title="Sign in with Google" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/15 text-muted-foreground transition-colors hover:border-white/30 hover:text-foreground">
              <LogIn size={16} />
            </button>
          )}

          <button className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-full glass lg:hidden" onClick={() => setMobileOpen((value) => !value)} aria-label={mobileOpen ? "Close menu" : "Open menu"}>
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {mobileOpen && (
          <div className="grid gap-3 border-t border-white/8 px-4 py-3 sb-fade-up lg:hidden">
            <button type="button" onClick={openLeaderboard} aria-current={view === "leaderboard" ? "page" : undefined} className="sb-leaderboard-button flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold">
              <Trophy size={17} /> Leaderboard
            </button>
            <label className="flex h-11 items-center rounded-full border border-white/10 bg-white/5 px-4 md:hidden">
              <Search size={15} className="text-muted-foreground" />
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search your batch..." className="h-full w-full bg-transparent px-2.5 text-sm outline-none placeholder:text-muted-foreground/70" aria-label="Search batches" />
            </label>
          </div>
        )}
      </div>
    </header>
  );
}
