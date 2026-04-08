"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function Navbar() {
  const pathname = usePathname();
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/refresh", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setLastRefresh(new Date().toLocaleTimeString("es-ES"));
        // Reload page data
        window.location.reload();
      }
    } catch {
      // silent fail
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <nav className="border-b border-border bg-card sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex h-14 items-center gap-6">
          <Link href="/" className="font-bold text-lg tracking-tight">
            <span className="text-green-400">Apuestazo</span>
          </Link>

          <div className="flex items-center gap-1 overflow-x-auto flex-1">
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "px-3 py-1.5 text-sm rounded-md transition-colors whitespace-nowrap",
                    isActive
                      ? "bg-green-500/15 text-green-400 font-medium"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            {lastRefresh && (
              <span className="text-[10px] text-muted-foreground hidden sm:block">
                {lastRefresh}
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className={cn(
                "px-3 py-1.5 text-sm rounded-md transition-all font-medium whitespace-nowrap",
                refreshing
                  ? "bg-green-500/10 text-green-400/50 cursor-wait"
                  : "bg-green-500/15 text-green-400 hover:bg-green-500/25 active:scale-95"
              )}
            >
              {refreshing ? "Actualizando..." : "Actualizar"}
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
