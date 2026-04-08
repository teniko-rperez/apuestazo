"use client";

import { cn } from "@/lib/utils";

export function ConfidenceMeter({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color =
    score >= 0.8
      ? "text-orange-500"
      : score >= 0.6
        ? "text-yellow-600"
        : "text-orange-500";
  const label =
    score >= 0.8 ? "Alta" : score >= 0.6 ? "Media" : "Baja";

  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            score >= 0.8
              ? "bg-blue-400"
              : score >= 0.6
                ? "bg-yellow-400"
                : "bg-orange-400"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={cn("text-xs font-medium", color)}>{label}</span>
    </div>
  );
}
