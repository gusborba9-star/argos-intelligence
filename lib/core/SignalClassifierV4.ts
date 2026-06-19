import { ArgosSignal } from "@/lib/core/contracts/SignalContract";
import { RegimeProfile } from "@/lib/argos/regime/RegimeSchema";

// ============================================================
// SIGNAL CLASSIFIER v4.1 — MULTI-VERTICAL
// Classifica Gols, Escanteios, Cartões e Finalizações
// ============================================================

export enum SignalType {
  VALUE = "VALUE",
  VALIDATION = "VALIDATION",
  NOISE = "NOISE"
}

export interface ClassifiedSignal extends ArgosSignal {
  signal_type: SignalType;
  confidence_score: number;
  tier: "FREE" | "VIP" | "NONE";
}

export class SignalClassifierV4 {
  /**
   * Classifica uma oportunidade de mercado usando a Tripla Classificação
   */
  /**
   * Argos v5.0: Camada de Classificação de Entrega (Free vs VIP)
   * O motor é único, a diferença está na seletividade da entrega.
   */
  static classify(signals: ArgosSignal[], regime: RegimeProfile): ClassifiedSignal[] {
    return signals.map(s => {
      let type = SignalType.NOISE;
      let tier: "FREE" | "VIP" | "NONE" = "NONE";
      
      // 1. Lógica de Valor/Validação
      if (s.expectedValue > 0.05) { // Edge mínimo para VALUE
        type = SignalType.VALUE;
      } else if (s.probability >= 0.70) {
        type = SignalType.VALIDATION;
      }

      // 2. Lógica de Tier (Argos v5.0)
      // VIP: EV+ e Alta Confiança em qualquer vertical
      if (type === SignalType.VALUE && regime.confidence >= 0.7) {
        tier = "VIP";
      }
      
      // FREE: Alta Probabilidade, Máxima Clareza, até 2 verticais específicas (Gols/Match Odds)
      const isFreeVertical = ["GOALS", "MATCH_ODDS"].includes(s.vertical);
      if (tier === "NONE" && isFreeVertical && (s.probability >= 0.75 || type === SignalType.VALUE)) {
        tier = "FREE";
      }

      return {
        ...s,
        signal_type: type,
        confidence_score: regime.confidence,
        tier: tier,
        status: (type === SignalType.VALUE ? "OPTIMIZED" : "HEDGED") as any
      };
    }).filter(s => s.tier !== "NONE"); 
  }

  /**
   * Prepara os dados para o Ledger do Supabase
   */
  static prepareLedger(matchId: string, leagueId: string | undefined, signals: ClassifiedSignal[], regime: RegimeProfile) {
    return signals.map(s => ({
      match_id: matchId,
      league_id: leagueId,
      signal_type: s.signal_type,
      vertical: s.vertical,
      market: s.market,
      probability: s.probability,
      expected_value: s.expectedValue,
      regime: regime.regime,
      confidence: regime.confidence,
      created_at: new Date().toISOString()
    }));
  }
}
