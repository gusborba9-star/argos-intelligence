import { RegimeProfile } from "@/lib/argos/regime/RegimeSchema";
import { OddsValueEngine, ValueAnalysis } from "./market-intelligence/OddsValueEngine";
import { learningEngine } from "./ContinuousLearningEngine";

// ============================================================
// MODEL FACTORY v6.1.0 — SYNDICATE MASTER EDITION
// Motor de Simulação Monte Carlo com Calibração de Aprendizado
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

  /**
   * Monte Carlo v6.1.0 — Motor de Simulação de Elite
   * Integra regime, variância, contextos reais e CALIBRAÇÃO DE APRENDIZADO.
   */
  static async runMonteCarloWithLearning(
    metrics: MarketMetrics,
    regime: RegimeProfile,
    leagueId: string,
    marketType: "GOALS" | "CORNERS" | "CARDS" | "SHOTS" = "GOALS",
    iterations: number = ModelFactory.DEFAULT_ITERATIONS
  ): Promise<SimulationResult> {
    
    // 1. Obter calibração do Continuous Learning Engine
    const calibration = await learningEngine.getCalibration(leagueId, marketType);
    
    // 2. Executar simulação base
    const baseResult = this.runMonteCarlo(metrics, regime, iterations, marketType);

    // 3. Aplicar calibração (Ajuste fino baseado em histórico real)
    const adj = calibration.probabilityAdjustment;
    
    return {
      ...baseResult,
      probabilities: {
        home: Math.max(0.01, Math.min(0.99, baseResult.probabilities.home + (adj * 0.5))),
        draw: Math.max(0.01, Math.min(0.99, baseResult.probabilities.draw - (adj * 0.2))),
        away: Math.max(0.01, Math.min(0.99, baseResult.probabilities.away + (adj * 0.5))),
        over: baseResult.probabilities.over ? Math.max(0.01, Math.min(0.99, baseResult.probabilities.over + adj)) : undefined,
        under: baseResult.probabilities.under ? Math.max(0.01, Math.min(0.99, baseResult.probabilities.under - adj)) : undefined,
      },
      calibrationApplied: adj
    };
  }

  /**
   * Simulação Monte Carlo Base
   */
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
    let over25Count = 0;

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

      totalGoals += (hScore + aScore);
      if (matchTotal > 2.5) over25Count++;

      if (finalHome > finalAway) homeWins++;
      else if (finalHome === finalAway) draws++;
      else awayWins++;
    }

    return {
      probabilities: {
        home: homeWins / iterations,
        draw: draws / iterations,
        away: awayWins / iterations,
        over: over25Count / iterations,
        under: 1 - (over25Count / iterations)
      },
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
}
