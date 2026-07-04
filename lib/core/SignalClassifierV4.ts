import { ArgosSignal } from "@/lib/core/contracts/SignalContract";
import { RegimeProfile } from "@/lib/argos/regime/RegimeSchema";

// ============================================================
// SIGNAL CLASSIFIER v4.4 — RANKING & CALIBRATION (SYNDICATE)
// FILOSOFIA: "O sistema deve errar para mais, não para menos."
// MUDANÇA: Tier vira classificação/ranking, não filtro de exclusão.
// INTEGRADO: Agora suporta perfis de calibração dinâmica.
// ============================================================

export enum SignalType {
  VALUE = "VALUE",
  VALIDATION = "VALIDATION",
  NOISE = "NOISE",
  LOW_PRIORITY = "LOW_PRIORITY"
}

export interface ClassifiedSignal extends ArgosSignal {
  signal_type: SignalType;
  confidence_score: number;
  tier: "FREE" | "VIP" | "LOW" | "NOISE" | "NONE";
}

export interface SignalCalibrationProfile {
  probPercentiles: {
    free: number;  // ex: 0.60
    vip: number;   // ex: 0.50
  };
  evThreshold?: number; // ex: 0.02
}

const DEFAULT_CALIBRATION: SignalCalibrationProfile = {
  probPercentiles: {
    free: 0.70,
    vip: 0.50
  },
  evThreshold: 0.02
};

export class SignalClassifierV4 {
  /**
   * Classifica uma oportunidade de mercado usando Ranking em vez de Filtro.
   * Retorna TODOS os sinais para garantir volume e observabilidade.
   */
  static classify(
    signals: ArgosSignal[], 
    regime: RegimeProfile,
    calibration: SignalCalibrationProfile = DEFAULT_CALIBRATION
  ): ClassifiedSignal[] {
    if (!signals || signals.length === 0) return [];

    return signals.map(s => {
      let type = SignalType.NOISE;
      let tier: "FREE" | "VIP" | "LOW" | "NOISE" | "NONE" = "NOISE";
      
      const prob = s.probability ?? 0;
      const ev = s.expectedValue ?? 0;
      const conf = regime?.confidence ?? 0;

      const freeThreshold = calibration.probPercentiles.free;
      const vipThreshold = calibration.probPercentiles.vip;
      const evThreshold = calibration.evThreshold ?? 0.02;

      // ── LÓGICA DE RANKING (NÃO BLOQUEANTE) ──────────────────────────
      
      // 1. FREE (Assertividade Pura / Marketing)
      const isFree = prob >= freeThreshold;
      
      // 2. VIP (Valor e Edge)
      const isVip = prob >= vipThreshold && ev > evThreshold;

      // 3. LOW (Monitoramento)
      const isLow = ev > 0;

      if (isFree) {
        type = SignalType.VALIDATION;
        tier = "FREE";
      } else if (isVip) {
        type = SignalType.VALUE;
        tier = "VIP";
      } else if (isLow) {
        type = SignalType.LOW_PRIORITY;
        tier = "LOW";
      } else {
        type = SignalType.NOISE;
        tier = "NOISE";
      }

      return {
        ...s,
        signal_type: type,
        confidence_score: conf,
        tier: tier,
        status: (tier === "VIP" ? "OPTIMIZED" : tier === "FREE" ? "PREMIUM" : "HEDGED") as any
      };
    });
    // RETORNA TUDO: Sem filtros agressivos para garantir volume em produção.
  }

  /**
   * Prepara os dados para o Ledger do Supabase
   */
  static prepareLedger(
    matchId: string, 
    leagueId: string | undefined, 
    signals: ClassifiedSignal[], 
    regime: RegimeProfile
  ) {
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
