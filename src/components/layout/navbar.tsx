"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const TABS = [
  { href: "/", label: "Inicio", icon: "🏠" },
  { href: "/nba", label: "NBA", icon: "🏀" },
  { href: "/mlb", label: "MLB", icon: "⚾" },
  { href: "/arbitraje", label: "Arbitraje", icon: "💰" },
  { href: "/valor", label: "Valor +EV", icon: "📈" },
  { href: "/simulaciones", label: "Simulaciones", icon: "🎯" },
  { href: "/expertos", label: "Expertos", icon: "👥" },
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
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-52 bg-white border-r border-border/50 z-50">
        {/* Logo */}
        <div className="h-16 flex items-center px-5 border-b border-border/50">
          <h1 className="font-extrabold text-xl tracking-tight">
            <span className="text-blue-600">Apuesta</span>
            <span className="text-orange-500">zo</span>
          </h1>
        </div>

        {/* Nav links */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {TABS.map((tab) => {
            const isActive =
              tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all",
                  isActive
                    ? "bg-orange-50 text-orange-600"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                )}
              >
                <span className="text-lg">{tab.icon}</span>
                <span>{tab.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Refresh button */}
        <div className="p-4 border-t border-border/50">
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className={cn(
              "w-full py-2.5 rounded-xl text-sm font-semibold transition-all",
              refreshing
                ? "bg-orange-50 text-orange-300"
                : "bg-orange-500 text-white shadow-sm hover:bg-orange-600 active:scale-[0.98]"
            )}
          >
            {refreshing ? "Actualizando..." : "Actualizar Datos"}
          </button>
        </div>
      </aside>
    </>
  );
}
