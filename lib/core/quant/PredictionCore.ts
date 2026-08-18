// ============================================================
// ARGOS PREDICTION CORE v7.0.0
// Neutral football probability engine.
//
// Design goals:
// - deterministic replay through an explicit seed;
// - statistically explicit distributions;
// - no market price, EV, Kelly or staking semantics;
// - signed goal-difference thresholds are preserved;
// - every result exposes enough metadata for audit/replay.
// ============================================================

export interface PredictionMetrics {
  homeMean: number;
  awayMean: number;
  dispersion?: number;
}

export interface PredictionContext {
  modelVersion?: string;
  featureVersion?: string;
  seed?: number;
}

export interface ScoreCell {
  home: number;
  away: number;
  probability: number;
}

export interface PredictionResult {
  modelVersion: string;
  featureVersion: string;
  seed: number;
  iterations: number;
  expectedGoals: {
    home: number;
    away: number;
    total: number;
  };
  probabilities: {
    homeWin: number;
    draw: number;
    awayWin: number;
    bttsYes: number;
    bttsNo: number;
    over: Record<string, number>;
    under: Record<string, number>;
    goalDifferenceAtLeast: Record<string, number>;
    goalDifferenceAtMost: Record<string, number>;
  };
  scoreMatrix: ScoreCell[];
}

class SeededRng {
  private state: number;

  constructor(seed: number) {
    // Convert to a stable unsigned 32-bit state and avoid the zero lock state.
    this.state = (seed >>> 0) || 0x6d2b79f5;
  }

  next(): number {
    // Mulberry32: compact, deterministic and suitable for simulation/replay.
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
}

function assertFinitePositive(value: number, name: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`Invalid ${name}: expected a finite non-negative number.`);
  }
  return value;
}

function clampProbability(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export class PredictionCore {
  static readonly VERSION = "ARGOS_PREDICTION_CORE_7.0.0";
  static readonly DEFAULT_ITERATIONS = 20_000;
  static readonly DEFAULT_SEED = 0x41_7267_6f; // "Argo"

  static simulate(
    metrics: PredictionMetrics,
    context: PredictionContext = {},
    iterations = PredictionCore.DEFAULT_ITERATIONS
  ): PredictionResult {
    const homeMean = assertFinitePositive(metrics.homeMean, "homeMean");
    const awayMean = assertFinitePositive(metrics.awayMean, "awayMean");
    if (!Number.isInteger(iterations) || iterations <= 0) {
      throw new Error("iterations must be a positive integer.");
    }

    const seed = (context.seed ?? PredictionCore.DEFAULT_SEED) >>> 0;
    const rng = new SeededRng(seed);
    const homeLambda = Math.max(0.0001, homeMean);
    const awayLambda = Math.max(0.0001, awayMean);

    let homeWins = 0;
    let draws = 0;
    let awayWins = 0;
    let bttsYes = 0;
    let homeGoalsTotal = 0;
    let awayGoalsTotal = 0;

    const lines = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5];
    const thresholds = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2];
    const overCounts = new Map<number, number>(lines.map((line) => [line, 0]));
    const atLeastCounts = new Map<number, number>(thresholds.map((line) => [line, 0]));
    const atMostCounts = new Map<number, number>(thresholds.map((line) => [line, 0]));
    const scoreCounts = new Map<string, number>();

    for (let i = 0; i < iterations; i++) {
      const homeGoals = PredictionCore.samplePoisson(homeLambda, rng);
      const awayGoals = PredictionCore.samplePoisson(awayLambda, rng);
      const difference = homeGoals - awayGoals;
      const total = homeGoals + awayGoals;

      homeGoalsTotal += homeGoals;
      awayGoalsTotal += awayGoals;

      if (homeGoals > awayGoals) homeWins++;
      else if (homeGoals === awayGoals) draws++;
      else awayWins++;

      if (homeGoals > 0 && awayGoals > 0) bttsYes++;

      for (const line of lines) {
        if (total > line) overCounts.set(line, (overCounts.get(line) ?? 0) + 1);
      }

      for (const threshold of thresholds) {
        if (difference >= threshold) atLeastCounts.set(threshold, (atLeastCounts.get(threshold) ?? 0) + 1);
        if (difference <= threshold) atMostCounts.set(threshold, (atMostCounts.get(threshold) ?? 0) + 1);
      }

      // Keep a bounded score matrix for audit/explanation. Scores above 10 are
      // folded into the 10+ bucket rather than discarded.
      const h = Math.min(homeGoals, 10);
      const a = Math.min(awayGoals, 10);
      const key = `${h}:${a}`;
      scoreCounts.set(key, (scoreCounts.get(key) ?? 0) + 1);
    }

    const scoreMatrix: ScoreCell[] = [...scoreCounts.entries()]
      .map(([key, count]) => {
        const [home, away] = key.split(":").map(Number);
        return { home, away, probability: count / iterations };
      })
      .sort((a, b) => b.probability - a.probability);

    const toRecord = (source: Map<number, number>) =>
      Object.fromEntries([...source.entries()].map(([line, count]) => [String(line), count / iterations]));

    return {
      modelVersion: context.modelVersion ?? PredictionCore.VERSION,
      featureVersion: context.featureVersion ?? "UNVERSIONED",
      seed,
      iterations,
      expectedGoals: {
        home: homeGoalsTotal / iterations,
        away: awayGoalsTotal / iterations,
        total: (homeGoalsTotal + awayGoalsTotal) / iterations,
      },
      probabilities: {
        homeWin: homeWins / iterations,
        draw: draws / iterations,
        awayWin: awayWins / iterations,
        bttsYes: bttsYes / iterations,
        bttsNo: 1 - bttsYes / iterations,
        over: toRecord(overCounts),
        under: Object.fromEntries([...overCounts.keys()].map((line) => [String(line), 1 - (overCounts.get(line) ?? 0) / iterations])),
        goalDifferenceAtLeast: toRecord(atLeastCounts),
        goalDifferenceAtMost: toRecord(atMostCounts),
      },
      scoreMatrix,
    };
  }

  /** Exact Poisson sampler using the same seeded RNG as the simulation. */
  static samplePoisson(lambda: number, rng: { next(): number }): number {
    assertFinitePositive(lambda, "lambda");

    // Knuth is exact but becomes inefficient for very large lambda. Football
    // goal rates are normally small; the guard keeps this utility safe if a
    // future feature accidentally supplies a large parameter.
    if (lambda < 30) {
      const limit = Math.exp(-lambda);
      let product = 1;
      let k = 0;
      do {
        k++;
        product *= Math.max(Number.MIN_VALUE, rng.next());
      } while (product > limit);
      return k - 1;
    }

    // Normal approximation is used only outside the expected football range.
    // It prevents pathological runtime while remaining deterministic.
    const u1 = Math.max(Number.MIN_VALUE, rng.next());
    const u2 = rng.next();
    const normal = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * normal));
  }

  /**
   * Independent Poisson score probability. Useful for exact matrix checks and
   * deterministic validation without Monte Carlo noise.
   */
  static scoreProbability(homeGoals: number, awayGoals: number, metrics: PredictionMetrics): number {
    if (!Number.isInteger(homeGoals) || homeGoals < 0 || !Number.isInteger(awayGoals) || awayGoals < 0) {
      throw new Error("Score must contain non-negative integers.");
    }
    const home = PredictionCore.poissonPmf(homeGoals, assertFinitePositive(metrics.homeMean, "homeMean"));
    const away = PredictionCore.poissonPmf(awayGoals, assertFinitePositive(metrics.awayMean, "awayMean"));
    return clampProbability(home * away);
  }

  static poissonPmf(k: number, lambda: number): number {
    if (!Number.isInteger(k) || k < 0) throw new Error("k must be a non-negative integer.");
    assertFinitePositive(lambda, "lambda");
    if (lambda === 0) return k === 0 ? 1 : 0;

    let logP = -lambda + k * Math.log(lambda);
    for (let i = 2; i <= k; i++) logP -= Math.log(i);
    return clampProbability(Math.exp(logP));
  }
}
