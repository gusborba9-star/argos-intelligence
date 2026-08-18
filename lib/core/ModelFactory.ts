import { RegimeProfile } from "@/lib/argos/regime/RegimeSchema";
import { OddsValueEngine, ValueAnalysis } from "./market-intelligence/OddsValueEngine";
import { learningEngine } from "./ContinuousLearningEngine";

// ============================================================
// MODEL FACTORY v6.1.3 — SYNDICATE MASTER EDITION
// Quant integrity: calibration is conservative and market-family aware.
// ============================================================

export interface MarketMetrics {
  homeMean: number;
  awayMean: number;
  dispersion?: number;
}

export interface SimulationResult {
  probabilities: {
    home: number;
    draw: number;
    away: number;
    over?: number;
    under?: number;
    [key: string]: number | undefined;
  };
  iterations: number;
  expectedGoals: number;
  calibrationApplied?: number;
}

export class ModelFactory {
  private static readonly DEFAULT_ITERATIONS = 10000;

  static async runMonteCarloWithLearning(
    metrics: MarketMetrics,
    regime: RegimeProfile,
    leagueId: string,
    marketType: "GOALS" | "CORNERS" | "CARDS" | "SHOTS" | "WINNER" | "BTTS" | "HANDICAP" | "GOALS_HT" = "GOALS",
    iterations: number = ModelFactory.DEFAULT_ITERATIONS
  ): Promise<SimulationResult> {
    const calibration = await learningEngine.getCalibration(leagueId, marketType);
    const baseResult = this.runMonteCarlo(metrics, regime, iterations, marketType as any);
    const probabilities = { ...baseResult.probabilities };
    let calibrationApplied = 0;

    // Only binary over/under calibration is currently mathematically
    // conservative. It preserves P(over) + P(under) = 1.
    const baseOver = baseResult.probabilities.over;
    if (baseOver !== undefined && probabilities.under !== undefined) {
      const adjustedOver = this.applyBinaryBias(baseOver, calibration.probabilityAdjustment);
      probabilities.over = adjustedOver;
      probabilities.under = 1 - adjustedOver;
      calibrationApplied = adjustedOver - baseOver;
    }

    // BTTS is also binary when present. The current simulation produces
    // explicit btts_yes/btts_no keys; apply the same conservative transform.
    if (probabilities.btts_yes !== undefined && probabilities.btts_no !== undefined) {
      const adjustedYes = this.applyBinaryBias(probabilities.btts_yes, calibration.probabilityAdjustment);
      probabilities.btts_yes = adjustedYes;
      probabilities.btts_no = 1 - adjustedYes;
    }

    return {
      ...baseResult,
      probabilities,
      calibrationApplied
    };
  }

  private static applyBinaryBias(probability: number, bias: number): number {
    const p = Math.max(0.001, Math.min(0.999, probability));
    const boundedBias = Math.max(-0.15, Math.min(0.15, bias));
    const logit = Math.log(p / (1 - p));
    const adjusted = 1 / (1 + Math.exp(-(logit + boundedBias)));
    return Math.max(0.001, Math.min(0.999, adjusted));
  }

  static runMonteCarlo(
    metrics: MarketMetrics,
    regime: RegimeProfile,
    iterations: number = ModelFactory.DEFAULT_ITERATIONS,
    marketType: "GOALS" | "CORNERS" | "CARDS" | "SHOTS" = "GOALS",
    elapsedTime: number = 0,
    currentScore: { home: number; away: number } = { home: 0, away: 0 }
  ): SimulationResult {
    let homeWins = 0;
    let draws = 0;
    let awayWins = 0;
    let totalGoals = 0;
    let bttsYes = 0;

    const GOAL_LINES = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5];
    const overCounts: Record<string, number> = {};
    GOAL_LINES.forEach((l) => (overCounts[l] = 0));

    const HANDICAP_LINES = [-2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2];
    const homeCoversCounts: Record<string, number> = {};
    const awayCoversCounts: Record<string, number> = {};
    HANDICAP_LINES.forEach((l) => {
      const magnitude = Math.abs(l);
      homeCoversCounts[magnitude] ||= 0;
      awayCoversCounts[magnitude] ||= 0;
    });

    const variance = regime.variance_multiplier || 1.2;
    const bias = regime.model_bias || 0;

    for (let i = 0; i < iterations; i++) {
      const hLambda = this.generateGamma(metrics.homeMean * (1 + bias), variance);
      const aLambda = this.generateGamma(metrics.awayMean * (1 - bias), variance);

      const hScore = this.poisson(hLambda);
      const aScore = this.poisson(aLambda);

      const finalHome = currentScore.home + hScore;
      const finalAway = currentScore.away + aScore;
      const matchTotal = finalHome + finalAway;
      const goalDiff = finalHome - finalAway;

      totalGoals += hScore + aScore;

      GOAL_LINES.forEach((l) => {
        if (matchTotal > l) overCounts[l]++;
      });

      HANDICAP_LINES.forEach((l) => {
        const magnitude = Math.abs(l);
        if (goalDiff - magnitude > 0) homeCoversCounts[magnitude]++;
        if (goalDiff + magnitude > 0) awayCoversCounts[magnitude]++;
      });

      if (finalHome > 0 && finalAway > 0) bttsYes++;

      if (finalHome > finalAway) homeWins++;
      else if (finalHome === finalAway) draws++;
      else awayWins++;
    }

    const probabilities: SimulationResult["probabilities"] = {
      home: homeWins / iterations,
      draw: draws / iterations,
      away: awayWins / iterations,
      over: overCounts[2.5] / iterations,
      under: 1 - overCounts[2.5] / iterations,
      btts_yes: bttsYes / iterations,
      btts_no: 1 - bttsYes / iterations,
    };

    GOAL_LINES.forEach((l) => {
      probabilities[`over_${l}`] = overCounts[l] / iterations;
      probabilities[`under_${l}`] = 1 - overCounts[l] / iterations;
    });

    HANDICAP_LINES.forEach((l) => {
      const magnitude = Math.abs(l);
      probabilities[`home_handicap_${magnitude}`] = homeCoversCounts[magnitude] / iterations;
      probabilities[`away_handicap_${magnitude}`] = awayCoversCounts[magnitude] / iterations;
    });

    return {
      probabilities,
      iterations,
      expectedGoals: totalGoals / iterations
    };
  }

  static calculateEV(probability: number, marketOdd: number): ValueAnalysis {
    return OddsValueEngine.calculateValue(probability, marketOdd);
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

  public static runCountStatSimulation(
    homeMean: number,
    awayMean: number,
    lines: number[],
    iterations: number = 5000
  ): Record<string, number> {
    const overCounts: Record<string, number> = {};
    lines.forEach((l) => (overCounts[l] = 0));

    for (let i = 0; i < iterations; i++) {
      const h = this.poisson(Math.max(0.1, homeMean));
      const a = this.poisson(Math.max(0.1, awayMean));
      const total = h + a;
      lines.forEach((l) => {
        if (total > l) overCounts[l]++;
      });
    }

    const probabilities: Record<string, number> = {};
    lines.forEach((l) => {
      probabilities[`over_${l}`] = overCounts[l] / iterations;
      probabilities[`under_${l}`] = 1 - overCounts[l] / iterations;
    });
    return probabilities;
  }
}
