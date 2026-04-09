"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PushToggle } from "./push-toggle";

const NAV = [
  { href: "/", label: "Dashboard", short: "Home", icon: "◉" },
  { href: "/nba", label: "NBA", short: "NBA", icon: "●" },
  { href: "/mlb", label: "MLB", short: "MLB", icon: "●" },
  { href: "/simulaciones", label: "Simulaciones", short: "Sims", icon: "◎" },
  { href: "/arbitraje", label: "Arbitraje", short: "Arb", icon: "◆" },
  { href: "/valor", label: "Valor +EV", short: "+EV", icon: "▲" },
  { href: "/expertos", label: "Expertos", short: "Tips", icon: "◇" },
  { href: "/engine", label: "Engine Matrix", short: "Engine", icon: "⬡" },
];

export function Navbar() {
  const pathname = usePathname();
  const [refreshing, setRefreshing] = useState(false);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      await fetch("/api/refresh", { method: "POST" });
      window.location.reload();
    } catch { /* */ }
    finally { setRefreshing(false); }
  }

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <>
      {/* ══ MOBILE: Header ══ */}
      <header className="lg:hidden sticky top-0 z-50 h-11 px-4 flex items-center justify-between bg-white border-b border-gray-200">
        <span className="text-sm font-black tracking-tight text-gray-900">A<span className="text-orange-500">z</span></span>
        <div className="flex items-center gap-1.5">
          <PushToggle />
          <button onClick={handleRefresh} disabled={refreshing}
            className="h-6 px-2.5 text-[10px] font-bold rounded-md bg-gray-900 text-white active:scale-95 transition-transform disabled:opacity-40">
            {refreshing ? "..." : "SYNC"}
          </button>
        </div>
      </header>

      {/* ══ MOBILE: Bottom bar ══ */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-gray-200"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="grid grid-cols-8 h-12">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href}
              className={cn(
                "flex flex-col items-center justify-center gap-px transition-colors",
                isActive(n.href) ? "text-orange-500" : "text-gray-400"
              )}>
              <span className="text-[14px] leading-none font-bold">{n.icon}</span>
              <span className="text-[7px] font-bold leading-none">{n.short}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* ══ DESKTOP: Sidebar ══ */}
      <aside className="hidden lg:block fixed left-0 top-0 bottom-0 w-[220px] z-50">
        {/* BG */}
        <div className="absolute inset-0 bg-[#0c0c0f]" />

        <div className="relative h-full flex flex-col">
          {/* Brand */}
          <div className="h-14 flex items-center gap-2 px-5">
            <div className="w-7 h-7 rounded-lg bg-orange-500 flex items-center justify-center">
              <span className="text-white font-black text-xs">Az</span>
            </div>
            <div>
              <p className="text-[13px] font-bold text-white leading-none">Apuestazo</p>
              <p className="text-[9px] text-gray-500 leading-none mt-0.5">20 signal engine</p>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-2 space-y-px overflow-y-auto">
            {NAV.map((n) => {
              const active = isActive(n.href);
              return (
                <Link key={n.href} href={n.href}
                  className={cn(
                    "group flex items-center gap-2.5 h-9 px-3 rounded-lg text-[13px] font-medium transition-all",
                    active
                      ? "bg-white/[0.08] text-white"
                      : "text-gray-500 hover:text-gray-300 hover:bg-white/[0.04]"
                  )}>
                  <span className={cn(
                    "w-5 text-center text-[11px] font-bold transition-colors",
                    active ? "text-orange-400" : "text-gray-600 group-hover:text-gray-400"
                  )}>{n.icon}</span>
                  <span>{n.label}</span>
                  {active && <span className="ml-auto w-1 h-4 rounded-full bg-orange-500" />}
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="px-3 pb-4 space-y-2">
            <div className="flex items-center justify-between px-2">
              <PushToggle />
              <span className="text-[9px] text-gray-600 font-mono">v2.0</span>
            </div>
            <button onClick={handleRefresh} disabled={refreshing}
              className={cn(
                "w-full h-9 rounded-lg text-[12px] font-bold transition-all",
                refreshing
                  ? "bg-white/5 text-gray-600"
                  : "bg-white text-[#0c0c0f] hover:bg-gray-100 active:scale-[0.97]"
              )}>
              {refreshing ? "Syncing..." : "Actualizar Datos"}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
