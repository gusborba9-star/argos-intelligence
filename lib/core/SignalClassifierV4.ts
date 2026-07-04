import { ArgosSignal } from "@/lib/core/contracts/SignalContract";
import { RegimeProfile } from "@/lib/argos/regime/RegimeSchema";

// ============================================================
// SIGNAL CLASSIFIER v4.3 — CALIBRATION READY (SYNDICATE)
// - Remove thresholds fixos rígidos
// - Introduz base estatística (percentis externos)
// - Mantém compatibilidade com pipeline atual
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

// ============================================================
// CALIBRATION INTERFACE (NOW DATA-DRIVEN)
// ============================================================

export interface SignalCalibrationProfile {
  probPercentiles: {
    free: number;  // ex: 0.65
    vip: number;   // ex: 0.80
  };
  evPercentile?: number; // opcional futuro
}

// fallback seguro (evita breaking change)
const DEFAULT_CALIBRATION: SignalCalibrationProfile = {
  probPercentiles: {
    free: 0.60,
    vip: 0.75
  }
};

export class SignalClassifierV4 {

  /**
   * Classifica sinais com base em calibração estatística externa.
   * NÃO usa thresholds fixos rígidos.
   */
  static classify(
    signals: ArgosSignal[],
    regime: RegimeProfile,
    calibration: SignalCalibrationProfile = DEFAULT_CALIBRATION
  ): ClassifiedSignal[] {

    if (!signals || signals.length === 0) return [];

    return signals
      .map(s => {
        const prob = s.probability ?? 0;
        const ev = s.expectedValue ?? 0;
        const conf = regime?.confidence ?? 0;

        let type: SignalType = SignalType.NOISE;
        let tier: "FREE" | "VIP" | "NONE" = "NONE";

        // ============================================================
        // CALIBRATED LOGIC (DATA-DRIVEN)
        // ============================================================

        const freeThreshold = calibration.probPercentiles.free;
        const vipThreshold = calibration.probPercentiles.vip;

        // VIP SIGNAL (high confidence + edge presence)
        if (prob >= vipThreshold && ev > 0) {
          type = SignalType.VALUE;
          tier = "VIP";
        }

        // FREE SIGNAL (mid confidence baseline)
        else if (prob >= freeThreshold) {
          type = SignalType.VALIDATION;
          tier = "FREE";
        }

        // NOISE remains NONE
        else {
          type = SignalType.NOISE;
          tier = "NONE";
        }

        return {
          ...s,
          signal_type: type,
          confidence_score: conf,
          tier,
          status: (tier === "VIP"
            ? "OPTIMIZED"
            : tier === "FREE"
              ? "PREMIUM"
              : "HEDGED") as any
        };
      })
      // ⚠️ filtro continua, mas agora controlado por calibração
      .filter(s => s.tier !== "NONE");
  }

  /**
   * Prepara dados para ledger (Supabase)
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
