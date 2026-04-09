"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PushToggle } from "./push-toggle";

const NAV_SECTIONS = [
  {
    title: "Principal",
    items: [
      { href: "/", label: "Dashboard", icon: "🏠" },
    ],
  },
  {
    title: "Deportes",
    items: [
      { href: "/nba", label: "NBA", icon: "🏀" },
      { href: "/mlb", label: "MLB", icon: "⚾" },
    ],
  },
  {
    title: "Analisis",
    items: [
      { href: "/arbitraje", label: "Arbitraje", icon: "💰" },
      { href: "/valor", label: "Valor +EV", icon: "📈" },
      { href: "/simulaciones", label: "Simulaciones", icon: "🎯" },
    ],
  },
  {
    title: "Datos",
    items: [
      { href: "/expertos", label: "Expertos", icon: "👥" },
      { href: "/engine", label: "Engine Matrix", icon: "⚙️" },
    ],
  },
];

const ALL_TABS = NAV_SECTIONS.flatMap((s) => s.items);

export function Navbar() {
  const pathname = usePathname();
  const [refreshing, setRefreshing] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

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
        <div className="flex items-center justify-around h-14 px-1">
          {ALL_TABS.slice(0, 7).map((tab) => {
            const isActive =
              tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 w-12 h-11 rounded-xl transition-all active:scale-90",
                  isActive ? "text-orange-500 bg-orange-50" : "text-gray-400"
                )}
              >
                <span className="text-[16px] leading-none">{tab.icon}</span>
                <span className="text-[8px] font-semibold leading-none truncate w-full text-center">
                  {tab.label.length > 7 ? tab.label.slice(0, 6) : tab.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ═══ DESKTOP: Modern Sidebar ═══ */}
      <aside
        className={cn(
          "hidden lg:flex flex-col fixed left-0 top-0 bottom-0 z-50 transition-all duration-300",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* Glass background */}
        <div className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl" />

        {/* Content */}
        <div className="relative flex flex-col h-full">
          {/* Header */}
          <div className="h-14 flex items-center justify-between px-4 border-b border-white/[0.06]">
            {!collapsed && (
              <h1 className="font-extrabold text-lg tracking-tight">
                <span className="text-blue-400">Apuesta</span>
                <span className="text-orange-400">zo</span>
              </h1>
            )}
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-400 transition-colors"
            >
              <span className="text-xs">{collapsed ? "▶" : "◀"}</span>
            </button>
          </div>

          {/* Sections */}
          <nav className="flex-1 py-3 overflow-y-auto">
            {NAV_SECTIONS.map((section) => (
              <div key={section.title} className="mb-3">
                {!collapsed && (
                  <p className="px-4 mb-1 text-[10px] font-semibold text-slate-500 uppercase tracking-widest">
                    {section.title}
                  </p>
                )}
                <div className="px-2 space-y-0.5">
                  {section.items.map((item) => {
                    const isActive =
                      item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "flex items-center gap-3 rounded-lg transition-all duration-200 group",
                          collapsed ? "justify-center px-2 py-2.5" : "px-3 py-2",
                          isActive
                            ? "bg-gradient-to-r from-orange-500/20 to-orange-500/5 text-white"
                            : "text-slate-400 hover:text-slate-100 hover:bg-white/[0.05]"
                        )}
                      >
                        <span className={cn(
                          "text-base transition-transform duration-200",
                          isActive && "scale-110"
                        )}>
                          {item.icon}
                        </span>
                        {!collapsed && (
                          <span className="text-[13px] font-medium">{item.label}</span>
                        )}
                        {!collapsed && isActive && (
                          <span className="ml-auto w-1.5 h-5 rounded-full bg-orange-400" />
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-3 border-t border-white/[0.06] space-y-2">
            {!collapsed && (
              <div className="flex items-center justify-between px-1 mb-1">
                <PushToggle />
                <span className="text-[9px] text-slate-500">v1.0</span>
              </div>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className={cn(
                "w-full rounded-lg font-semibold transition-all active:scale-[0.97]",
                collapsed ? "py-2 text-xs" : "py-2.5 text-sm",
                refreshing
                  ? "bg-white/5 text-slate-600"
                  : "bg-gradient-to-r from-orange-500 to-orange-400 text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/30"
              )}
            >
              {refreshing ? "..." : collapsed ? "↻" : "Actualizar"}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
