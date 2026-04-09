"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ArbCard } from "@/components/arbitrage/arb-card";
import { ArbCalculator } from "@/components/arbitrage/arb-calculator";
import { useArbitrageOpportunities } from "@/hooks/use-arbitrage";
import type { ArbitrageOpportunity } from "@/types/arbitrage";

export default function ArbitrajePage() {
  const { data: arbs, isLoading } = useArbitrageOpportunities();
  const [selected, setSelected] = useState<ArbitrageOpportunity | null>(null);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl lg:text-3xl font-extrabold text-gray-900">Arbitraje</h1>
        <p className="text-sm text-gray-500 mt-1">Apuestas con ganancia garantizada combinando diferentes casas</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div>
      ) : arbs && arbs.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {arbs.map((arb) => (
              <div key={arb.id} onClick={() => setSelected(arb)} className="cursor-pointer">
                <ArbCard arb={arb} />
              </div>
            ))}
          </div>
          <div>
            {selected ? (
              <div className="sticky top-20">
                <ArbCalculator arb={selected} />
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-8 text-center border border-gray-100">
                <div className="w-12 h-12 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.042 21.672L13.684 16.6m0 0l-2.51 2.225.569-9.47 5.227 7.917-3.286-.672zM12 2.25V4.5m5.834.166l-1.591 1.591M20.25 10.5H18M7.757 14.743l-1.59 1.59M6 10.5H3.75m4.007-4.243l-1.59-1.59" />
                  </svg>
                </div>
                <p className="text-[13px] text-gray-400 font-medium">Selecciona una oportunidad</p>
                <p className="text-[11px] text-gray-300 mt-1">para calcular stakes</p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
          <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
          </div>
          <p className="text-[14px] text-gray-400 font-medium">No hay oportunidades de arbitraje activas</p>
          <p className="text-[12px] text-gray-300 mt-1">Se detectan automaticamente cada 15 minutos</p>
        </div>
      )}

      <div className="h-8" />
    </div>
  );
}
