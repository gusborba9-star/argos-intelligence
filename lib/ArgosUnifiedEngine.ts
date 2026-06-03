import crypto from "crypto";

// ============================================================
// ARGOS UNIFIED ENGINE v3.2
// MULTI-MODEL CONSENSUS • LOGIT FUSION • SINGLE PASS
// Stateless • Lean • No cross-model veto
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
// MULTI-MODEL SPACE
// ============================================================
export enum ArgosModel {
  BASE = "BASE",
  CONSERVATIVE = "CONSERVATIVE",
  AGGRESSIVE = "AGGRESSIVE"
}

const MODEL_WEIGHTS: Record<ArgosModel, number> = {
  BASE: 0.5,
  CONSERVATIVE: 0.3,
  AGGRESSIVE: 0.2
};

// ============================================================
// TYPES
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

// internal multi-model signal
interface ModelSignal extends SignalCandidate {
  model: ArgosModel;
  delta: number;
}

// ============================================================
// LEAGUE DELTAS
// ============================================================
const LEAGUE_DELTAS: Record<string, { deltas: Partial<Record<MarketVertical, number>> }> = {
  DEFAULT: { deltas: {} }
};

// ============================================================
// ENGINE
// ============================================================
export class ArgosUnifiedEngine {
  private static readonly VERSION = "ARGOS_v3.2_CONSENSUS";

  public static analyze(input: MatchContextInput) {
    if (!input?.matchId) throw new Error("invalid matchId");

    const fingerprint = this.generateFingerprint(input);

    // SINGLE GATE ONLY
    const suspicion = input.extraField?.marketSuspicion ?? 0;
    if (suspicion > MARKET_SUSPICION_THRESHOLD) {
      return this.abort(input.matchId, fingerprint, "CRITICAL_SUSPICION");
    }

    const verticals = this.normalize(input);
    const globalConfidence = this.globalConfidence(input.extraField);

    const raw: SignalCandidate[] = [];

    // ========================================================
    // PHASE 1 — RAW GENERATION (NO FILTER / NO VETO)
    // ========================================================
    for (const [v, markets] of Object.entries(verticals) as [MarketVertical, MarketProbability[]][]) {
      for (const m of markets) {
        if (m.impliedOdds < MIN_ODDS || m.impliedOdds > MAX_ODDS) continue;

        const delta =
          (this.leagueDelta(input.leagueId, v, m.label) +
            this.contextDelta(input.extraField, v, m.label)) *
          globalConfidence;

        const adj = this.logitShift(m.probability, delta);
        const ev = adj * m.impliedOdds - 1;

        raw.push({
          vertical: v,
          market: m.label,
          impliedOdds: m.impliedOdds,
          probability: m.probability,
          adjustedProbability: adj,
          economicEV: ev,
          latentFactors: this.latent(m.label, v)
        });
      }
    }

    // ========================================================
    // PHASE 2 — MULTI-MODEL EXPANSION
    // ========================================================
    const expanded: ModelSignal[] = [];

    for (const s of raw) {
      expanded.push(
        ...this.expandModels(s)
      );
    }

    // ========================================================
    // PHASE 3 — CONSENSUS FUSION (NO DUPLICATION LOGIC)
    // ========================================================
    const fused = this.fuse(expanded);

    // ========================================================
    // PHASE 4 — SURVIVAL LAYER (SOFT RANKING ONLY)
    // ========================================================
    const survived = this.survival(fused);

    // ========================================================
    // PHASE 5 — PORTFOLIO
    // ========================================================
    const portfolio = this.portfolio(survived);

    return {
      match_id: input.matchId,
      engine_version: this.VERSION,
      fingerprint,
      signals_found: survived.length,
      approved_markets: portfolio,
      total_exposure: Number(portfolio.reduce((a, b) => a + b.unitSize, 0).toFixed(4)),
      analyzed_at: new Date().toISOString()
    };
  }

  // ==========================================================
  // MULTI-MODEL EXPANSION (NO RECOMPUTE OF BASE SIGNAL)
  // ==========================================================
  private static expandModels(s: SignalCandidate): ModelSignal[] {
    return [
      { ...s, model: ArgosModel.BASE, delta: 0 },
      { ...s, model: ArgosModel.CONSERVATIVE, delta: -0.015 },
      { ...s, model: ArgosModel.AGGRESSIVE, delta: 0.02 }
    ];
  }

  // ==========================================================
  // FUSION ENGINE (LOGIT CONSENSUS)
  // ==========================================================
  private static fuse(signals: ModelSignal[]): SignalCandidate[] {
    const grouped: Record<string, ModelSignal[]> = {};

    for (const s of signals) {
      const key = `${s.vertical}:${s.market}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(s);
    }

    const out: SignalCandidate[] = [];

    for (const key in grouped) {
      const list = grouped[key];

      let sum = 0;
      let wsum = 0;

      for (const s of list) {
        const w = MODEL_WEIGHTS[s.model];
        const p = Math.min(0.97, Math.max(0.03, s.probability + s.delta));

        sum += w * this.logit(p);
        wsum += w;
      }

      const finalLogit = sum / wsum;
      const finalProb = this.sigmoid(finalLogit);

      const base = list[0];

      const ev = finalProb * base.impliedOdds - 1;

      out.push({
        vertical: base.vertical,
        market: base.market,
        impliedOdds: base.impliedOdds,
        probability: base.probability,
        adjustedProbability: finalProb,
        economicEV: ev,
        latentFactors: base.latentFactors
      });
    }

    return out;
  }

  // ==========================================================
  // SURVIVAL (SOFT FILTER ONLY)
  // ==========================================================
  private static survival(signals: SignalCandidate[]) {
    const grouped: Record<string, SignalCandidate[]> = {};

    for (const s of signals) {
      if (!grouped[s.vertical]) grouped[s.vertical] = [];
      grouped[s.vertical].push(s);
    }

    const out: SignalCandidate[] = [];

    for (const k in grouped) {
      const sorted = grouped[k].sort((a, b) => b.economicEV - a.economicEV);
      const cutoff = Math.max(1, Math.floor(sorted.length * 0.6));
      out.push(...sorted.slice(0, cutoff));
    }

    return out;
  }

  // ==========================================================
  // PORTFOLIO (NO VETO, ONLY CONSTRAINTS)
  // ==========================================================
  private static portfolio(signals: SignalCandidate[]) {
    const sorted = [...signals].sort((a, b) => b.economicEV - a.economicEV);

    const selected: any[] = [];
    const count: Record<string, number> = {
      WINNER: 0, GOALS: 0, CARDS: 0, CORNERS: 0,
      SHOTS: 0, SHOTS_ON_TARGET: 0, FOULS: 0, BTTS: 0, TACKLES: 0
    };

    let exposure = 0;

    for (const s of sorted) {
      if (count[s.vertical] >= TOP_K_PER_VERTICAL) continue;

      const base = s.economicEV > 0.07 ? 1 : s.economicEV > 0.03 ? 0.5 : 0.25;

      const units = base * KELLY_FRACTION;

      if (exposure + units > MAX_CLUSTER_EXPOSURE) continue;

      selected.push({
        ...s,
        unitSize: Number(units.toFixed(4)),
        kelly: KELLY_FRACTION
      });

      count[s.vertical]++;
      exposure += units;
    }

    return selected;
  }

  // ==========================================================
  // MATH
  // ==========================================================
  private static logit(p: number) {
    return Math.log(p / (1 - p));
  }

  private static sigmoid(x: number) {
    return 1 / (1 + Math.exp(-x));
  }

  private static logitShift(p: number, d: number) {
    const lp = this.logit(Math.max(0.03, Math.min(0.97, p)));
    return this.sigmoid(lp + d);
  }

  // ==========================================================
  // INPUT NORMALIZATION
  // ==========================================================
  private static normalize(input: MatchContextInput) {
    return {
      WINNER: Object.values(input.winnerMatrix ?? {}),
      GOALS: Object.values(input.goalsMatrix ?? {}),
      CARDS: Object.values(input.cardsMatrix ?? {}),
      CORNERS: Object.values(input.cornersMatrix ?? {}),
      SHOTS: Object.values(input.shotsMatrix ?? {}),
      SHOTS_ON_TARGET: Object.values(input.shotsOnTargetMatrix ?? {}),
      FOULS: Object.values(input.foulsMatrix ?? {}),
      BTTS: Object.values(input.bttsMatrix ?? {}),
      TACKLES: Object.values(input.tacklesMatrix ?? {})
    } as any;
  }

  // ==========================================================
  // CONTEXT
  // ==========================================================
  private static globalConfidence(extra?: ExtraFieldContext) {
    if (!extra) return 1;
    let c = 1;
    if ((extra.weatherSeverity ?? 0) > 0.6) c *= 0.8;
    if ((extra.travelFatigue ?? 0) > 0.5) c *= 0.9;
    return c;
  }

  private static leagueDelta(_: any, __: any, ___: any) {
    return 0;
  }

  private static contextDelta(_: any, __: any, ___: any) {
    return 0;
  }

  private static latent(label: string, v: MarketVertical) {
    const u = label.toUpperCase();
    const under = u.includes("UNDER") || u.includes("MENOS");

    return {
      goal: v === MarketVertical.GOALS ? (under ? -1 : 1) : 0,
      tempo: v === MarketVertical.CORNERS ? (under ? -1 : 1) : 0,
      aggression: v === MarketVertical.CARDS ? (under ? -1 : 1) : 0,
      pressure: (v === MarketVertical.SHOTS || v === MarketVertical.SHOTS_ON_TARGET) ? (under ? -1 : 1) : 0,
      possession: (v === MarketVertical.FOULS || v === MarketVertical.TACKLES) ? (under ? -1 : 1) : 0
    };
  }

  private static generateFingerprint(input: MatchContextInput) {
    return crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
  }

  private static abort(matchId: string, fingerprint: string, reason: string) {
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
      }e: Number(units.toFixed(4)),
        kelly: kelly,
        latentFactors: s.latentFactors
      });

      verticalCount[s.vertical]++;
      exposure += units;
    }

    return selected;
  }

  // ==========================================================
  // CANONICALIZATION
  // ==========================================================
  private static canonicalVector(input?: Record<string, any>): MarketProbability[] {
    if (!input) return [];

    return Object.values(input).map((m: any) => ({
      label: String(m?.label ?? "UNKNOWN"),
      probability: Math.max(MIN_PROBABILITY, Math.min(MAX_PROBABILITY, m?.probability ?? 0.5)),
      impliedOdds: Math.max(MIN_ODDS, Math.min(MAX_ODDS, m?.impliedOdds ?? 2))
    }));
  }

  // ==========================================================
  // LATENT FACTORS
  // ==========================================================
  private static deriveLatentFactors(label: string, vertical: MarketVertical): LatentFactors {
    const n = label.toUpperCase();
    const under = n.includes("UNDER") || n.includes("MENOS");

    return {
      goal: vertical === MarketVertical.GOALS ? (under ? -1 : 1) : 0,
      tempo: vertical === MarketVertical.CORNERS ? (under ? -1 : 1) : 0,
      aggression: vertical === MarketVertical.CARDS ? (under ? -1 : 1) : 0,
      pressure: (vertical === MarketVertical.SHOTS || vertical === MarketVertical.SHOTS_ON_TARGET) ? (under ? -1 : 1) : 0,
      possession: (vertical === MarketVertical.FOULS || vertical === MarketVertical.TACKLES) ? (under ? -1 : 1) : 0
    };
  }

  // ==========================================================
  // FINGERPRINT
  // ==========================================================
  private static generateFingerprint(input: MatchContextInput): string {
    return crypto
      .createHash("sha256")
      .update(JSON.stringify(input))
      .digest("hex");
  }

  // ==========================================================
  // ABORT
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
         }HOTS]: 0,
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
  
