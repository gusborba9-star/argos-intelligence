import crypto from "crypto";

// ============================================================
// ARGOS UNIFIED ENGINE
// ROADMAP v3.1 FULLY ALIGNED
// Stateless • Logit Space • Single Gate • Lean Architecture
// ============================================================

// ============================================================
// GLOBAL PARAMETERS
// ============================================================
export const BASE_MIN_EDGE = 0.005;
export const MAX_CLUSTER_EXPOSURE = 2.50;
export const TOP_K_PER_VERTICAL = 4;

export const KELLY_FRACTION = 0.12;
export const MAX_EFFECTIVE_KELLY_POSITION = 0.05;
export const MIN_KELLY_POSITION = 0.005;

export const MIN_PROBABILITY = 0.03;
export const MAX_PROBABILITY = 0.97;

export const MIN_ODDS = 1.05;
export const MAX_ODDS = 12.0;

export const MARKET_SUSPICION_THRESHOLD = 0.85;
export const CORRELATION_THRESHOLD = 0.45;


// ============================================================
// MARKET VERTICALS
// ============================================================
export enum MarketVertical {
  WINNER = "WINNER",
  GOALS = "GOALS",
  CARDS = "CARDS",
  CORNERS = "CORNERS",
  SHOTS = "SHOTS",
  SHOTS_ON_TARGET = "SHOTS_ON_TARGET",
  FOULS = "FOULS",
  BTTS = "BTTS",
  TACKLES = "TACKLES"
}

// ============================================================
// CORE TYPES
// ============================================================
export interface MarketProbability {
  label: string;
  probability: number;
  impliedOdds: number;
}

export interface ExtraFieldContext {
  isDecisiveMatch?: boolean;
  isClassico?: boolean;
  isDerby?: boolean;
  isNeutralVenue?: boolean;
  travelFatigue?: number;
  altitudeFactor?: number;
  weatherSeverity?: number;
  marketSuspicion?: number;
}

export interface MatchContextInput {
  matchId: string;
  leagueId?: string;
  winnerMatrix: Record<string, any>;
  goalsMatrix: Record<string, any>;
  cardsMatrix: Record<string, any>;
  cornersMatrix: Record<string, any>;
  shotsMatrix?: Record<string, any>;
  shotsOnTargetMatrix?: Record<string, any>;
  foulsMatrix?: Record<string, any>;
  bttsMatrix?: Record<string, any>;
  tacklesMatrix?: Record<string, any>;
  extraField?: ExtraFieldContext;
}

export interface LatentFactors {
  goal: number;
  tempo: number;
  aggression: number;
  pressure: number;
  possession: number;
}

export interface SignalCandidate {
  vertical: MarketVertical;
  market: string;
  impliedOdds: number;
  probability: number;
  adjustedProbability: number;
  economicEV: number;
  latentFactors: LatentFactors;
}

export interface PortfolioMarket {
  vertical: MarketVertical;
  market: string;
  impliedOdds: number;
  adjustedProbability: number;
  economicEV: number;
  unitSize: number;
  kelly: number;
  latentFactors: LatentFactors;
}

export interface LeagueDeltaProfile {
  deltas: Partial<Record<MarketVertical, number>>;
}

// ============================================================
// LEAGUE DELTA REGISTRY
// ============================================================
const LEAGUE_DELTAS: Record<string, LeagueDeltaProfile> = {
  BRASILEIRAO: {
    deltas: {
      [MarketVertical.GOALS]: -0.018
    }
  },
  LIBERTADORES: {
    deltas: {
      [MarketVertical.CARDS]: 0.025
    }
  },
  DEFAULT: {
    deltas: {}
  }
};

// ============================================================
// ENGINE
// ============================================================
export class ArgosUnifiedEngine {
  private static readonly VERSION = "ARGOS_UNIFIED_v3.1";

  public static analyze(input: MatchContextInput) {
    if (!input?.matchId) {
      throw new Error("ArgosUnifiedEngine: invalid matchId");
    }

    // ========================================================
    // ROADMAP 1.6 - FINGERPRINT
    // ========================================================
    const fingerprint = this.generateFingerprint(input);

    // ========================================================
    // ROADMAP 2.2 - SINGLE GATE CIRCUIT BREAKER
    // ========================================================
    const suspicion = input.extraField?.marketSuspicion ?? 0;
    if (suspicion > MARKET_SUSPICION_THRESHOLD) {
      return this.generateAbortedResponse(
        input.matchId,
        fingerprint,
        "CRITICAL_MARKET_SUSPICION"
      );
    }

    // ========================================================
    // INPUT NORMALIZATION
    // ========================================================
    const verticals: Record<MarketVertical, MarketProbability[]> = {
      [MarketVertical.WINNER]: this.canonicalVector(input.winnerMatrix),
      [MarketVertical.GOALS]: this.canonicalVector(input.goalsMatrix),
      [MarketVertical.CARDS]: this.canonicalVector(input.cardsMatrix),
      [MarketVertical.CORNERS]: this.canonicalVector(input.cornersMatrix),
      [MarketVertical.SHOTS]: this.canonicalVector(input.shotsMatrix),
      [MarketVertical.SHOTS_ON_TARGET]: this.canonicalVector(input.shotsOnTargetMatrix),
      [MarketVertical.FOULS]: this.canonicalVector(input.foulsMatrix),
      [MarketVertical.BTTS]: this.canonicalVector(input.bttsMatrix),
      [MarketVertical.TACKLES]: this.canonicalVector(input.tacklesMatrix)
    };

    const globalConfidence = this.calculateGlobalConfidence(input.extraField);
    const approvedSignals: SignalCandidate[] = [];

    // ========================================================
    // ROADMAP 2.3 - CONTINUOUS LOGIT SCORING
    // ========================================================
    for (const [vertical, markets] of Object.entries(verticals) as [MarketVertical, MarketProbability[]][]) {
      for (const market of markets) {
        if (market.impliedOdds < MIN_ODDS || market.impliedOdds > MAX_ODDS) {
          continue;
        }

        const leagueDelta = this.getLeagueDelta(input.leagueId, vertical, market.label);
        const contextDelta = this.getContextDelta(input.extraField, vertical, market.label);

        const totalDelta = (leagueDelta + contextDelta) * globalConfidence;
        const adjustedProbability = this.applyLogitDelta(market.probability, totalDelta);
        const economicEV = (adjustedProbability * market.impliedOdds) - 1;

        if (economicEV < BASE_MIN_EDGE) {
          continue;
        }

        approvedSignals.push({
          vertical,
          market: market.label,
          impliedOdds: market.impliedOdds,
          probability: market.probability,
          adjustedProbability,
          economicEV,
          latentFactors: this.deriveLatentFactors(market.label, vertical)
        });
      }
    }

    const portfolio = this.buildPortfolio(approvedSignals);

    return {
      match_id: input.matchId,
      engine_version: this.VERSION,
      fingerprint,
      signals_found: approvedSignals.length,
      approved_markets: portfolio,
      total_exposure: Number(
        portfolio.reduce((acc, item) => acc + item.unitSize, 0).toFixed(4)
      ),
      analyzed_at: new Date().toISOString()
    };
  }

  // ==========================================================
  // ROADMAP 2.4 - GLOBAL CONFIDENCE
  // ==========================================================
  private static calculateGlobalConfidence(extra?: ExtraFieldContext): number {
    if (!extra) return 1;

    let confidence = 1;
    if ((extra.weatherSeverity ?? 0) > 0.60) {
      confidence *= 0.80;
    }
    if ((extra.travelFatigue ?? 0) > 0.50) {
      confidence *= 0.90;
    }
    return confidence;
  }

  // ==========================================================
  // ROADMAP 2.5 - LEAGUE DELTAS
  // ==========================================================
  private static getLeagueDelta(
    leagueId: string | undefined,
    vertical: MarketVertical,
    label: string
  ): number {
    const leagueKey = (leagueId ?? "DEFAULT").toUpperCase();
    const profile = LEAGUE_DELTAS[leagueKey] ?? LEAGUE_DELTAS.DEFAULT;
    const baseDelta = profile.deltas[vertical];

    if (baseDelta === undefined) {
      return 0;
    }

    const normalizedLabel = label.toUpperCase();
    const isOver = normalizedLabel.includes("OVER") || normalizedLabel.includes("MAIS");

    return isOver ? baseDelta : -baseDelta;
  }

  // ==========================================================
  // ROADMAP 2.4 - CONTEXT DELTAS
  // ==========================================================
  private static getContextDelta(
    extra: ExtraFieldContext | undefined,
    vertical: MarketVertical,
    label: string
  ): number {
    if (!extra) return 0;

    const normalizedLabel = label.toUpperCase();
    const isOver = normalizedLabel.includes("OVER") || normalizedLabel.includes("MAIS");

    let delta = 0;

    if ((extra.isClassico || extra.isDerby) && vertical === MarketVertical.CARDS) {
      delta += isOver ? 0.030 : -0.030;
    }

    if ((extra.altitudeFactor ?? 0) > 0.70 && vertical === MarketVertical.GOALS) {
      delta += isOver ? -0.022 : 0.022;
    }

    return delta;
  }

  // ==========================================================
  // ROADMAP 2.3 - APPLY LOGIT DELTA
  // ==========================================================
  private static applyLogitDelta(probability: number, delta: number): number {
    const p = Math.max(MIN_PROBABILITY, Math.min(MAX_PROBABILITY, probability));
    const logit = Math.log(p / (1 - p));
    const shiftedLogit = logit + delta;
    const adjusted = 1 / (1 + Math.exp(-shiftedLogit));

    return Math.max(MIN_PROBABILITY, Math.min(MAX_PROBABILITY, adjusted));
  }

  // ==========================================================
  // ROADMAP 2.7 + 2.8 - PORTFOLIO ENGINE
  // ==========================================================
  private static buildPortfolio(signals: SignalCandidate[]): PortfolioMarket[] {
    const sortedSignals = [...signals].sort((a, b) => b.economicEV - a.economicEV);
    const selected: PortfolioMarket[] = [];

    const verticalCount: Record<MarketVertical, number> = {
      [MarketVertical.WINNER]: 0,
      [MarketVertical.GOALS]: 0,
      [MarketVertical.CARDS]: 0,
      [MarketVertical.CORNERS]: 0,
      [MarketVertical.SHOTS]: 0,
      [MarketVertical.SHOTS_ON_TARGET]: 0,
      [MarketVertical.FOULS]: 0,
      [MarketVertical.BTTS]: 0,
      [MarketVertical.TACKLES]: 0
    };

    let totalExposure = 0;

    for (const signal of sortedSignals) {
      if (verticalCount[signal.vertical] >= TOP_K_PER_VERTICAL) {
        continue;
      }

      // CORRELATION CONTROL (ROADMAP 2.7)
      let correlated = false;
      for (const existing of selected) {
        const dotProduct =
          (signal.latentFactors.goal * existing.latentFactors.goal) +
          (signal.latentFactors.tempo * existing.latentFactors.tempo) +
          (signal.latentFactors.aggression * existing.latentFactors.aggression) +
          (signal.latentFactors.pressure * existing.latentFactors.pressure) +
          (signal.latentFactors.possession * existing.latentFactors.possession);

        if (dotProduct > CORRELATION_THRESHOLD) {
          correlated = true;
          break;
        }
      }

      if (correlated) {
        continue;
      }

      // FRACTIONAL KELLY (ROADMAP 2.8)
      const b = signal.impliedOdds - 1;
      const rawKelly = ((signal.adjustedProbability * b) - (1 - signal.adjustedProbability)) / b;
      const scaledKelly = rawKelly * KELLY_FRACTION;
      const finalKelly = Math.max(
        MIN_KELLY_POSITION,
        Math.min(scaledKelly, MAX_EFFECTIVE_KELLY_POSITION)
      );

      // POSITION SIZING
      let baseUnits = 0.25;
      if (signal.economicEV >= 0.07) {
        baseUnits = 1.0;
      } else if (signal.economicEV >= 0.03) {
        baseUnits = 0.50;
      }

      const adjustedUnits = baseUnits * (finalKelly / MAX_EFFECTIVE_KELLY_POSITION);

      if (totalExposure + adjustedUnits > MAX_CLUSTER_EXPOSURE) {
        continue;
      }

      selected.push({
        vertical: signal.vertical,
        market: signal.market,
        impliedOdds: signal.impliedOdds,
        adjustedProbability: Number(signal.adjustedProbability.toFixed(4)),
        economicEV: Number(signal.economicEV.toFixed(4)),
        unitSize: Number(adjustedUnits.toFixed(4)),
        kelly: Number(finalKelly.toFixed(4)),
        latentFactors: signal.latentFactors
      });

      verticalCount[signal.vertical]++;
      totalExposure += adjustedUnits;
    }

    return selected;
  }

  // ==========================================================
  // INPUT CANONICALIZATION (ROADMAP 2.6)
  // ==========================================================
  private static canonicalVector(input?: Record<string, any>): MarketProbability[] {
    if (!input) {
      return [];
    }

    return Object.values(input).map((market: any) => ({
      label: String(market?.label ?? "UNKNOWN"),
      probability: Math.max(
        MIN_PROBABILITY,
        Math.min(MAX_PROBABILITY, market?.probability ?? 0.50)
      ),
      impliedOdds: Math.max(MIN_ODDS, market?.impliedOdds ?? 2.0)
    }));
  }

  // ==========================================================
  // LATENT FACTOR ENGINE (ROADMAP 2.7)
  // ==========================================================
  private static deriveLatentFactors(label: string, vertical: MarketVertical): LatentFactors {
    const normalized = label.toUpperCase();
    const isUnder =
      normalized.includes("UNDER") ||
      normalized.includes("MENOS") ||
      normalized.includes("BTTS_NO");

    return {
      goal: vertical === MarketVertical.GOALS ? (isUnder ? -1 : 1) : 0,
      tempo: vertical === MarketVertical.CORNERS ? (isUnder ? -1 : 1) : 0,
      aggression: vertical === MarketVertical.CARDS ? (isUnder ? -1 : 1) : 0,
      pressure: (vertical === MarketVertical.SHOTS || vertical === MarketVertical.SHOTS_ON_TARGET) ? (isUnder ? -1 : 1) : 0,
      possession: (vertical === MarketVertical.FOULS || vertical === MarketVertical.TACKLES) ? (isUnder ? -1 : 1) : 0
    };
  }

  // ==========================================================
  // FINGERPRINT GENERATOR (ROADMAP 1.6)
  // ==========================================================
  private static generateFingerprint(input: MatchContextInput): string {
    const payload = JSON.stringify({
      matchId: input.matchId,
      leagueId: input.leagueId,
      winnerMatrix: input.winnerMatrix,
      goalsMatrix: input.goalsMatrix,
      cardsMatrix: input.cardsMatrix,
      cornersMatrix: input.cornersMatrix,
      shotsMatrix: input.shotsMatrix,
      shotsOnTargetMatrix: input.shotsOnTargetMatrix,
      foulsMatrix: input.foulsMatrix,
      bttsMatrix: input.bttsMatrix,
      tacklesMatrix: input.tacklesMatrix,
      extraField: input.extraField
    });

    return crypto.createHash("sha256").update(payload).digest("hex");
  }

  // ==========================================================
  // ABORTED RESPONSE (ROADMAP 2.2)
  // ==========================================================
  private static generateAbortedResponse(matchId: string, fingerprint: string, reason: string) {
    return {
      match_id: matchId,
      engine_version: this.VERSION,
      fingerprint,
      approved_markets: [],
      signals_found: 0,
      total_exposure: 0,
      vetoed: true,
      veto_reason: reason,
      analyzed_at: new Date().toISOString()
    };
  }
  }
  
