// ============================================================
// ODDS VALUE ENGINE v6.0.2 — QUANTITATIVE CHAIN INTEGRITY
// EV/Kelly are calculated from explicit model probabilities and executable prices.
// Market-derived fair/reference prices are metadata, never a replacement for p.
// ============================================================

export interface ValueAnalysis {
  expectedValue: number;
  edge: number;
  edgePercent: number;
  isPositive: boolean;
  kellyCriterion: number;
  fullKelly: number;
  /** Ratio marketOdd / fairOdd. > 1 means executable price is above reference price. */
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

  public static calculateValue(modelProbability: number, marketOdd: number, fairOdd?: number): ValueAnalysis {
    this.assertProbability(modelProbability, "model probability");
    this.assertMarketOdd(marketOdd);
    this.assertFairOdd(fairOdd);

    const ev = modelProbability * marketOdd - 1;
    const fullKelly = this.calculateFullKelly(modelProbability, marketOdd);
    const finalKelly = Math.min(this.MAX_EXPOSURE, fullKelly * this.FRACTIONAL_KELLY);
    const realValue = fairOdd !== undefined
      ? parseFloat((marketOdd / fairOdd).toFixed(4))
      : parseFloat((marketOdd * modelProbability).toFixed(4));

    return {
      expectedValue: parseFloat(ev.toFixed(4)),
      edge: parseFloat(ev.toFixed(4)),
      edgePercent: parseFloat((ev * 100).toFixed(2)),
      isPositive: ev > this.MIN_EV_THRESHOLD,
      kellyCriterion: parseFloat(finalKelly.toFixed(4)),
      fullKelly: parseFloat(fullKelly.toFixed(4)),
      realValue,
      ratingLabel: this.getRatingLabel(ev, modelProbability),
    };
  }

  /**
   * Asian handicap value calculation with explicit PUSH handling.
   * EV = P(win) * (odd - 1) - P(loss). PUSH contributes zero.
   */
  public static calculateAsianHandicapValue(
    winProbability: number,
    pushProbability: number,
    marketOdd: number,
    fairOdd?: number
  ): ValueAnalysis {
    this.assertProbability(winProbability, "handicap win probability");
    if (!Number.isFinite(pushProbability) || pushProbability < 0 || pushProbability >= 1) {
      throw new Error(`Invalid handicap push probability: ${pushProbability}`);
    }
    const lossProbability = 1 - winProbability - pushProbability;
    if (lossProbability < -1e-9) {
      throw new Error(`Invalid handicap settlement probabilities: win=${winProbability}, push=${pushProbability}`);
    }
    this.assertMarketOdd(marketOdd);
    this.assertFairOdd(fairOdd);

    const loss = Math.max(0, lossProbability);
    const ev = winProbability * (marketOdd - 1) - loss;
    const b = marketOdd - 1;
    const fullKelly = b > 0 ? Math.max(0, (winProbability * b - loss) / b) : 0;
    const finalKelly = Math.min(this.MAX_EXPOSURE, fullKelly * this.FRACTIONAL_KELLY);
    const realValue = fairOdd !== undefined
      ? parseFloat((marketOdd / fairOdd).toFixed(4))
      : parseFloat((marketOdd * winProbability).toFixed(4));

    return {
      expectedValue: parseFloat(ev.toFixed(4)),
      edge: parseFloat(ev.toFixed(4)),
      edgePercent: parseFloat((ev * 100).toFixed(2)),
      isPositive: ev > this.MIN_EV_THRESHOLD,
      kellyCriterion: parseFloat(finalKelly.toFixed(4)),
      fullKelly: parseFloat(fullKelly.toFixed(4)),
      realValue,
      ratingLabel: this.getRatingLabel(ev, winProbability),
      winProbability,
      pushProbability,
      lossProbability: loss,
    };
  }

  private static assertProbability(probability: number, label: string): void {
    if (!Number.isFinite(probability) || probability <= 0 || probability >= 1) {
      throw new Error(`Invalid ${label}: ${probability}`);
    }
  }

  private static assertMarketOdd(marketOdd: number): void {
    if (!Number.isFinite(marketOdd) || marketOdd <= 1) {
      throw new Error(`Invalid market odd: ${marketOdd}`);
    }
  }

  private static assertFairOdd(fairOdd?: number): void {
    if (fairOdd !== undefined && (!Number.isFinite(fairOdd) || fairOdd <= 1)) {
      throw new Error(`Invalid fair/reference odd: ${fairOdd}`);
    }
  }

  private static calculateFullKelly(probability: number, odd: number): number {
    const b = odd - 1;
    const q = 1 - probability;
    return Math.max(0, (probability * b - q) / b);
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
