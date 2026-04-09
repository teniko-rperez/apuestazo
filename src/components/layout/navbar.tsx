"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PushToggle } from "./push-toggle";

const TABS = [
  { href: "/", label: "Inicio", icon: "🏠" },
  { href: "/nba", label: "NBA", icon: "🏀" },
  { href: "/mlb", label: "MLB", icon: "⚾" },
  { href: "/arbitraje", label: "Arbitraje", icon: "💰" },
  { href: "/valor", label: "Valor +EV", icon: "📈" },
  { href: "/simulaciones", label: "Simulaciones", icon: "🎯" },
  { href: "/expertos", label: "Expertos", icon: "👥" },
  { href: "/engine", label: "Engine", icon: "⚙️" },
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
      {/* ═══ MOBILE: Top header ═══ */}
      <header className="lg:hidden sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-border/50 px-4 h-12 flex items-center justify-between">
        <h1 className="font-extrabold text-base tracking-tight">
          <span className="text-blue-600">Apuesta</span>
          <span className="text-orange-500">zo</span>
        </h1>
        <div className="flex items-center gap-2">
          <PushToggle />
          <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={cn(
            "h-7 px-3 text-[11px] rounded-full font-semibold transition-all",
            refreshing
              ? "bg-gray-50 text-gray-300 border border-gray-200"
              : "bg-white text-orange-500 border border-orange-300 shadow-sm active:scale-95"
          )}
        >
          {refreshing ? "..." : "Actualizar"}
          </button>
        </div>
      </header>

      {/* ═══ MOBILE: Bottom tab bar ═══ */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-t border-border/50"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="flex items-center justify-around h-14 px-2">
          {TABS.slice(0, 6).map((tab) => {
            const isActive =
              tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 w-14 h-11 rounded-xl transition-all active:scale-90",
                  isActive ? "text-orange-500 bg-orange-50" : "text-gray-400"
                )}
              >
                <span className="text-[18px] leading-none">{tab.icon}</span>
                <span className="text-[9px] font-semibold leading-none">
                  {tab.label.length > 6 ? tab.label.slice(0, 5) : tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ═══ DESKTOP: Sidebar ═══ */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-56 bg-gradient-to-b from-slate-900 to-slate-950 z-50">
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-white/10">
          <h1 className="font-extrabold text-xl tracking-tight">
            <span className="text-blue-400">Apuesta</span>
            <span className="text-orange-400">zo</span>
          </h1>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {TABS.map((tab) => {
            const isActive =
              tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all",
                  isActive
                    ? "bg-white/10 text-white shadow-sm shadow-black/20"
                    : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                )}
              >
                <span className="text-base">{tab.icon}</span>
                <span>{tab.label}</span>
                {isActive && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-orange-400" />}
              </Link>
            );
          })}
        </nav>

        {/* Push + Refresh */}
        <div className="p-4 border-t border-white/10 space-y-2">
          <div className="flex justify-center">
            <PushToggle />
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={cn(
              "w-full py-2.5 rounded-xl text-sm font-semibold transition-all",
              refreshing
                ? "bg-white/5 text-slate-500"
                : "bg-white text-slate-900 shadow-sm hover:bg-slate-100 active:scale-[0.98]"
            )}
          >
            {refreshing ? "..." : "Actualizar"}
          </button>
        </div>
      </aside>
    </>
  );
}
