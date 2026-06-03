import crypto from "crypto";

// ============================================================
// ARGOS v4.0 — QUANTITATIVE CORE ENGINE
// Ensemble Adaptive • Drift-aware • Calibrated Logit System
// ============================================================

// ============================================================
// PARAMETERS
// ============================================================
export const MIN_PROB = 0.03;
export const MAX_PROB = 0.97;

export const MIN_ODDS = 1.05;
export const MAX_ODDS = 12.0;

export const BASE_EDGE = 0.004;
export const MAX_EXPOSURE = 2.5;
export const TOP_K = 4;

const DRIFT_ALPHA = 0.08;
const WEIGHT_LEARNING_RATE = 0.06;

// ============================================================
// MARKET STRUCTURE
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
// MODELS (REAL ENSEMBLE)
// ============================================================
export enum ModelType {
  BASE = "BASE",
  DEFENSIVE = "DEFENSIVE",
  AGGRESSIVE = "AGGRESSIVE"
}

let MODEL_WEIGHTS: Record<ModelType, number> = {
  BASE: 0.55,
  DEFENSIVE: 0.25,
  AGGRESSIVE: 0.20
};

// ============================================================
// TYPES
// ============================================================
export interface MarketProbability {
  label: string;
  probability: number;
  impliedOdds: number;
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
}

export interface Signal {
  vertical: MarketVertical;
  market: string;
  probability: number;
  adjustedProbability: number;
  impliedOdds: number;
  ev: number;
}

// internal model signal
interface ModelSignal extends Signal {
  model: ModelType;
  delta: number;
}

// ============================================================
// DRIFT STATE (EMA, stable memory)
// ============================================================
let driftEMA = 0;

// ============================================================
// ENGINE
// ============================================================
export class ArgosUnifiedEngine {
  private static readonly VERSION = "ARGOS_v4.0_QUANT_CORE";

  public static analyze(input: MatchContextInput) {
    if (!input?.matchId) throw new Error("invalid matchId");

    const fingerprint = this.fingerprint(input);

    const verticals = this.normalize(input);

    const raw = this.generate(verticals);
    const expanded = this.expand(raw);
    const fused = this.fuse(expanded);

    const calibrated = this.calibrate(fused);
    const tuned = this.tuneWeights(calibrated);

    const portfolio = this.portfolio(tuned);

    return {
      match_id: input.matchId,
      engine_version: this.VERSION,
      fingerprint,
      signals_found: tuned.length,
      approved_markets: portfolio,
      total_exposure: portfolio.reduce((a, b) => a + b.units, 0),
      drift: driftEMA,
      model_weights: MODEL_WEIGHTS,
      analyzed_at: new Date().toISOString()
    };
  }

  // ==========================================================
  // SIGNAL GENERATION
  // ==========================================================
  private static generate(v: any): Signal[] {
    const out: Signal[] = [];

    for (const [vertical, markets] of Object.entries(v) as any) {
      for (const m of markets) {
        if (m.impliedOdds < MIN_ODDS || m.impliedOdds > MAX_ODDS) continue;

        const p = this.clamp(m.probability);
        const ev = p * m.impliedOdds - 1;

        if (ev < BASE_EDGE) continue;

        out.push({
          vertical,
          market: m.label,
          probability: m.probability,
          adjustedProbability: p,
          impliedOdds: m.impliedOdds,
          ev
        });
      }
    }

    return out;
  }

  // ==========================================================
  // MULTI MODEL EXPANSION (NO RECOMPUTE)
  // ==========================================================
  private static expand(signals: Signal[]): ModelSignal[] {
    const out: ModelSignal[] = [];

    for (const s of signals) {
      out.push(
        { ...s, model: ModelType.BASE, delta: 0 },
        { ...s, model: ModelType.DEFENSIVE, delta: -0.01 },
        { ...s, model: ModelType.AGGRESSIVE, delta: 0.015 }
      );
    }

    return out;
  }

  // ==========================================================
  // FUSION (LOGIT CONSENSUS)
  // ==========================================================
  private static fuse(signals: ModelSignal[]): Signal[] {
    const grouped: Record<string, ModelSignal[]> = {};

    for (const s of signals) {
      const k = `${s.vertical}:${s.market}`;
      (grouped[k] ||= []).push(s);
    }

    const out: Signal[] = [];

    for (const k in grouped) {
      const list = grouped[k];

      let sum = 0;
      let wsum = 0;

      for (const s of list) {
        const w = MODEL_WEIGHTS[s.model];
        const p = this.sigmoid(this.logit(this.clamp(s.probability + s.delta)));

        sum += w * this.logit(p);
        wsum += w;
      }

      const finalP = this.sigmoid(sum / wsum);
      const base = list[0];

      out.push({
        vertical: base.vertical,
        market: base.market,
        probability: base.probability,
        adjustedProbability: finalP,
        impliedOdds: base.impliedOdds,
        ev: finalP * base.impliedOdds - 1
      });
    }

    return out;
  }

  // ==========================================================
  // CALIBRATION (ONLINE DRIFT CONTROL)
  // ==========================================================
  private static calibrate(signals: Signal[]): Signal[] {
    let errorSum = 0;

    for (const s of signals) {
      const proxy = s.ev > 0 ? 1 : 0;
      const error = Math.abs(s.adjustedProbability - proxy);
      errorSum += error;
    }

    const avgError = errorSum / Math.max(1, signals.length);

    driftEMA = DRIFT_ALPHA * avgError + (1 - DRIFT_ALPHA) * driftEMA;

    return signals;
  }

  // ==========================================================
  // WEIGHT ADAPTATION
  // ==========================================================
  private static tuneWeights(signals: Signal[]): Signal[] {
    const driftPenalty = 1 + driftEMA;

    MODEL_WEIGHTS.BASE *= (1 - WEIGHT_LEARNING_RATE * driftPenalty);
    MODEL_WEIGHTS.DEFENSIVE *= (1 + WEIGHT_LEARNING_RATE * (1 - driftPenalty));
    MODEL_WEIGHTS.AGGRESSIVE *= (1 + WEIGHT_LEARNING_RATE * (0.5 - driftEMA));

    const sum =
      MODEL_WEIGHTS.BASE +
      MODEL_WEIGHTS.DEFENSIVE +
      MODEL_WEIGHTS.AGGRESSIVE;

    MODEL_WEIGHTS.BASE /= sum;
    MODEL_WEIGHTS.DEFENSIVE /= sum;
    MODEL_WEIGHTS.AGGRESSIVE /= sum;

    return signals;
  }

  // ==========================================================
  // PORTFOLIO (CONSTRAINED SELECTION)
  // ==========================================================
  private static portfolio(signals: Signal[]) {
    const sorted = [...signals].sort((a, b) => b.ev - a.ev);

    const selected: any[] = [];
    const perVertical: Record<string, number> = {};
    let exposure = 0;

    for (const s of sorted) {
      perVertical[s.vertical] ||= 0;

      if (perVertical[s.vertical] >= TOP_K) continue;

      const base = s.ev > 0.07 ? 1 : s.ev > 0.03 ? 0.5 : 0.25;
      const units = base * 0.12;

      if (exposure + units > MAX_EXPOSURE) continue;

      selected.push({
        ...s,
        units: Number(units.toFixed(4))
      });

      perVertical[s.vertical]++;
      exposure += units;
    }

    return selected;
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
    };
  }

  // ==========================================================
  // MATH CORE
  // ==========================================================
  private static logit(p: number) {
    return Math.log(p / (1 - p));
  }

  private static sigmoid(x: number) {
    return 1 / (1 + Math.exp(-x));
  }

  private static clamp(p: number) {
    return Math.max(MIN_PROB, Math.min(MAX_PROB, p));
  }

  // ==========================================================
  // FINGERPRINT
  // ==========================================================
  private static fingerprint(input: MatchContextInput) {
    return crypto.createHash("sha256").update(JSON.stringify(input)).digest("hex");
  }
    }
