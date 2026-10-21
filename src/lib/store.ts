"use client";

import { create } from "zustand";

/**
 * Study Bison — client-side view router.
 * The whole app is a single-page experience; every "page" of the study
 * flow is a view driven by this store, mirrored to the URL hash so that
 * back/forward and deep links work (#/batch/<id>/subject/<slug>...).
 */

export type ViewName =
  | "home"
  | "batch"
  | "subject"
  | "topic"
  | "watch"
  | "dashboard"
  | "about"
  | "leaderboard"
  | "profile"
  | "pdf";

export interface RouteState {
  view: ViewName;
  batchId?: string;
  batchName?: string;
  batchImage?: string;
  subjectSlug?: string;
  subjectName?: string;
  topicId?: string;
  topicName?: string;
  contentId?: string;
  lectureTitle?: string;
  videoId?: string;
  videoType?: string;
  tab?: string;
}

interface AppState extends RouteState {
  navigate: (state: RouteState) => void;
  back: () => void;
  hydrateFromHash: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
}

function serialize(state: RouteState): string {
  const parts: string[] = [`#${state.view}`];
  if (state.batchId) parts.push(encodeURIComponent(state.batchId));
  if (state.view === "subject" || state.view === "topic" || state.view === "watch" || state.view === "pdf") {
    if (state.subjectSlug) parts.push(encodeURIComponent(state.subjectSlug));
  }
  if (state.view === "topic" || state.view === "watch") {
    if (state.topicId) parts.push(encodeURIComponent(state.topicId));
  }
  if (state.view === "watch" && state.contentId) {
    parts.push(encodeURIComponent(state.contentId));
  }
  if (state.view === "pdf" && state.contentId) {
    parts.push(encodeURIComponent(state.contentId));
  }
  return parts.join("/");
}

function parseHash(hash: string): RouteState {
  const clean = hash.replace(/^#\/?/, "");
  const parts = clean.split("/").map((p) => decodeURIComponent(p));
  const [view, a, b, c, d] = parts;
  switch (view) {
    case "batch":
      return { view: "batch", batchId: a };
    case "subject":
      return { view: "subject", batchId: a, subjectSlug: b };
    case "topic":
      return { view: "topic", batchId: a, subjectSlug: b, topicId: c };
    case "watch":
      return { view: "watch", batchId: a, subjectSlug: b, topicId: c, contentId: d };
    case "dashboard":
      return { view: "dashboard" };
    case "about":
      return { view: "about" };
    case "leaderboard":
      return { view: "leaderboard" };
    case "profile":
      return { view: "profile" };
    case "pdf":
      return { view: "pdf", batchId: a, contentId: b };
    default:
      return { view: "home" };
  }
}

export const useApp = create<AppState>((set, get) => ({
  view: "home",
  navigate: (state) => {
    const hash = state.view === "home" ? "" : serialize(state);
    if (typeof window !== "undefined" && window.location.hash !== hash) {
      const url = hash || `${window.location.pathname}${window.location.search}`;
      window.history.pushState(null, "", url);
    }
    set(state);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  },
  back: () => {
    if (typeof window !== "undefined") window.history.back();
  },
  hydrateFromHash: () => {
    if (typeof window === "undefined") return;
    const state = parseHash(window.location.hash);
    set(state);
  },
  searchQuery: "",
  setSearchQuery: (q) => set({ searchQuery: q }),
}));

/** Initialize hash <-> store sync (call once from the root component). */
export function bindRouter() {
  if (typeof window === "undefined") return () => {};
  const onPop = () => {
    useApp.getState().hydrateFromHash();
  };
  window.addEventListener("popstate", onPop);
  if (window.location.hash) {
    useApp.getState().hydrateFromHash();
  }
  return () => window.removeEventListener("popstate", onPop);
}
