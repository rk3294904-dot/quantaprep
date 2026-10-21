"use client";

import { forwardRef, type ReactNode, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

/* ---------------------------------- Glass card ---------------------------------- */

export function GlassCard({
  children,
  className,
  hover = true,
  sheen = true,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  sheen?: boolean;
}) {
  return (
    <div
      className={cn(
        "glass rounded-3xl",
        sheen && "glass-sheen",
        hover && "glass-hover",
        className
      )}
    >
      {children}
    </div>
  );
}

/* --------------------------------- Glass button --------------------------------- */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "gold" | "glass" | "ghost";
  size?: "sm" | "md" | "lg" | "icon";
};

export const GlassButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "glass", size = "md", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap select-none",
          "focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
          "disabled:opacity-50 disabled:pointer-events-none cursor-pointer",
          size === "sm" && "h-9 px-4 text-sm",
          size === "md" && "h-11 px-6 text-sm",
          size === "lg" && "h-13 px-8 text-base",
          size === "icon" && "h-10 w-10",
          variant === "gold" && "btn-gold",
          variant === "glass" && "btn-glass text-foreground",
          variant === "ghost" &&
            "text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors rounded-full",
          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);
GlassButton.displayName = "GlassButton";

/* ------------------------------------ Badge ------------------------------------- */

export function GlassBadge({
  children,
  className,
  tone = "neutral",
}: {
  children: ReactNode;
  className?: string;
  tone?: "neutral" | "gold" | "green" | "red" | "violet";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
        tone === "neutral" &&
          "border-white/15 bg-white/5 text-foreground/80 backdrop-blur-md",
        tone === "gold" &&
          "border-[#4a9eff]/40 bg-[#4a9eff]/12 text-[#7cc0ff] backdrop-blur-md",
        tone === "green" &&
          "border-emerald-400/30 bg-emerald-400/10 text-emerald-300 backdrop-blur-md",
        tone === "red" && "border-red-400/30 bg-red-400/10 text-red-300 backdrop-blur-md",
        tone === "violet" &&
          "border-violet-400/30 bg-violet-400/10 text-violet-300 backdrop-blur-md",
        className
      )}
    >
      {children}
    </span>
  );
}

/* ----------------------------------- Skeleton ----------------------------------- */

export function GlassSkeleton({ className }: { className?: string }) {
  return <div className={cn("sb-skeleton rounded-2xl", className)} />;
}

/* ------------------------------- Section heading -------------------------------- */

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={cn("space-y-2", className)}>
      {eyebrow && (
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#4a9eff]/90">
          {eyebrow}
        </p>
      )}
      <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
        {title}
      </h2>
      {subtitle && <p className="text-sm text-muted-foreground max-w-2xl">{subtitle}</p>}
    </div>
  );
}

/* ------------------------------ Safe remote image ------------------------------- */

export function SafeImage({
  src,
  alt,
  className,
  fallback = "/logo.png",
}: {
  src?: string;
  alt: string;
  className?: string;
  fallback?: string;
}) {
  const url = src && src.startsWith("http") ? src : fallback;
  return (
     
    <img
      src={url}
      alt={alt}
      loading="lazy"
      className={className}
      onError={(e) => {
        const img = e.currentTarget;
        if (img.src !== fallback && !img.src.endsWith(fallback)) img.src = fallback;
      }}
    />
  );
}

/* ---------------------------------- Empty state --------------------------------- */

export function EmptyState({
  icon,
  title,
  hint,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
}) {
  return (
    <div className="glass-soft rounded-3xl px-8 py-14 text-center">
      {icon && (
        <div className="mx-auto mb-4 w-14 h-14 rounded-2xl glass flex items-center justify-center text-[#4a9eff]">
          {icon}
        </div>
      )}
      <p className="font-bold text-foreground">{title}</p>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}
