"use client";

import { useEffect } from "react";
import { useApp, bindRouter } from "@/lib/store";
import { SiteHeader } from "@/components/study-bison/header";
import { HomeView } from "@/components/study-bison/home-view";
import { BatchDetail } from "@/components/study-bison/batch-detail";
import { SubjectView } from "@/components/study-bison/subject-view";
import { TopicView } from "@/components/study-bison/topic-view";
import { WatchView } from "@/components/study-bison/player-view";
import { LeaderboardView } from "@/components/study-bison/leaderboard-view";
import { ProfileView } from "@/components/study-bison/profile-view";
import { PdfViewerView } from "@/components/study-bison/pdf-viewer";
import { AuthGate } from "@/components/study-bison/auth-gate";
import { AdsSection } from "@/components/study-bison/ads-section";
import { TelegramPopup } from "@/components/study-bison/telegram-popup";

export default function Page() {
  const { view, batchId, subjectSlug, topicId, contentId } = useApp();

  // Bind hash <-> store once (also restores deep links on load)
  useEffect(() => bindRouter(), []);

  // Keep document.title in sync with the current view
  useEffect(() => {
    const base = "Quantica Digital — Learning Platform"
    const s = useApp.getState();
    const titles: Record<string, string> = {
      home: base,
      batch: `${s.batchName ?? "Batch"} · Quantica Digital`,
      subject: `${s.subjectName ?? "Subject"} · Quantica Digital`,
      topic: `${s.topicName ?? "Chapter"} · Quantica Digital`,
      watch: `${s.lectureTitle ?? "Lecture"} · Quantica Digital`,
      leaderboard: `Leaderboard · Quantica Digital`,
      profile: `Profile · Quantica Digital`,
      pdf: `${s.lectureTitle ?? "PDF"} · Quantica Digital`,
    };
    document.title = titles[view] ?? base;
  }, [view]);

  return (
    <AuthGate>
      <div className="flex flex-col min-h-screen">
        <TelegramPopup />
        {view !== "watch" && view !== "pdf" && (
          <>
            <SiteHeader />
            <AdsSection />
          </>
        )}
      {view === "leaderboard" ? (
        <LeaderboardView />
      ) : view === "profile" ? (
        <ProfileView />
      ) : view === "pdf" ? (
        <PdfViewerView />
      ) : view === "batch" && batchId ? (
        <BatchDetail key={batchId} batchId={batchId} />
      ) : view === "subject" && batchId && subjectSlug ? (
        <SubjectView
          key={`${batchId}:${subjectSlug}`}
          batchId={batchId}
          subjectSlug={subjectSlug}
        />
      ) : view === "topic" && batchId && subjectSlug && topicId ? (
        <TopicView
          key={`${batchId}:${subjectSlug}:${topicId}`}
          batchId={batchId}
          subjectSlug={subjectSlug}
          topicId={topicId}
        />
      ) : view === "watch" && batchId && subjectSlug && contentId ? (
        <WatchView
          key={`${batchId}:${subjectSlug}:${contentId}`}
          batchId={batchId}
          subjectSlug={subjectSlug}
          topicId={topicId}
          contentId={contentId}
          playerOnly
        />
      ) : (
        <HomeView />
        )}
      </div>
    </AuthGate>
  );
}
