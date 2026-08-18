import { RegimeProfile } from "@/lib/argos/regime/RegimeSchema";

export interface HandicapSettlementProbability {
  win: number;
  push: number;
  loss: number;
}

/**
 * Asian handicap settlement model.
 *
 * Unlike a binary market, an integer Asian handicap has a PUSH state.
 * The probabilities are therefore explicitly represented as win/push/loss.
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
    const result: Record<string, HandicapSettlementProbability> = {};
    const counts: Record<string, { win: number; push: number; loss: number }> = {};

    for (const point of points) {
      for (const side of ["home", "away"] as const) {
        counts[`${side}_${point}`] = { win: 0, push: 0, loss: 0 };
      }
    }

    const variance = regime.variance_multiplier || 1.1;
    const bias = regime.model_bias || 0;

    for (let i = 0; i < iterations; i++) {
      const homeLambda = this.generateGamma(Math.max(0.05, homeMean * (1 + bias)), variance);
      const awayLambda = this.generateGamma(Math.max(0.05, awayMean * (1 - bias)), variance);
      const homeGoals = this.poisson(homeLambda);
      const awayGoals = this.poisson(awayLambda);
      const goalDiff = homeGoals - awayGoals;

      for (const point of points) {
        const homeAdjusted = goalDiff + point;
        const awayAdjusted = -goalDiff + point;
        this.record(counts[`home_${point}`], homeAdjusted);
        this.record(counts[`away_${point}`], awayAdjusted);
      }
    }

    for (const point of points) {
      for (const side of ["home", "away"] as const) {
        const c = counts[`${side}_${point}`];
        result[`${side}_${point}`] = {
          win: c.win / iterations,
          push: c.push / iterations,
          loss: c.loss / iterations,
        };
      }
    }

    return result;
  }

  private static record(
    count: { win: number; push: number; loss: number },
    adjustedResult: number
  ): void {
    if (adjustedResult > 0) count.win++;
    else if (adjustedResult === 0) count.push++;
    else count.loss++;
  }

  private static generateGamma(mean: number, varianceFactor: number): number {
    const beta = varianceFactor - 1;
    if (beta <= 0) return mean;

    let sum = 0;
    for (let i = 0; i < 12; i++) sum += Math.random();
    const noise = (sum - 6) * Math.sqrt(mean * beta);
    return Math.max(0.01, mean + noise);
  }

  private static poisson(lambda: number): number {
    const L = Math.exp(-lambda);
    let k = 0;
    let p = 1;
    do {
      k++;
      p *= Math.random();
    } while (p > L);
    return k - 1;
  }
}
