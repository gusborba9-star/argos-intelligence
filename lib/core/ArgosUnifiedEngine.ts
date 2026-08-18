// ============================================================
// ARGOS UNIFIED ENGINE — LEGACY COMPATIBILITY PATH
// ============================================================
// The canonical production path is ArgosMasterOrchestrator.
// This module is retained only for compatibility with older callers.
// It must never manufacture probability or apply hidden confidence boosts.

export const MIN_PROB = 0.02;
export const MAX_PROB = 0.98;
export const MIN_ODDS = 1.01;
export const MAX_ODDS = 50.0;
export const BASE_EDGE = 0.002;
export const MAX_EXPOSURE = 10.0;
export const TOP_K = 12;

export enum MarketVertical {
  WINNER = "WINNER",
  GOALS = "GOALS",
  GOALS_HT = "GOALS_HT",
  CARDS = "CARDS",
  CORNERS = "CORNERS",
  SHOTS = "SHOTS",
  SHOTS_ON_TARGET = "SHOTS_ON_TARGET",
  FOULS = "FOULS",
  BTTS = "BTTS",
  TACKLES = "TACKLES",
  HANDICAP = "HANDICAP",
  SAVES = "SAVES",
  UNKNOWN = "UNKNOWN"
}

export enum ModelType {
  BASE = "BASE",
  DEFENSIVE = "DEFENSIVE",
  AGGRESSIVE = "AGGRESSIVE",
  MONTE_CARLO = "MONTE_CARLO"
}

export interface MatchContextInput {
  matchId: string;
  leagueId?: string;
  winnerMatrix: Record<string, any>;
  goalsMatrix: Record<string, any>;
  goalsHTMatrix?: Record<string, any>;
  cardsMatrix: Record<string, any>;
  cornersMatrix: Record<string, any>;
  shotsMatrix?: Record<string, any>;
  shotsOnTargetMatrix?: Record<string, any>;
  foulsMatrix?: Record<string, any>;
  bttsMatrix?: Record<string, any>;
  tacklesMatrix?: Record<string, any>;
  handicapMatrix?: Record<string, any>;
  savesMatrix?: Record<string, any>;
}

export interface Signal {
  vertical: MarketVertical;
  market: string;
  probability: number;
  adjustedProbability: number;
  impliedOdds: number;
  ev: number;
  status?: "OPTIMIZED" | "HEDGED" | "PREMIUM";
}

export class ArgosUnifiedEngine {
  private static readonly VERSION = "ARGOS_LEGACY_COMPAT";

  public static analyze(input: MatchContextInput) {
    if (!input?.matchId) throw new Error("invalid matchId");

    const raw = this.generate(this.normalize(input));
    const calibrated = this.calibrate(raw);
    const portfolio = this.portfolio(calibrated);

    return {
      match_id: input.matchId,
      engine_version: this.VERSION,
      signals_found: calibrated.length,
      approved_markets: portfolio,
      total_exposure: portfolio.reduce((a, b) => a + b.units, 0),
      analyzed_at: new Date().toISOString()
    };
  }

  private static generate(v: any): Signal[] {
    const out: Signal[] = [];
    for (const [vertical, markets] of Object.entries(v) as any) {
      if (!markets) continue;
      for (const m of markets as any) {
        const probability = this.clamp(Number(m.probability));
        const impliedOdds = Number(m.impliedOdds);
        if (!Number.isFinite(probability) || !Number.isFinite(impliedOdds) || impliedOdds <= 0) continue;
        if (probability < 0.10) continue;

        out.push({
          vertical: vertical as MarketVertical,
          market: m.label,
          probability,
          adjustedProbability: probability,
          impliedOdds,
          ev: probability * impliedOdds - 1
        });
      }
    }
    return out;
  }

  // Compatibility stage only. No hidden +2% confidence boost.
  private static fuse(signals: Signal[]): Signal[] {
    return signals;
  }

  private static calibrate(signals: Signal[]): Signal[] {
    return signals.filter((s) => Number.isFinite(s.impliedOdds) && s.impliedOdds > 0);
  }

  private static portfolio(signals: Signal[]) {
    const sorted = [...signals].sort((a, b) => b.ev - a.ev);
    const selected: any[] = [];
    const perVertical: Record<string, number> = {};
    let exposure = 0;

    for (const signal of sorted) {
      perVertical[signal.vertical] ||= 0;
      if (perVertical[signal.vertical] >= TOP_K) continue;

      const units = 0.25;
      if (exposure + units > MAX_EXPOSURE) continue;

      selected.push({ ...signal, units });
      perVertical[signal.vertical]++;
      exposure += units;
    }
    return selected;
  }

  private static normalize(input: MatchContextInput) {
    return {
      WINNER: Object.values(input.winnerMatrix ?? {}),
      GOALS: Object.values(input.goalsMatrix ?? {}),
      GOALS_HT: Object.values(input.goalsHTMatrix ?? {}),
      CARDS: Object.values(input.cardsMatrix ?? {}),
      CORNERS: Object.values(input.cornersMatrix ?? {}),
      SHOTS: Object.values(input.shotsMatrix ?? {}),
      SHOTS_ON_TARGET: Object.values(input.shotsOnTargetMatrix ?? {}),
      FOULS: Object.values(input.foulsMatrix ?? {}),
      BTTS: Object.values(input.bttsMatrix ?? {}),
      TACKLES: Object.values(input.tacklesMatrix ?? {}),
      HANDICAP: Object.values(input.handicapMatrix ?? {}),
      SAVES: Object.values(input.savesMatrix ?? {})
    };
  }

  private static clamp(p: number) {
    return Math.max(MIN_PROB, Math.min(MAX_PROB, p));
  }
}
