"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PushToggle } from "./push-toggle";

const BOTTOM_NAV = [
  { href: "/", label: "Dashboard", mobileLabel: "Home", icon: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955a1.126 1.126 0 011.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  ), iconFilled: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.47 3.84a.75.75 0 011.06 0l8.69 8.69a.75.75 0 11-1.06 1.06l-.22-.22V19.5a2.25 2.25 0 01-2.25 2.25h-2.25a.75.75 0 01-.75-.75v-4.5a.75.75 0 00-.75-.75h-3a.75.75 0 00-.75.75v4.5a.75.75 0 01-.75.75H7.31a2.25 2.25 0 01-2.25-2.25v-6.13l-.22.22a.75.75 0 01-1.06-1.06l8.69-8.69z" />
    </svg>
  )},
  { href: "/simulaciones", label: "Simulaciones", mobileLabel: "Apuestas", icon: (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ), iconFilled: (
    <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
      <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 6a.75.75 0 00-1.5 0v.816a3.128 3.128 0 00-1.247.749.75.75 0 101.06 1.06 1.625 1.625 0 012.187 0c.604.604.604 1.582 0 2.186-.6.6-1.56.607-2.244.079l-.879-.659a.75.75 0 00-1.06.053A2.625 2.625 0 009 12.75c0 .764.326 1.453.848 1.935l.122.098.879.659a.75.75 0 001.06-.053A2.625 2.625 0 0015 12.75c0-.764-.326-1.453-.848-1.935l-.122-.098V6z" clipRule="evenodd"/>
    </svg>
  )},
];

const NAV_ITEMS = [
  ...BOTTOM_NAV,
  { href: "/historial", label: "Historial", mobileLabel: "Historial", icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  )},
  { href: "/engine", label: "Engine Matrix", mobileLabel: "Engine", icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )},
];

const MORE_NAV = [
  { href: "/historial", label: "Historial", icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  )},
  { href: "/engine", label: "Engine Matrix", icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )},
  { href: "/nba", label: "NBA", icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10" fill="none" stroke="currentColor" strokeWidth="2"/>
      <path d="M2 12h20M12 2v20" fill="none" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  )},
  { href: "/mlb", label: "MLB", icon: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10"/>
      <path d="M8 4.5c1.5 2 1.5 5.5 0 8s-1.5 5.5 0 7.5" strokeLinecap="round"/>
      <path d="M16 4.5c-1.5 2-1.5 5.5 0 8s1.5 5.5 0 7.5" strokeLinecap="round"/>
    </svg>
  )},
  { href: "/arbitraje", label: "Arbitraje", icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
    </svg>
  )},
  { href: "/valor", label: "Valor +EV", icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18L9 11.25l4.306 4.307a11.95 11.95 0 015.814-5.519l2.74-1.22m0 0l-5.94-2.28m5.94 2.28l-2.28 5.941" />
    </svg>
  )},
  { href: "/expertos", label: "Expertos", icon: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
    </svg>
  )},
];

const DESKTOP_SECONDARY = MORE_NAV;

export function Navbar() {
  const pathname = usePathname();
  const [refreshing, setRefreshing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [tapped, setTapped] = useState<string | null>(null);

  // Close menu on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  // Clear tap animation
  useEffect(() => {
    if (tapped) {
      const t = setTimeout(() => setTapped(null), 300);
      return () => clearTimeout(t);
    }
  }, [tapped]);

  async function handleRefresh() {
    setRefreshing(true);
    try { await fetch("/api/refresh", { method: "POST" }); window.location.reload(); }
    catch { /* */ } finally { setRefreshing(false); }
  }

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  const isMoreActive = MORE_NAV.some((n) => pathname.startsWith(n.href) && n.href !== "/");

  return (
    <>
      {/* ═══ MOBILE: Top header ═══ */}
      <header className="lg:hidden fixed top-0 inset-x-0 z-50 bg-[#0f172a]/95 backdrop-blur-xl border-b border-white/[0.06]">
        <div className="h-14 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
              <span className="text-white font-black text-xs">Az</span>
            </div>
            <span className="text-[15px] font-extrabold text-white tracking-tight">
              Apuesta<span className="text-orange-400">zo</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <PushToggle />
            <button onClick={handleRefresh} disabled={refreshing}
              className={cn(
                "h-9 px-4 text-[11px] font-bold rounded-xl transition-all duration-200 active:scale-90",
                refreshing
                  ? "bg-white/10 text-white/40"
                  : "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40"
              )}>
              {refreshing ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
              ) : "Sync"}
            </button>
            {/* Animated hamburger → X */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className={cn(
                "h-11 w-11 flex items-center justify-center rounded-2xl transition-all duration-300 active:scale-85",
                menuOpen
                  ? "bg-gradient-to-br from-orange-500 to-red-500 text-white shadow-xl shadow-orange-500/40 scale-105"
                  : isMoreActive
                    ? "bg-gradient-to-br from-orange-500/30 to-orange-600/20 text-orange-400 ring-2 ring-orange-500/30"
                    : "bg-white/15 text-white hover:bg-white/25 hover:scale-105"
              )}>
              <div className="relative w-6 h-6 flex flex-col items-center justify-center">
                <span className={cn(
                  "absolute h-[2.5px] bg-current rounded-full transition-all duration-300 ease-[cubic-bezier(0.68,-0.6,0.32,1.6)]",
                  menuOpen ? "w-5 rotate-45 translate-y-0" : "w-5 -translate-y-[7px]"
                )} />
                <span className={cn(
                  "absolute w-3.5 h-[2.5px] bg-current rounded-full transition-all duration-200",
                  menuOpen ? "opacity-0 scale-0 rotate-180" : "opacity-100 scale-100 rotate-0"
                )} />
                <span className={cn(
                  "absolute h-[2.5px] bg-current rounded-full transition-all duration-300 ease-[cubic-bezier(0.68,-0.6,0.32,1.6)]",
                  menuOpen ? "w-5 -rotate-45 translate-y-0" : "w-4 translate-y-[7px]"
                )} />
              </div>
              {/* Notification dot when on a "more" page */}
              {isMoreActive && !menuOpen && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-orange-500 ring-2 ring-[#0f172a] animate-pulse" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* ═══ MOBILE: Slide-up menu overlay ═══ */}
      <div
        className={cn(
          "lg:hidden fixed inset-0 z-[60] transition-all duration-300",
          menuOpen ? "pointer-events-auto" : "pointer-events-none"
        )}
        onClick={() => setMenuOpen(false)}
      >
        {/* Backdrop */}
        <div className={cn(
          "absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300",
          menuOpen ? "opacity-100" : "opacity-0"
        )} />
        {/* Menu panel */}
        <div
          className={cn(
            "absolute bottom-0 inset-x-0 bg-white rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out",
            menuOpen ? "translate-y-0" : "translate-y-full"
          )}
          style={{ paddingBottom: "env(safe-area-inset-bottom, 8px)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Handle */}
          <div className="flex justify-center pt-3 pb-2">
            <div className="w-10 h-1 rounded-full bg-gray-300" />
          </div>
          <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest px-6 mb-2">Mas opciones</p>
          <nav className="px-4 pb-4 space-y-1">
            {MORE_NAV.map((n, i) => {
              const active = isActive(n.href);
              return (
                <Link key={n.href} href={n.href} onClick={() => setMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-4 h-12 px-4 rounded-xl transition-all duration-200 active:scale-[0.97]",
                    active
                      ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/20"
                      : "text-gray-600 hover:bg-gray-50 active:bg-gray-100"
                  )}
                  style={{ transitionDelay: menuOpen ? `${i * 30}ms` : "0ms" }}>
                  <span className={cn(
                    "w-9 h-9 rounded-lg flex items-center justify-center transition-colors",
                    active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-400"
                  )}>{n.icon}</span>
                  <span className="text-[14px] font-semibold">{n.label}</span>
                  {active && <span className="ml-auto w-2 h-2 rounded-full bg-white/60 animate-pulse" />}
                  {!active && (
                    <svg className="ml-auto w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                    </svg>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* ═══ MOBILE: Bottom nav ═══ */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-50 bg-white/95 backdrop-blur-xl border-t border-gray-200/60"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
        <div className="grid grid-cols-2 h-[68px] max-w-sm mx-auto">
          {BOTTOM_NAV.map((n) => {
            const active = isActive(n.href);
            const wasTapped = tapped === n.href;
            return (
              <Link key={n.href} href={n.href}
                onClick={() => setTapped(n.href)}
                className="flex flex-col items-center justify-center gap-1.5 relative">
                {/* Active background pill */}
                <span className={cn(
                  "absolute inset-x-4 inset-y-2 rounded-2xl transition-all duration-300 ease-out",
                  active ? "bg-orange-50 scale-100" : "bg-transparent scale-75 opacity-0"
                )} />
                {/* Top indicator bar */}
                <span className={cn(
                  "absolute top-0 left-1/2 -translate-x-1/2 h-[3px] rounded-full bg-orange-500 transition-all duration-300",
                  active ? "w-10 opacity-100" : "w-0 opacity-0"
                )} />
                {/* Icon with bounce on tap */}
                <span className={cn(
                  "relative z-10 transition-all duration-200",
                  active ? "text-orange-500" : "text-gray-400",
                  wasTapped && "scale-125",
                  active && !wasTapped && "scale-105"
                )}>
                  {active ? n.iconFilled : n.icon}
                </span>
                {/* Label */}
                <span className={cn(
                  "relative z-10 text-[10px] font-bold leading-none transition-all duration-200",
                  active ? "text-orange-500" : "text-gray-400"
                )}>{n.mobileLabel}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ═══ DESKTOP: Sidebar ═══ */}
      <aside className="hidden lg:flex flex-col fixed left-0 top-0 bottom-0 z-50 w-[260px] bg-[#0f172a]">
        {/* Brand */}
        <div className="h-16 flex items-center gap-3 px-5 border-b border-white/5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/20">
            <span className="text-white font-black text-sm">Az</span>
          </div>
          <div>
            <span className="text-[16px] font-extrabold text-white tracking-tight">
              Apuesta<span className="text-orange-400">zo</span>
            </span>
            <p className="text-[10px] text-slate-500 font-medium -mt-0.5">Sports Analytics</p>
          </div>
        </div>

        {/* Main nav */}
        <div className="px-3 mt-5">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2 px-3">Menu</p>
          <nav className="space-y-0.5">
            {NAV_ITEMS.map((n) => {
              const active = isActive(n.href);
              return (
                <Link key={n.href} href={n.href}
                  className={cn(
                    "group flex items-center gap-3 h-11 rounded-xl transition-all duration-200 px-3",
                    active
                      ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/20"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  )}>
                  <span className={cn("transition-colors", active ? "text-white" : "text-slate-500 group-hover:text-orange-400")}>{n.icon}</span>
                  <span className="text-[13px] font-semibold">{n.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Secondary nav */}
        <div className="px-3 mt-6">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-2 px-3">Analisis</p>
          <nav className="space-y-0.5">
            {DESKTOP_SECONDARY.map((n) => {
              const active = isActive(n.href);
              return (
                <Link key={n.href} href={n.href}
                  className={cn(
                    "group flex items-center gap-3 h-11 rounded-xl transition-all duration-200 px-3",
                    active
                      ? "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/20"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  )}>
                  <span className={cn("transition-colors", active ? "text-white" : "text-slate-500 group-hover:text-orange-400")}>{n.icon}</span>
                  <span className="text-[13px] font-semibold">{n.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer */}
        <div className="mt-auto px-4 pb-5 pt-3 border-t border-white/5">
          <div className="flex items-center justify-between mb-3">
            <PushToggle />
          </div>
          <button onClick={handleRefresh} disabled={refreshing}
            className={cn(
              "w-full h-11 rounded-xl font-bold text-[13px] transition-all active:scale-[0.97]",
              refreshing
                ? "bg-white/5 text-slate-500"
                : "bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/20 hover:shadow-orange-500/40"
            )}>
            {refreshing ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                </svg>
                Actualizando...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                </svg>
                Actualizar Datos
              </span>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}
