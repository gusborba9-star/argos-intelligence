import { RegimeProfile } from "@/lib/argos/regime/RegimeSchema";

export interface HandicapSettlementProbability {
  win: number;
  push: number;
  loss: number;
}

/**
 * Asian handicap settlement model.
 * Signed points remain distinct; integer lines expose PUSH explicitly.
 * Half-goal lines naturally have push = 0.
 */
export class AsianHandicapSettlementEngine {
  private static readonly DEFAULT_ITERATIONS = 10000;

  static simulate(
    homeMean: number,
    awayMean: number,
    regime: RegimeProfile,
    points: number[],
    iterations: number = this.DEFAULT_ITERATIONS
  ): Record<string, HandicapSettlementProbability> {
    if (!Number.isInteger(iterations) || iterations < 1000) {
      throw new Error(`Handicap simulation requires at least 1000 iterations; received ${iterations}`);
    }

    const result: Record<string, HandicapSettlementProbability> = {};
    const uniquePoints = [...new Set(points.filter(Number.isFinite))];
    const variance = Number.isFinite(regime.variance_multiplier) && regime.variance_multiplier > 1 ? regime.variance_multiplier : 1;
    const bias = Number.isFinite(regime.model_bias) ? regime.model_bias : 0;
    const homeLambda = Math.max(0.01, homeMean * (1 + bias));
    const awayLambda = Math.max(0.01, awayMean * (1 - bias));

    for (const point of uniquePoints) {
      for (const side of ["home", "away"] as const) {
        // Integer and half-goal lines are represented exactly by the score
        // matrix. Quarter lines are not silently converted into binary wins:
        // they remain unpublished until quarter-line settlement is supported.
        if (Math.abs(point * 2 - Math.round(point * 2)) > 1e-9) {
          result[`${side}_${point}`] = { win: 0, push: 0, loss: 1 };
          continue;
        }

        let win = 0;
        let push = 0;
        let total = 0;
        const maxGoals = 14;
        for (let homeGoals = 0; homeGoals <= maxGoals; homeGoals++) {
          const homeProbability = this.overdispersedPoissonProbability(homeLambda, homeGoals, variance);
          for (let awayGoals = 0; awayGoals <= maxGoals; awayGoals++) {
            const probability = homeProbability * this.overdispersedPoissonProbability(awayLambda, awayGoals, variance);
            total += probability;
            const adjusted = (side === "home" ? homeGoals - awayGoals : awayGoals - homeGoals) + point;
            if (adjusted > 0) win += probability;
            else if (adjusted === 0) push += probability;
          }
        }

        const normalization = total > 0 ? 1 / total : 1;
        const winProbability = win * normalization;
        const pushProbability = push * normalization;
        result[`${side}_${point}`] = {
          win: winProbability,
          push: pushProbability,
          loss: Math.max(0, 1 - winProbability - pushProbability),
        };
      }
    }

    return result;
  }

  /**
   * Score probability under the same Gamma-Poisson mixture used by the
   * quantitative core. Gamma mixing yields a Negative-Binomial marginal.
   */
  private static overdispersedPoissonProbability(mean: number, goals: number, varianceMultiplier: number): number {
    if (varianceMultiplier <= 1.0000001) return this.poissonProbability(mean, goals);
    const overdispersion = varianceMultiplier - 1;
    const shape = 1 / overdispersion;
    const probability = this.logNegativeBinomialPmf(shape, mean / shape, goals);
    return Math.exp(probability);
  }

  private static poissonProbability(lambda: number, k: number): number {
    let p = Math.exp(-lambda);
    for (let i = 1; i <= k; i++) p *= lambda / i;
    return p;
  }

  private static logNegativeBinomialPmf(shape: number, scale: number, k: number): number {
    const p = 1 / (1 + scale);
    return this.logGamma(k + shape) - this.logGamma(shape) - this.logGamma(k + 1) + shape * Math.log(p) + k * Math.log(1 - p);
  }

  private static logGamma(z: number): number {
    const coefficients = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - this.logGamma(1 - z);
    let x = 0.99999999999980993;
    const t0 = z - 1;
    for (let i = 0; i < coefficients.length; i++) x += coefficients[i] / (t0 + i + 1);
    const t = t0 + coefficients.length - 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (t0 + 0.5) * Math.log(t) - t + Math.log(x);
  }
}
