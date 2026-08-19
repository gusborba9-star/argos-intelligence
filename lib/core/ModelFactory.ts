import { RegimeProfile } from "@/lib/argos/regime/RegimeSchema";
import { OddsValueEngine, ValueAnalysis } from "./market-intelligence/OddsValueEngine";
import { learningEngine } from "./ContinuousLearningEngine";
import { applyCalibration } from "./CalibrationMath";

// ============================================================
// MODEL FACTORY v6.3.2 — QUANTITATIVE CORE
// Gamma-Poisson + deterministic seeded PRNG + OOS calibration.
// Every binary probability exposed to the orchestrator is calibrated
// from the same market-specific transform and complementary state.
// ============================================================

export interface MarketMetrics { homeMean: number; awayMean: number; dispersion?: number; }

export interface SimulationResult {
  probabilities: { home: number; draw: number; away: number; over?: number; under?: number; [key: string]: number | undefined; };
  iterations: number;
  expectedGoals: number;
  calibrationApplied?: number;
}

type RandomSource = () => number;
type CalibratableMarket = "GOALS" | "CORNERS" | "CARDS" | "SHOTS" | "WINNER" | "BTTS" | "HANDICAP" | "GOALS_HT";

export class ModelFactory {
  private static readonly DEFAULT_ITERATIONS = 10000;
  private static readonly MIN_LAMBDA = 0.01;
  private static readonly MIN_PROBABILITY = 0.0001;

  static async runMonteCarloWithLearning(metrics: MarketMetrics, regime: RegimeProfile, leagueId: string, marketType: CalibratableMarket = "GOALS", iterations: number = ModelFactory.DEFAULT_ITERATIONS): Promise<SimulationResult> {
    const calibration = await learningEngine.getCalibration(leagueId, marketType);
    const seed = this.seedFrom(`${leagueId}|${marketType}|${metrics.homeMean}|${metrics.awayMean}|${regime.variance_multiplier}|${regime.model_bias}`);
    const baseResult = this.runMonteCarlo(metrics, regime, iterations, marketType as any, 0, { home: 0, away: 0 }, seed);
    const probabilities = { ...baseResult.probabilities };
    let calibrationApplied = 0;

    for (const key of Object.keys(probabilities)) {
      if (!key.startsWith("over_")) continue;
      const rawOver = probabilities[key];
      if (rawOver === undefined) continue;
      const adjustedOver = applyCalibration(rawOver, calibration.logitSlope, calibration.logitIntercept);
      probabilities[key] = adjustedOver;
      const underKey = `under_${key.slice("over_".length)}`;
      if (probabilities[underKey] !== undefined) probabilities[underKey] = 1 - adjustedOver;
      // Keep one representative delta for telemetry. It must not be a sum
      // across lines, otherwise the magnitude becomes meaningless.
      if (key === "over_2.5") calibrationApplied = adjustedOver - rawOver;
    }

    // The legacy top-level pair aliases the 2.5 line. It must reference the
    // already-calibrated value rather than applying the transform twice.
    if (probabilities.over !== undefined && probabilities["over_2.5"] !== undefined) {
      probabilities.over = probabilities["over_2.5"];
      if (probabilities.under !== undefined) probabilities.under = 1 - probabilities.over;
    }

    if (probabilities.btts_yes !== undefined) {
      const adjustedYes = applyCalibration(probabilities.btts_yes, calibration.logitSlope, calibration.logitIntercept);
      probabilities.btts_yes = adjustedYes;
      if (probabilities.btts_no !== undefined) probabilities.btts_no = 1 - adjustedYes;
    }

    return { ...baseResult, probabilities, calibrationApplied };
  }

  static runMonteCarlo(metrics: MarketMetrics, regime: RegimeProfile, iterations: number = ModelFactory.DEFAULT_ITERATIONS, marketType: "GOALS" | "CORNERS" | "CARDS" | "SHOTS" = "GOALS", elapsedTime: number = 0, currentScore: { home: number; away: number } = { home: 0, away: 0 }, seed?: number): SimulationResult {
    if (!Number.isInteger(iterations) || iterations < 1000) throw new Error(`Monte Carlo requires at least 1000 iterations; received ${iterations}`);
    if (!Number.isFinite(metrics.homeMean) || !Number.isFinite(metrics.awayMean)) throw new Error("Invalid goal-rate metrics");
    const random = this.createRng(seed ?? this.seedFrom(`${metrics.homeMean}|${metrics.awayMean}|${marketType}|${regime.variance_multiplier}|${regime.model_bias}`));
    let homeWins = 0, draws = 0, awayWins = 0, totalGoals = 0, bttsYes = 0;
    const GOAL_LINES = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5];
    const overCounts: Record<string, number> = {};
    GOAL_LINES.forEach((line) => (overCounts[line] = 0));
    const HANDICAP_LINES = [-2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2];
    const homeCoversCounts: Record<string, number> = {}, awayCoversCounts: Record<string, number> = {};
    HANDICAP_LINES.forEach((point) => { homeCoversCounts[String(point)] = 0; awayCoversCounts[String(point)] = 0; });
    const varianceMultiplier = Number.isFinite(regime.variance_multiplier) && regime.variance_multiplier > 1 ? regime.variance_multiplier : 1.0;
    const bias = Number.isFinite(regime.model_bias) ? regime.model_bias : 0;
    const homeMean = Math.max(this.MIN_LAMBDA, metrics.homeMean * (1 + bias));
    const awayMean = Math.max(this.MIN_LAMBDA, metrics.awayMean * (1 - bias));
    for (let i = 0; i < iterations; i++) {
      const hLambda = this.gammaPoissonLambda(homeMean, varianceMultiplier, random);
      const aLambda = this.gammaPoissonLambda(awayMean, varianceMultiplier, random);
      const hScore = this.poisson(hLambda, random), aScore = this.poisson(aLambda, random);
      const finalHome = currentScore.home + hScore, finalAway = currentScore.away + aScore;
      const matchTotal = finalHome + finalAway, goalDiff = finalHome - finalAway;
      totalGoals += hScore + aScore;
      GOAL_LINES.forEach((line) => { if (matchTotal > line) overCounts[line]++; });
      HANDICAP_LINES.forEach((point) => { if (goalDiff + point > 0) homeCoversCounts[String(point)]++; if (-goalDiff + point > 0) awayCoversCounts[String(point)]++; });
      if (finalHome > 0 && finalAway > 0) bttsYes++;
      if (finalHome > finalAway) homeWins++; else if (finalHome === finalAway) draws++; else awayWins++;
    }
    const probabilities: SimulationResult["probabilities"] = { home: homeWins / iterations, draw: draws / iterations, away: awayWins / iterations, over: overCounts[2.5] / iterations, under: 1 - overCounts[2.5] / iterations, btts_yes: bttsYes / iterations, btts_no: 1 - bttsYes / iterations };
    GOAL_LINES.forEach((line) => { const over = overCounts[line] / iterations; probabilities[`over_${line}`] = over; probabilities[`under_${line}`] = 1 - over; });
    HANDICAP_LINES.forEach((point) => { probabilities[`home_handicap_${point}`] = homeCoversCounts[String(point)] / iterations; probabilities[`away_handicap_${point}`] = awayCoversCounts[String(point)] / iterations; });
    return { probabilities, iterations, expectedGoals: totalGoals / iterations };
  }

  static calculateEV(probability: number, marketOdd: number): ValueAnalysis { return OddsValueEngine.calculateValue(probability, marketOdd); }

  public static runCountStatSimulation(homeMean: number, awayMean: number, lines: number[], iterations: number = 5000, seed?: number): Record<string, number> {
    if (!Number.isInteger(iterations) || iterations < 1000) throw new Error("Count-stat Monte Carlo requires at least 1000 iterations");
    const random = this.createRng(seed ?? this.seedFrom(`${homeMean}|${awayMean}|${lines.join(",")}`));
    const overCounts: Record<string, number> = {}; lines.forEach((line) => (overCounts[line] = 0));
    for (let i = 0; i < iterations; i++) { const h = this.poisson(Math.max(this.MIN_LAMBDA, homeMean), random), a = this.poisson(Math.max(this.MIN_LAMBDA, awayMean), random), total = h + a; lines.forEach((line) => { if (total > line) overCounts[line]++; }); }
    const probabilities: Record<string, number> = {}; lines.forEach((line) => { const over = overCounts[line] / iterations; probabilities[`over_${line}`] = over; probabilities[`under_${line}`] = 1 - over; });
    return probabilities;
  }

  private static gammaPoissonLambda(mean: number, varianceMultiplier: number, random: RandomSource): number {
    if (varianceMultiplier <= 1.0000001) return mean;
    const overdispersion = varianceMultiplier - 1, shape = 1 / overdispersion, scale = mean / shape;
    return Math.max(this.MIN_LAMBDA, this.gamma(shape, scale, random));
  }

  private static gamma(shape: number, scale: number, random: RandomSource): number {
    if (!(shape > 0) || !(scale > 0)) throw new Error("Invalid Gamma parameters");
    if (shape < 1) { const u = Math.max(this.MIN_PROBABILITY, random()); return this.gamma(shape + 1, scale, random) * Math.pow(u, 1 / shape); }
    const d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d);
    while (true) { const x = this.normal(random), v0 = 1 + c * x; if (v0 <= 0) continue; const v = v0 * v0 * v0, u = random(); if (u < 1 - 0.0331 * x * x * x * x || Math.log(Math.max(this.MIN_PROBABILITY, u)) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v * scale; }
  }

  private static normal(random: RandomSource): number { const u1 = Math.max(this.MIN_PROBABILITY, random()), u2 = random(); return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2); }

  private static poisson(lambda: number, random: RandomSource): number {
    if (lambda < 30) { const limit = Math.exp(-lambda); let product = 1, k = 0; do { k++; product *= Math.max(this.MIN_PROBABILITY, random()); } while (product > limit); return k - 1; }
    const sd = Math.sqrt(lambda);
    while (true) { const candidate = Math.floor(lambda + sd * this.normal(random) + 0.5); if (candidate < 0) continue; const logP = candidate * Math.log(lambda) - lambda - this.logGamma(candidate + 1), proposalLog = -0.5 * Math.log(2 * Math.PI * lambda) - ((candidate - lambda) ** 2) / (2 * lambda); if (Math.log(Math.max(this.MIN_PROBABILITY, random())) <= logP - proposalLog) return candidate; }
  }

  private static logGamma(z: number): number {
    const coefficients = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (z < 0.5) return Math.log(Math.PI) - Math.log(Math.sin(Math.PI * z)) - this.logGamma(1 - z);
    let x = 0.99999999999980993; const t0 = z - 1;
    for (let i = 0; i < coefficients.length; i++) x += coefficients[i] / (t0 + i + 1);
    const t = t0 + coefficients.length - 0.5;
    return 0.5 * Math.log(2 * Math.PI) + (t0 + 0.5) * Math.log(t) - t + Math.log(x);
  }

  private static createRng(seed: number): RandomSource { let state = seed >>> 0 || 0x9e3779b9; return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; state >>>= 0; return (state + 1) / 4294967297; }; }

  private static seedFrom(value: string): number { let hash = 2166136261; for (let i = 0; i < value.length; i++) { hash ^= value.charCodeAt(i); hash = Math.imul(hash, 16777619); } return hash >>> 0; }
}
