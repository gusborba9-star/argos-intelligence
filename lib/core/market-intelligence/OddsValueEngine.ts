// ============================================================
// ODDS VALUE ENGINE v6.0.1 — QUANTITATIVE CHAIN INTEGRITY
// EV/Kelly are calculated exclusively from model probability + executable price.
// Market-derived fair/reference prices are metadata, never a replacement for p.
// ============================================================

export interface ValueAnalysis {
  expectedValue: number;
  edge: number;
  edgePercent: number;
  isPositive: boolean;
  kellyCriterion: number;
  fullKelly: number;
  /** Ratio marketOdd / fairOdd. > 1 means executable price is above reference fair price. */
  realValue: number;
  ratingLabel: "ELITE" | "VALUE" | "MARGINAL" | "NEGATIVE";
}

export class OddsValueEngine {
  private static readonly FRACTIONAL_KELLY = 0.25;
  private static readonly MAX_EXPOSURE = 0.05;
  private static readonly MIN_EV_THRESHOLD = 0.005;

  public static calculateValue(
    modelProbability: number,
    marketOdd: number,
    fairOdd?: number
  ): ValueAnalysis {
    if (!Number.isFinite(modelProbability) || modelProbability <= 0 || modelProbability >= 1) {
      throw new Error(`Invalid model probability: ${modelProbability}`);
    }
    if (!Number.isFinite(marketOdd) || marketOdd <= 1) {
      throw new Error(`Invalid market odd: ${marketOdd}`);
    }
    if (fairOdd !== undefined && (!Number.isFinite(fairOdd) || fairOdd <= 1)) {
      throw new Error(`Invalid fair/reference odd: ${fairOdd}`);
    }

    const prob = modelProbability;
    const odd = marketOdd;

    // EV = p * decimalOdd - 1
    const ev = prob * odd - 1;
    const edgePercent = parseFloat((ev * 100).toFixed(2));

    // Kelly: f* = (p*b-q)/b
    const b = odd - 1;
    const q = 1 - prob;
    const fullKellyRaw = (prob * b - q) / b;
    const fullKelly = Math.max(0, fullKellyRaw);
    const fractionalKelly = fullKelly * this.FRACTIONAL_KELLY;
    const finalKelly = Math.min(this.MAX_EXPOSURE, fractionalKelly);

    // Reference-price value ratio. This is intentionally separate from EV.
    // If marketOdd > fairOdd, the executable price is above the reference price.
    const realValue = fairOdd !== undefined
      ? parseFloat((marketOdd / fairOdd).toFixed(4))
      : parseFloat((marketOdd * prob).toFixed(4));

    const ratingLabel = this.getRatingLabel(ev, prob);

    return {
      expectedValue: parseFloat(ev.toFixed(4)),
      edge: parseFloat(ev.toFixed(4)),
      edgePercent,
      isPositive: ev > this.MIN_EV_THRESHOLD,
      kellyCriterion: parseFloat(finalKelly.toFixed(4)),
      fullKelly: parseFloat(fullKelly.toFixed(4)),
      realValue,
      ratingLabel,
    };
  }

  private static getRatingLabel(
    ev: number,
    prob: number
  ): ValueAnalysis["ratingLabel"] {
    if (ev >= 0.10 && prob >= 0.55) return "ELITE";
    if (ev >= 0.05) return "VALUE";
    if (ev > 0) return "MARGINAL";
    return "NEGATIVE";
  }

  public static isValidSignal(analysis: ValueAnalysis): boolean {
    return analysis.isPositive && analysis.expectedValue > this.MIN_EV_THRESHOLD;
  }
}
