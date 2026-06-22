import { ArgosSignal } from "@/lib/core/contracts/SignalContract";
import { RegimeProfile } from "@/lib/argos/regime/RegimeSchema";

// ============================================================
// SIGNAL CLASSIFIER v4.2 — MULTI-VERTICAL (SYNDICATE EDITION)
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
  static classify(signals: ArgosSignal[], regime: RegimeProfile): ClassifiedSignal[] {
    return signals.map(s => {
      let type = SignalType.NOISE;
      let tier: "FREE" | "VIP" | "NONE" = "NONE";
      
      const prob = s.probability;
      const ev = s.expectedValue || 0;
      const conf = regime.confidence;

      // 9. CAMADA FINAL DE QUALIDADE DO SINAL
      // Argos v5.1 Syndicate-Level: Thresholds de Elite Reajustados
      
      // VIP: Foco em Volume com Edge (EV+) e Confiança Estrutural
      // Requisitos VIP: Probabilidade >= 55% (Agressivo), Edge (EV) > 5%
      const isVipThreshold = prob >= 0.55 && ev > 0.05;
      
      // FREE: Foco em Assertividade Pura (Isca para Marketing)
      // Requisitos FREE: Probabilidade >= 75%
      const isFreeThreshold = prob >= 0.75;

      if (isFreeThreshold) {
        // Se é FREE, automaticamente é VIP também na lógica de entrega, 
        // mas marcamos como FREE para o dispatcher saber que deve enviar para ambos.
        type = SignalType.VALIDATION;
        tier = "FREE";
      } else if (isVipThreshold) {
        type = SignalType.VALUE;
        tier = "VIP";
      }

      return {
        ...s,
        signal_type: type,
        confidence_score: conf,
        tier: tier,
        status: (tier === "VIP" ? "OPTIMIZED" : tier === "FREE" ? "PREMIUM" : "HEDGED") as any
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
      tier: s.tier,
      created_at: new Date().toISOString()
    }));
  }
}
