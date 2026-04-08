"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { ArbCard } from "@/components/arbitrage/arb-card";
import { ArbCalculator } from "@/components/arbitrage/arb-calculator";
import { useArbitrageOpportunities } from "@/hooks/use-arbitrage";
import type { ArbitrageOpportunity } from "@/types/arbitrage";

export default function ArbitrajePage() {
  const { data: arbs, isLoading } = useArbitrageOpportunities();
  const [selected, setSelected] = useState<ArbitrageOpportunity | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Oportunidades de Arbitraje</h1>
        <p className="text-muted-foreground text-sm">
          Apuestas con ganancia garantizada combinando diferentes casas
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : arbs && arbs.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            {arbs.map((arb) => (
              <div
                key={arb.id}
                onClick={() => setSelected(arb)}
                className="cursor-pointer"
              >
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
              <Card>
                <CardContent className="py-8 text-center">
                  <p className="text-muted-foreground text-sm">
                    Selecciona una oportunidad para calcular stakes
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-4xl mb-4">🔍</p>
            <p className="text-muted-foreground">
              No hay oportunidades de arbitraje activas en este momento.
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Las oportunidades se detectan automaticamente cada 30 minutos.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
