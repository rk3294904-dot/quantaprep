"use client";

import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { Send, X } from "lucide-react";
import { firebaseAuth } from "@/lib/firebase";
import { GlassButton } from "./glass";

const TELEGRAM_URL = "https://t.me/quanticaofficial";
const CLOSE_DELAY_SECONDS = 60;
const joinedKey = (uid: string) => `quantica:telegram-joined:${uid}`;
const dismissedKey = (uid: string) => `quantica:telegram-dismissed:${uid}`;

// Asks every signed-in learner to join the Telegram channel. It can only be
// dismissed after a one-minute countdown, and returns each new browser session
// until the learner taps "Join".
export function TelegramPopup() {
  const [user, setUser] = useState<User | null>(firebaseAuth.currentUser);

  useEffect(() => onAuthStateChanged(firebaseAuth, setUser), []);

  if (!user) return null;
  if (localStorage.getItem(joinedKey(user.uid)) || sessionStorage.getItem(dismissedKey(user.uid))) return null;
  // Keyed by learner so switching accounts restarts the countdown.
  return <TelegramDialog key={user.uid} uid={user.uid} />;
}

function TelegramDialog({ uid }: { uid: string }) {
  const [open, setOpen] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState(CLOSE_DELAY_SECONDS);

  useEffect(() => {
    if (!open || secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [open, secondsLeft]);

  if (!open) return null;

  const join = () => {
    localStorage.setItem(joinedKey(uid), "1");
    window.open(TELEGRAM_URL, "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  const close = () => {
    if (secondsLeft > 0) return;
    sessionStorage.setItem(dismissedKey(uid), "1");
    setOpen(false);
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="telegram-title" className="fixed inset-0 z-[100] flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <section className="glass relative w-full max-w-sm rounded-[2rem] p-7 text-center sb-fade-up">
        <button
          type="button"
          onClick={close}
          disabled={secondsLeft > 0}
          aria-label={secondsLeft > 0 ? `Close available in ${secondsLeft} seconds` : "Close"}
          className="absolute right-4 top-4 flex h-9 min-w-9 items-center justify-center rounded-full border border-white/10 px-2 text-xs font-bold tabular-nums text-muted-foreground transition-colors enabled:hover:bg-white/10 enabled:hover:text-foreground disabled:cursor-not-allowed"
        >
          {secondsLeft > 0 ? `${secondsLeft}s` : <X size={16} />}
        </button>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#229ED9] text-white shadow-[0_0_35px_rgba(34,158,217,0.35)]">
          <Send size={28} />
        </div>
        <h2 id="telegram-title" className="mt-5 text-2xl font-extrabold tracking-tight">Join our Telegram</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Joining the official Quantica channel is required to get batch updates, new lectures and announcements first.
        </p>
        <GlassButton variant="gold" size="lg" className="mt-6 w-full" onClick={join}>
          <Send size={18} /> Join @quanticaofficial
        </GlassButton>
        <p className="mt-3 text-[11px] text-muted-foreground/80">
          {secondsLeft > 0 ? `You can close this in ${secondsLeft} seconds.` : "You can close this now."}
        </p>
      </section>
    </div>
  );
}
