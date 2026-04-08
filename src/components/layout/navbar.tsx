"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Inicio", icon: "🏠" },
  { href: "/nba", label: "NBA", icon: "🏀" },
  { href: "/mlb", label: "MLB", icon: "⚾" },
  { href: "/arbitraje", label: "Arb", icon: "💰" },
  { href: "/valor", label: "+EV", icon: "📈" },
  { href: "/simulaciones", label: "Sim", icon: "🎯" },
  { href: "/expertos", label: "Tips", icon: "👥" },
];

export function Navbar() {
  const pathname = usePathname();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      await res.json();
      window.location.reload();
    } catch {
      // silent
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <>
      {/* Top header - compact */}
      <header className="sticky top-0 z-50 bg-card border-b border-border px-4 py-2 flex items-center justify-between">
        <h1 className="font-bold text-lg">
          <span className="text-blue-400">Apuesta</span>
          <span className="text-orange-400">zo</span>
        </h1>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={cn(
            "px-3 py-1 text-xs rounded-full font-medium transition-all",
            refreshing
              ? "bg-orange-500/10 text-orange-400/50"
              : "bg-orange-500/15 text-orange-400 hover:bg-orange-500/25 active:scale-95"
          )}
        >
          {refreshing ? "..." : "Actualizar"}
        </button>
      </header>

      {/* Bottom tab bar - mobile style */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border safe-area-pb">
        <div className="flex items-center justify-around px-1 py-1">
          {TABS.map((tab) => {
            const isActive =
              tab.href === "/"
                ? pathname === "/"
                : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-2 py-1.5 rounded-lg transition-colors min-w-[44px]",
                  isActive
                    ? "text-orange-400"
                    : "text-muted-foreground"
                )}
              >
                <span className="text-lg leading-none">{tab.icon}</span>
                <span className="text-[10px] font-medium leading-none">
                  {tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
