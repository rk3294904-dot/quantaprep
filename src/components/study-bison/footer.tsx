"use client";

import { useApp } from "@/lib/store";
import { Send, Heart } from "lucide-react";

export function SiteFooter() {
  const { navigate } = useApp();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-auto w-full px-3 sm:px-5 pb-3 pt-10">
      <div className="mx-auto max-w-7xl glass rounded-3xl px-6 sm:px-10 py-8">
        <div className="flex flex-col md:flex-row md:items-center gap-8 md:gap-6">
          {/* Brand */}
          <div className="flex items-center gap-3 md:w-1/3">
            <span className="w-12 h-12 rounded-2xl overflow-hidden border border-white/15 bg-black shrink-0 shadow-[0_0_20px_rgba(245,181,46,0.2)]">
              { }
              <img src="/logo.png" alt="Study Bison logo" className="w-full h-full object-cover" />
            </span>
            <div className="leading-tight">
              <p className="text-base font-extrabold text-gold">STUDY BISON</p>
              <p className="text-[11px] font-semibold tracking-[0.24em] text-muted-foreground">
                NEXT GEN LEARNING
              </p>
            </div>
          </div>

          {/* Links */}
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm md:w-1/3" aria-label="Footer">
            <FooterLink onClick={() => navigate({ view: "home" })}>Home</FooterLink>
            <FooterLink onClick={() => navigate({ view: "home", tab: "batches" })}>Batches</FooterLink>
            <FooterLink onClick={() => navigate({ view: "dashboard" })}>Dashboard</FooterLink>
            <FooterLink onClick={() => navigate({ view: "about" })}>About</FooterLink>
          </nav>

          {/* Telegram + copyright */}
          <div className="flex flex-col items-start md:items-end gap-3 md:ml-auto">
            <a
              href="https://t.me/studyvaultpro"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-full btn-glass px-5 h-10 text-sm font-semibold text-foreground"
            >
              <Send size={14} className="text-[#4a9eff]" />
              Join Telegram Community
            </a>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              © {year} Study Bison · Crafted with
              <Heart size={12} className="text-[#4a9eff] fill-[#4a9eff]" />
              for learners everywhere
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="text-muted-foreground hover:text-[#7cc0ff] transition-colors cursor-pointer"
    >
      {children}
    </button>
  );
}
