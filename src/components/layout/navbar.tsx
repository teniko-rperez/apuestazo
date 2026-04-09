"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PushToggle } from "./push-toggle";

const NAV = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/nba", label: "NBA", icon: "🏀" },
  { href: "/mlb", label: "MLB", icon: "⚾" },
  { href: "/simulaciones", label: "Simulaciones", icon: "🎯" },
  { href: "/arbitraje", label: "Arbitraje", icon: "💰" },
  { href: "/valor", label: "Valor +EV", icon: "📈" },
  { href: "/expertos", label: "Expertos", icon: "👥" },
  { href: "/engine", label: "Engine Matrix", icon: "⚙️" },
];

export function Navbar() {
  const pathname = usePathname();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try { await fetch("/api/refresh", { method: "POST" }); window.location.reload(); }
    catch { /* */ } finally { setRefreshing(false); }
  }

  function active(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <>
      {/* ═══ MOBILE: Header ═══ */}
      <header className="lg:hidden sticky top-0 z-50 h-12 px-4 flex items-center justify-between bg-[#0a1929] text-white">
        <span className="text-sm font-extrabold tracking-tight">
          <span className="text-orange-400">Apuesta</span>zo
        </span>
        <div className="flex items-center gap-2">
          <PushToggle />
          <button onClick={handleRefresh} disabled={refreshing}
            className="h-7 px-3 text-[10px] font-bold rounded-md bg-orange-500 text-white active:scale-95 transition-transform disabled:opacity-40">
            {refreshing ? "..." : "Actualizar"}
          </button>
        </div>
      </header>

      {/* ═══ MOBILE: Bottom bar ═══ */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-[#0a1929] border-t border-white/10"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="grid grid-cols-8 h-14">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 transition-colors",
                active(n.href) ? "text-orange-400" : "text-gray-500"
              )}>
              <span className="text-[15px] leading-none">{n.icon}</span>
              <span className="text-[7px] font-bold leading-none">
                {n.label.length > 7 ? n.label.slice(0, 6) : n.label}
              </span>
            </Link>
          ))}
        </div>
      </nav>

      {/* ═══ DESKTOP: Sidebar (Auto Billings style) ═══ */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 w-[240px] bg-[#0a1929] z-50">
        {/* Brand */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-white/10">
          <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/30">
            <span className="text-white font-black text-sm">Az</span>
          </div>
          <span className="text-white font-extrabold text-[15px] tracking-tight">Apuestazo</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV.map((n) => {
            const isActive = active(n.href);
            return (
              <Link key={n.href} href={n.href}
                className={cn(
                  "flex items-center gap-3 h-10 px-4 rounded-lg text-[13px] font-medium transition-all",
                  isActive
                    ? "bg-orange-500 text-white shadow-md shadow-orange-500/25"
                    : "text-gray-400 hover:text-white hover:bg-white/5"
                )}>
                <span className="text-[15px]">{n.icon}</span>
                <span>{n.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 pb-5 space-y-3">
          <div className="flex items-center justify-between px-1">
            <PushToggle />
          </div>
          <button onClick={handleRefresh} disabled={refreshing}
            className={cn(
              "w-full h-10 rounded-lg text-[13px] font-bold transition-all border",
              refreshing
                ? "bg-transparent border-white/10 text-gray-600"
                : "bg-transparent border-orange-500/50 text-orange-400 hover:bg-orange-500 hover:text-white hover:border-orange-500"
            )}>
            {refreshing ? "Actualizando..." : "⚡ Actualizar Datos"}
          </button>
        </div>
      </aside>
    </>
  );
}
