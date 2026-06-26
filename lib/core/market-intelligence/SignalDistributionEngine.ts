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
   */
  public static process(opportunities: Opportunity[], regime: RegimeProfile): DistributedSignal[] {
    return opportunities.map(op => {
      let tier: "FREE" | "VIP" | "NONE" = "NONE";
      
      // Thresholds de Elite
      // FREE: Isca de alta assertividade (Prob > 75% ou Edge > 15%)
      if (op.probability >= 0.75 || op.edge >= 0.15) {
        tier = "FREE";
      } 
      // VIP: Valor real e Edge consistente (Prob > 55% e Edge > 5%)
      else if (op.probability >= 0.55 && op.edge >= 0.05) {
        tier = "VIP";
      }

      const priority = (op.edge * 0.6) + (op.confidence * 0.4);

      return {
        ...op,
        tier,
        priority,
        marketingCTA: tier === "FREE" ? "🔥 SINAL FREE DE ALTA CONFIANÇA! Garanta o lucro no VIP para acesso total." : undefined
      };
    }).filter(s => s.tier !== "NONE")
      .sort((a, b) => b.priority - a.priority);
  }
}
