"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PushToggle } from "./push-toggle";

const MAIN_NAV = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/nba", label: "NBA", icon: "🏀" },
  { href: "/mlb", label: "MLB", icon: "⚾" },
  { href: "/simulaciones", label: "Simulaciones", icon: "🎯" },
];

const OTHER_NAV = [
  { href: "/arbitraje", label: "Arbitraje", icon: "💰" },
  { href: "/valor", label: "Valor +EV", icon: "📈" },
  { href: "/expertos", label: "Expertos", icon: "👥" },
  { href: "/historial", label: "Historial", icon: "📜" },
  { href: "/engine", label: "Engine Matrix", icon: "⚙️" },
];

const ALL_NAV = [...MAIN_NAV, ...OTHER_NAV];

export function Navbar() {
  const pathname = usePathname();
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try { await fetch("/api/refresh", { method: "POST" }); window.location.reload(); }
    catch { /* */ } finally { setRefreshing(false); }
  }

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <>
      {/* ═══ MOBILE: Header ═══ */}
      <header className="lg:hidden sticky top-0 z-50 h-12 px-4 flex items-center justify-between bg-white border-b border-gray-100">
        <span className="text-sm font-extrabold tracking-tight text-gray-800">
          <span className="text-blue-500">Apuesta</span><span className="text-orange-500">zo</span>
        </span>
        <div className="flex items-center gap-2">
          <PushToggle />
          <button onClick={handleRefresh} disabled={refreshing}
            className="h-7 px-3 text-[10px] font-bold rounded-lg bg-blue-500 text-white active:scale-95 transition-transform disabled:opacity-40">
            {refreshing ? "..." : "Sync"}
          </button>
        </div>
      </header>

      {/* ═══ MOBILE: Bottom bar ═══ */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-100"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="grid grid-cols-7 h-14">
          {ALL_NAV.slice(0, 7).map((n) => (
            <Link key={n.href} href={n.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 transition-colors",
                isActive(n.href) ? "text-blue-500" : "text-gray-400"
              )}>
              <span className="text-[15px] leading-none">{n.icon}</span>
              <span className="text-[7px] font-bold leading-none">
                {n.label.length > 7 ? n.label.slice(0, 6) : n.label}
              </span>
            </Link>
          ))}
        </div>
      </nav>

      {/* ═══ DESKTOP: Hoverable Sidebar ═══ */}
      <aside
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        className={cn(
          "hidden lg:flex flex-col fixed left-0 top-0 bottom-0 z-50 bg-white border-r border-gray-100 transition-all duration-300 ease-in-out overflow-hidden",
          expanded ? "w-[220px] shadow-xl shadow-black/5" : "w-[68px]"
        )}
      >
        {/* Brand */}
        <div className="h-14 flex items-center gap-3 px-4 shrink-0">
          <div className="w-9 h-9 rounded-xl bg-blue-500 flex items-center justify-center shrink-0">
            <span className="text-white font-black text-sm">Az</span>
          </div>
          <span className={cn(
            "text-[15px] font-extrabold text-gray-800 whitespace-nowrap transition-opacity duration-200",
            expanded ? "opacity-100" : "opacity-0"
          )}>
            Apuestazo
          </span>
        </div>

        {/* Section: Principal */}
        <div className="px-3 mt-2">
          <p className={cn(
            "text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 px-2 transition-opacity duration-200",
            expanded ? "opacity-100" : "opacity-0"
          )}>Principal</p>
          <div className="h-px bg-gray-100 mb-2" />
        </div>

        <nav className="px-3 space-y-0.5">
          {MAIN_NAV.map((n) => {
            const active = isActive(n.href);
            return (
              <Link key={n.href} href={n.href} title={!expanded ? n.label : undefined}
                className={cn(
                  "group flex items-center gap-3 h-10 rounded-xl transition-all duration-200",
                  expanded ? "px-3" : "px-0 justify-center",
                  active
                    ? "bg-blue-500 text-white shadow-md shadow-blue-500/25"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                )}>
                <span className="text-[17px] shrink-0">{n.icon}</span>
                <span className={cn(
                  "text-[13px] font-medium whitespace-nowrap transition-opacity duration-200",
                  expanded ? "opacity-100" : "opacity-0 w-0"
                )}>{n.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Section: Otros */}
        <div className="px-3 mt-4">
          <p className={cn(
            "text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1 px-2 transition-opacity duration-200",
            expanded ? "opacity-100" : "opacity-0"
          )}>Otros</p>
          <div className="h-px bg-gray-100 mb-2" />
        </div>

        <nav className="px-3 space-y-0.5 flex-1">
          {OTHER_NAV.map((n) => {
            const active = isActive(n.href);
            return (
              <Link key={n.href} href={n.href} title={!expanded ? n.label : undefined}
                className={cn(
                  "group flex items-center gap-3 h-10 rounded-xl transition-all duration-200",
                  expanded ? "px-3" : "px-0 justify-center",
                  active
                    ? "bg-blue-500 text-white shadow-md shadow-blue-500/25"
                    : "text-gray-500 hover:bg-gray-50 hover:text-gray-800"
                )}>
                <span className="text-[17px] shrink-0">{n.icon}</span>
                <span className={cn(
                  "text-[13px] font-medium whitespace-nowrap transition-opacity duration-200",
                  expanded ? "opacity-100" : "opacity-0 w-0"
                )}>{n.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 pb-4 pt-2 border-t border-gray-100 shrink-0">
          <div className={cn("mb-2 flex justify-center", expanded ? "" : "")}>
            <PushToggle />
          </div>
          <button onClick={handleRefresh} disabled={refreshing}
            className={cn(
              "w-full rounded-xl font-bold transition-all active:scale-[0.97]",
              expanded ? "h-10 text-[12px]" : "h-10 text-[14px]",
              refreshing
                ? "bg-gray-50 text-gray-400"
                : "bg-blue-500 text-white shadow-md shadow-blue-500/25 hover:bg-blue-600"
            )}>
            {refreshing ? "..." : expanded ? "⚡ Actualizar" : "⚡"}
          </button>
        </div>
      </aside>
    </>
  );
}
