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
}

export class SignalClassifierV4 {
  /**
   * Classifica uma oportunidade de mercado usando a Tripla Classificação
   */
  static classify(signals: ArgosSignal[], regime: RegimeProfile): ClassifiedSignal[] {
    return signals.map(s => {
      let type = SignalType.NOISE;
      
      // 1. VALUE SIGNAL: EV Positivo
      if (s.expectedValue > 0) {
        type = SignalType.VALUE;
      } 
      // 2. VALIDATION SIGNAL: Alta probabilidade (ajustada ou base) mesmo com EV negativo
      else if (s.probability >= 0.70 || (s.adjustedProbability && s.adjustedProbability >= 0.65)) {
        type = SignalType.VALIDATION;
      }

      return {
        ...s,
        signal_type: type,
        confidence_score: regime.confidence,
        status: (type === SignalType.VALUE ? "OPTIMIZED" : "HEDGED") as any
      };
    }).filter(s => s.signal_type !== SignalType.NOISE); // Restaurado filtro para garantir apenas sinais de alta qualidade para despacho
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
