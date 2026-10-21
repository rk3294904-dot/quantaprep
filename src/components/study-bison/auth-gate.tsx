"use client";

import { useEffect, useState, type ReactNode } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { LogIn, Loader2, ShieldCheck } from "lucide-react";
import { finishGoogleRedirect, firebaseAuth, signInWithGoogle } from "@/lib/firebase";
import { GlassButton } from "./glass";

export function AuthGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(firebaseAuth, (nextUser) => {
      if (!active) return;
      setUser(nextUser);
      if (nextUser) setChecking(false);
    });

    const completeRedirect = async () => {
      try {
        const result = await finishGoogleRedirect();
        if (active && result?.user) setUser(result.user);
      } catch (reason: unknown) {
        if (active) setError(getSignInMessage(reason));
      } finally {
        if (active) setChecking(false);
      }
    };

    void completeRedirect();
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const login = async () => {
    setSigningIn(true);
    setError(null);
    try {
      await signInWithGoogle();
    } catch (reason: unknown) {
      setError(getSignInMessage(reason));
    } finally {
      setSigningIn(false);
    }
  };

  if (checking) {
    return (
      <main className="fixed inset-0 flex items-center justify-center bg-[#07070b]">
        <Loader2 className="animate-spin text-[#4a9eff]" size={30} />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="fixed inset-0 flex items-center justify-center overflow-y-auto bg-[#07070b] p-5">
        <section className="glass w-full max-w-md rounded-[2rem] p-8 text-center sm:p-10 sb-fade-up">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-[#4a9eff]/30 bg-[#4a9eff]/10 text-[#4a9eff] shadow-[0_0_35px_rgba(74,158,255,0.18)]">
            <ShieldCheck size={30} />
          </div>
          <p className="mt-6 text-xs font-bold uppercase tracking-[0.24em] text-[#4a9eff]">Quantica Digital</p>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight">Your learning space</h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">Sign in with Google to save your enrollments, continue lectures, and compete on the leaderboard.</p>
          <GlassButton variant="gold" size="lg" className="mt-8 w-full" onClick={login} disabled={signingIn}>
            {signingIn ? <Loader2 className="animate-spin" size={18} /> : <LogIn size={18} />}
            {signingIn ? "Connecting to Google..." : "Continue with Google"}
          </GlassButton>
          <p className="mt-4 text-xs leading-5 text-muted-foreground/75">Your Google account is used to securely protect your learning progress.</p>
          {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
        </section>
      </main>
    );
  }

  return <>{children}</>;
}

function getSignInMessage(reason: unknown): string {
  const code = (reason as { code?: string }).code;
  if (code === "auth/popup-closed-by-user") return "The Google sign-in window was closed before sign-in finished. Please try again.";
  if (code === "auth/account-exists-with-different-credential") return "This Google account is already connected with another sign-in method.";
  if (code === "auth/unauthorized-domain") return "This app address is not enabled for Google sign-in yet. Add the current website address to Firebase Authorized domains.";
  if (code === "auth/operation-not-allowed") return "Google sign-in is not enabled in the Firebase Authentication settings yet.";
  if (code === "auth/network-request-failed") return "Google sign-in needs an active internet connection. Please try again.";
  return "Google sign-in could not be completed. Please try again.";
}
