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
      
      const prob = s.probability;
      const ev = s.expectedValue || 0;
      const conf = regime.confidence;

      // 9. CAMADA FINAL DE QUALIDADE DO SINAL
      // Validar: probabilidade mínima, edge mínimo, confiança, ausência de anomalia

      // VIP: Todos os sinais aprovados, probabilidade extrema, edge, ev+, mercado, justificativa
      // Requisitos VIP: Probabilidade >= 65%, Edge (EV) > 5%, Confiança do Regime >= 70%
      const isVipThreshold = prob >= 0.65 && ev > 0.05 && conf >= 0.70;
      
      // FREE: Alta assertividade, maior confiança, mesmo sem Ev+, várias oportunidades diárias
      // Requisitos FREE: Probabilidade >= 80%, Confiança do Regime >= 80% (Foco em Green)
      const isFreeThreshold = prob >= 0.80 && conf >= 0.80;

      if (isVipThreshold) {
        type = SignalType.VALUE;
        tier = "VIP";
      } else if (isFreeThreshold) {
        type = SignalType.VALIDATION;
        tier = "FREE";
      }

      return {
        ...s,
        signal_type: type,
        confidence_score: conf,
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
