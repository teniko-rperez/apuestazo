"use client";

import { cn } from "@/lib/utils";

export function ConfidenceMeter({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    score >= 0.8
      ? "text-green-400"
      : score >= 0.6
        ? "text-blue-400"
        : "text-muted-foreground";
  const label =
    score >= 0.8 ? "Alta" : score >= 0.6 ? "Media" : "Baja";

  return (
    <div className="flex items-center gap-1.5">
      <div className="w-12 sm:w-16 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            score >= 0.8
              ? "bg-green-400"
              : score >= 0.6
                ? "bg-blue-400"
                : "bg-muted-foreground"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn("text-[10px] sm:text-xs font-medium", color)}>{label}</span>
    </div>
  );
}
