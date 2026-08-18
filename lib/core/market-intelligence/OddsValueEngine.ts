// ============================================================
// ODDS VALUE ENGINE v6.1.0 — CANONICAL QUANTITATIVE CHAIN
// Model probability is the sole source for model fair odds, EV and Kelly.
// Market fair/reference prices are metadata and never masquerade as model fair.
// ============================================================

import { buildCanonicalValueChain } from "../quant/QuantitativeIntegrity";

export interface ValueAnalysis {
  expectedValue: number;
  edge: number;
  edgePercent: number;
  isPositive: boolean;
  kellyCriterion: number;
  fullKelly: number;
  realValue: number;
  ratingLabel: "ELITE" | "VALUE" | "MARGINAL" | "NEGATIVE";
  winProbability?: number;
  pushProbability?: number;
  lossProbability?: number;
}

export class OddsValueEngine {
  private static readonly FRACTIONAL_KELLY = 0.25;
  private static readonly MAX_EXPOSURE = 0.05;
  private static readonly MIN_EV_THRESHOLD = 0.005;

  public static calculateValue(modelProbability: number, marketOdd: number, marketFairOdd?: number): ValueAnalysis {
    const chain = buildCanonicalValueChain(modelProbability, marketOdd, this.FRACTIONAL_KELLY);
    const ev = chain.expectedValue;
    const fullKelly = chain.fullKelly;
    const finalKelly = Math.min(this.MAX_EXPOSURE, chain.fractionalKelly);
    const realValue = marketFairOdd !== undefined
      ? marketOdd / marketFairOdd
      : marketOdd / chain.modelFairOdd;

    return {
      expectedValue: Number(ev.toFixed(4)),
      edge: Number(ev.toFixed(4)),
      edgePercent: Number((ev * 100).toFixed(2)),
      isPositive: ev > this.MIN_EV_THRESHOLD,
      kellyCriterion: Number(finalKelly.toFixed(4)),
      fullKelly: Number(fullKelly.toFixed(4)),
      realValue: Number(realValue.toFixed(4)),
      ratingLabel: this.getRatingLabel(ev, modelProbability),
    };
  }

  /** Asian handicap: PUSH contributes zero to EV and Kelly. */
  public static calculateAsianHandicapValue(
    winProbability: number,
    pushProbability: number,
    marketOdd: number,
    marketFairOdd?: number,
  ): ValueAnalysis {
    if (!Number.isFinite(winProbability) || winProbability <= 0 || winProbability >= 1) {
      throw new Error(`Invalid handicap win probability: ${winProbability}`);
    }
    if (!Number.isFinite(pushProbability) || pushProbability < 0 || pushProbability >= 1) {
      throw new Error(`Invalid handicap push probability: ${pushProbability}`);
    }
    const lossProbability = 1 - winProbability - pushProbability;
    if (lossProbability < -1e-9) throw new Error("Invalid handicap settlement probabilities");
    if (!Number.isFinite(marketOdd) || marketOdd <= 1) throw new Error(`Invalid market odd: ${marketOdd}`);

    const loss = Math.max(0, lossProbability);
    const b = marketOdd - 1;
    const ev = winProbability * b - loss;
    const fullKelly = b > 0 ? Math.max(0, ev / b) : 0;
    const finalKelly = Math.min(this.MAX_EXPOSURE, fullKelly * this.FRACTIONAL_KELLY);
    const modelFairOdd = 1 / winProbability;
    const realValue = marketFairOdd !== undefined ? marketOdd / marketFairOdd : marketOdd / modelFairOdd;

    return {
      expectedValue: Number(ev.toFixed(4)),
      edge: Number(ev.toFixed(4)),
      edgePercent: Number((ev * 100).toFixed(2)),
      isPositive: ev > this.MIN_EV_THRESHOLD,
      kellyCriterion: Number(finalKelly.toFixed(4)),
      fullKelly: Number(fullKelly.toFixed(4)),
      realValue: Number(realValue.toFixed(4)),
      ratingLabel: this.getRatingLabel(ev, winProbability),
      winProbability,
      pushProbability,
      lossProbability: loss,
    };
  }

  private static getRatingLabel(ev: number, prob: number): ValueAnalysis["ratingLabel"] {
    if (ev >= 0.10 && prob >= 0.55) return "ELITE";
    if (ev >= 0.05) return "VALUE";
    if (ev > 0) return "MARGINAL";
    return "NEGATIVE";
  }

  public static isValidSignal(analysis: ValueAnalysis): boolean {
    return analysis.isPositive && analysis.expectedValue > this.MIN_EV_THRESHOLD;
  }
}
