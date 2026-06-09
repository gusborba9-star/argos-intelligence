import { MarketVertical } from "@/lib/core/ArgosUnifiedEngine";
import { ArgosSignal } from "@/lib/core/contracts/SignalContract";
import { MarketRegime, RegimeProfile } from "@/lib/argos/regime/RegimeSchema";

// ============================================================
// SIGNAL CLASSIFIER v4.0
// ============================================================

export enum SignalType {
  VALUE = "VALUE",
  VALIDATION = "VALIDATION",
  NOISE = "NOISE"
}

export interface ClassifiedSignal extends ArgosSignal {
  signal_type: SignalType;
  confidence_score: number;
}

export class SignalClassifierV4 {
  static classify(signals: ArgosSignal[], regime: RegimeProfile): ClassifiedSignal[] {
    return signals.map(s => {
      let type = SignalType.NOISE;
      
      if (s.expectedValue > 0) {
        type = SignalType.VALUE;
      } else if (regime.confidence >= 0.75 && s.adjustedProbability >= 0.65) {
        type = SignalType.VALIDATION;
      }

      return {
        ...s,
        signal_type: type,
        confidence_score: regime.confidence,
        status: (type === SignalType.VALUE ? "OPTIMIZED" : "HEDGED") as "OPTIMIZED" | "HEDGED"
      };
    }).filter(s => s.signal_type !== SignalType.NOISE);
  }

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
