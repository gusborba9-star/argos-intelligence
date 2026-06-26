import { Opportunity } from "./MarketDiscoveryEngine";
import { RegimeProfile } from "@/lib/argos/regime/RegimeSchema";

export interface DistributedSignal extends Opportunity {
  tier: "FREE" | "VIP" | "NONE";
  priority: number;
  marketingCTA?: string;
}

export class SignalDistributionEngine {
  /**
   * Classifica e distribui sinais com base em thresholds de elite (Syndicate Level).
   * Implementa a regra de "Max 2 mercados FREE" por partida.
   */
  public static process(opportunities: Opportunity[], regime: RegimeProfile): DistributedSignal[] {
    const distributed: DistributedSignal[] = [];
    let freeCount = 0;

    // Ordenamos por prioridade (Edge + Confiança) para garantir que os melhores sinais sejam avaliados primeiro
    const sortedOps = opportunities.sort((a, b) => {
      const priorityA = (a.edge * 0.6) + (a.confidence * 0.4);
      const priorityB = (b.edge * 0.6) + (b.confidence * 0.4);
      return priorityB - priorityA;
    });

    for (const op of sortedOps) {
      let tier: "FREE" | "VIP" | "NONE" = "NONE";
      const priority = (op.edge * 0.6) + (op.confidence * 0.4);

      // 1. Regra VIP: Todos os sinais com EV+ e Edge consistente
      if (op.probability >= 0.55 && op.edge >= 0.05) {
        tier = "VIP";
      }

      // 2. Regra FREE: Isca de alta assertividade (Prob > 75% ou Edge > 15%)
      // Limitado a no máximo 2 sinais por partida para retenção
      if ((op.probability >= 0.75 || op.edge >= 0.15) && freeCount < 2) {
        tier = "FREE";
        freeCount++;
      }

      if (tier !== "NONE") {
        distributed.push({
          ...op,
          tier,
          priority,
          marketingCTA: tier === "FREE" ? "🔥 SINAL FREE DE ALTA CONFIANÇA! Garanta o lucro no VIP para acesso total." : undefined
        });
      }
    }

    return distributed.sort((a, b) => b.priority - a.priority);
  }
}
