"use client";

import { useApp } from "@/lib/store";
import { GlassBadge, GlassButton, GlassCard, SectionHeading } from "./glass";
import {
  Target,
  Zap,
  ShieldCheck,
  Send,
  GraduationCap,
  Play,
  BookOpen,
  Layers,
} from "lucide-react";

export function AboutView() {
  const { navigate } = useApp();

  return (
    <main className="flex-1 w-full px-3 sm:px-5">
      <div className="mx-auto max-w-7xl space-y-10 pb-6 pt-10">
        {/* hero */}
        <GlassCard hover={false} className="p-8 sm:p-14 sb-fade-up">
          <div className="flex flex-col lg:flex-row items-center gap-10">
            <div className="w-44 h-44 sm:w-56 sm:h-56 rounded-[2.5rem] overflow-hidden border border-white/15 bg-black shadow-[0_0_80px_rgba(74,158,255,0.3)] shrink-0">
              { }
              <img src="/logo.png" alt="Study Bison" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 text-center lg:text-left">
              <GlassBadge tone="gold" className="mb-4">
                <GraduationCap size={11} /> ABOUT THE PLATFORM
              </GlassBadge>
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-tight">
                The herd that studies <span className="text-gold">together, wins together</span>
              </h1>
              <p className="mt-4 text-base text-muted-foreground leading-relaxed max-w-2xl">
                Study Bison brings premium coaching-style learning to everyone — batch catalogs,
                structured subjects and chapters, thousands of lectures with a player built for
                focused revision, plus every class note and DPP one tap away. Strong, steady,
                unstoppable: that&apos;s the bison way.
              </p>
              <div className="mt-6 flex flex-wrap justify-center lg:justify-start gap-3">
                <GlassButton variant="gold" size="lg" onClick={() => navigate({ view: "home", tab: "batches" })}>
                  <Layers size={16} /> Explore Batches
                </GlassButton>
                <GlassButton
                  variant="glass"
                  size="lg"
                  onClick={() => window.open("https://t.me/studyvaultpro", "_blank")}
                >
                  <Send size={16} /> Telegram Community
                </GlassButton>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* values */}
        <section>
          <SectionHeading eyebrow="WHAT WE STAND FOR" title="Why learners pick Study Bison" />
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-5">
            <ValueCard
              icon={<Target size={20} />}
              title="Structured learning"
              text="Every batch is organized subject → chapter → lecture, so you always know the next right step."
            />
            <ValueCard
              icon={<Zap size={20} />}
              title="Built for speed"
              text="Aggressive caching and a lightweight liquid-glass interface keep everything instant, even on flaky networks."
            />
            <ValueCard
              icon={<ShieldCheck size={20} />}
              title="Fair & transparent"
              text="We surface publicly available educational content with clear attribution to its original educators."
            />
          </div>
        </section>

        {/* how it works */}
        <section>
          <SectionHeading eyebrow="THE FLOW" title="From catalog to concept in four steps" />
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <StepCard n={1} icon={<Layers size={18} />} title="Pick a batch" text="Filter 13,000+ batches by exam and language." />
            <StepCard n={2} icon={<BookOpen size={18} />} title="Choose a chapter" text="Jump into the subject and chapter you need." />
            <StepCard n={3} icon={<Play size={18} />} title="Watch & revise" text="Use the premium player with speed control and resume." />
            <StepCard n={4} icon={<BookOpen size={18} />} title="Grab the notes" text="Download class notes and DPP PDFs right below the video." />
          </div>
        </section>
      </div>
    </main>
  );
}

function ValueCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <GlassCard className="p-7">
      <div className="w-12 h-12 rounded-2xl btn-glass flex items-center justify-center text-[#4a9eff]">{icon}</div>
      <h3 className="mt-4 font-bold">{title}</h3>
      <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{text}</p>
    </GlassCard>
  );
}

function StepCard({ n, icon, title, text }: { n: number; icon: React.ReactNode; title: string; text: string }) {
  return (
    <GlassCard className="p-6 relative overflow-hidden">
      <span className="absolute -top-3 -right-1 text-[88px] font-extrabold text-white/4 leading-none select-none">
        {n}
      </span>
      <div className="w-11 h-11 rounded-2xl btn-glass flex items-center justify-center text-[#4a9eff]">{icon}</div>
      <h3 className="mt-3.5 font-bold text-[15px]">{title}</h3>
      <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed">{text}</p>
    </GlassCard>
  );
}
