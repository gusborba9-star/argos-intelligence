import { RegimeProfile } from "@/lib/argos/regime/RegimeSchema";
import { HandicapSettlementProbability, combineQuarterSettlement, normalizeSettlement, splitAsianQuarterLine } from "../quant/HandicapSettlement";

/**
 * Canonical handicap settlement distribution. Integer lines can push; quarter
 * lines expose half-win/half-loss instead of falsely collapsing to LOSS.
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
    if (!Number.isInteger(iterations) || iterations < 1000) throw new Error(`Handicap simulation requires at least 1000 iterations; received ${iterations}`);
    if (!Number.isFinite(homeMean) || homeMean < 0 || !Number.isFinite(awayMean) || awayMean < 0) throw new Error("Invalid goal means");

    const result: Record<string, HandicapSettlementProbability> = {};
    const uniquePoints = [...new Set(points.filter(Number.isFinite))];
    const variance = Number.isFinite(regime.variance_multiplier) && regime.variance_multiplier > 1 ? regime.variance_multiplier : 1;
    const bias = Number.isFinite(regime.model_bias) ? regime.model_bias : 0;
    const homeLambda = Math.max(0.01, homeMean * (1 + bias));
    const awayLambda = Math.max(0.01, awayMean * (1 - bias));

    for (const point of uniquePoints) {
      for (const side of ["home", "away"] as const) {
        const quarter = splitAsianQuarterLine(point);
        if (quarter) {
          const [lower, upper] = quarter;
          const a = this.simulateSingleLine(homeLambda, awayLambda, variance, lower, side);
          const b = this.simulateSingleLine(homeLambda, awayLambda, variance, upper, side);
          result[`${side}_${point}`] = combineQuarterSettlement(a, b);
          continue;
        }
        result[`${side}_${point}`] = this.simulateSingleLine(homeLambda, awayLambda, variance, point, side);
      }
    }
    return result;
  }

  private static simulateSingleLine(homeLambda: number, awayLambda: number, variance: number, point: number, side: "home" | "away"): HandicapSettlementProbability {
    let win = 0, push = 0, total = 0;
    const maxLambda = Math.max(homeLambda, awayLambda);
    // Adaptive truncation keeps omitted Poisson/NB tail very small without
    // hard-coding 0..14, whose bias grows as means increase.
    const maxGoals = Math.min(60, Math.max(20, Math.ceil(maxLambda + 10 * Math.sqrt(maxLambda))));

    for (let homeGoals = 0; homeGoals <= maxGoals; homeGoals++) {
      const homeProbability = this.overdispersedPoissonProbability(homeLambda, homeGoals, variance);
      for (let awayGoals = 0; awayGoals <= maxGoals; awayGoals++) {
        const probability = homeProbability * this.overdispersedPoissonProbability(awayLambda, awayGoals, variance);
        total += probability;
        const adjusted = (side === "home" ? homeGoals - awayGoals : awayGoals - homeGoals) + point;
        if (adjusted > 0) win += probability;
        else if (Math.abs(adjusted) < 1e-12) push += probability;
      }
    }

    if (total <= 0) return { win: 0, halfWin: 0, push: 0, halfLoss: 0, loss: 1 };
    return normalizeSettlement({ win: win / total, halfWin: 0, push: push / total, halfLoss: 0, loss: Math.max(0, (total - win - push) / total) });
  }

  private static overdispersedPoissonProbability(mean: number, goals: number, varianceMultiplier: number): number {
    if (varianceMultiplier <= 1.0000001) return this.poissonProbability(mean, goals);
    const overdispersion = varianceMultiplier - 1;
    const shape = 1 / overdispersion;
    return Math.exp(this.logNegativeBinomialPmf(shape, mean / shape, goals));
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
