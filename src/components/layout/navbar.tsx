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
      {/* Top header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-border/50 px-4 h-12 flex items-center justify-between">
        <h1 className="font-extrabold text-base tracking-tight">
          <span className="text-blue-600">Apuesta</span>
          <span className="text-orange-500">zo</span>
        </h1>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={cn(
            "h-7 px-3 text-[11px] rounded-full font-semibold transition-all",
            refreshing
              ? "bg-orange-50 text-orange-300"
              : "bg-orange-500 text-white shadow-sm active:scale-95"
          )}
        >
          {refreshing ? "..." : "Actualizar"}
        </button>
      </header>

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-t border-border/50"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex items-center justify-around h-14 px-2">
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
                  "flex flex-col items-center justify-center gap-0.5 w-14 h-11 rounded-xl transition-all active:scale-90",
                  isActive
                    ? "text-orange-500 bg-orange-50"
                    : "text-gray-400"
                )}
              >
                <span className="text-[18px] leading-none">{tab.icon}</span>
                <span className="text-[9px] font-semibold leading-none">
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
