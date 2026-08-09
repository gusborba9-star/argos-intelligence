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
    
    const clamp = (v: number) => Math.max(0.01, Math.min(0.99, v));

    return {
      ...baseResult,
      probabilities: {
        // Preserva todas as linhas/BTTS calculadas na simulação base — só ajusta
        // as 3 dimensões que o Continuous Learning Engine calibra hoje (Winner + 2.5).
        ...baseResult.probabilities,
        home: clamp(baseResult.probabilities.home + (adj * 0.5)),
        draw: clamp(baseResult.probabilities.draw - (adj * 0.2)),
        away: clamp(baseResult.probabilities.away + (adj * 0.5)),
        over: baseResult.probabilities.over !== undefined ? clamp(baseResult.probabilities.over + adj) : undefined,
        under: baseResult.probabilities.under !== undefined ? clamp(baseResult.probabilities.under - adj) : undefined,
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
    let bttsYes = 0;

    // Linhas de Goals realmente ofertadas pelo mercado variam por liga/casa.
    // Simulamos todas as linhas comuns numa única passada de Monte Carlo,
    // em vez de fixar apenas 2.5.
    const GOAL_LINES = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5];
    const overCounts: Record<string, number> = {};
    GOAL_LINES.forEach((l) => (overCounts[l] = 0));

    // Linhas de Handicap Asiático comuns (baseadas na diferença de gols
    // simulada) — mesma passada, sem custo extra de simulação.
    const HANDICAP_LINES = [-2, -1.5, -1, -0.5, 0.5, 1, 1.5, 2];
    const homeCoversCounts: Record<string, number> = {};
    HANDICAP_LINES.forEach((l) => (homeCoversCounts[l] = 0));

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

      totalGoals += (hScore + aScore);
      GOAL_LINES.forEach((l) => {
        if (matchTotal > l) overCounts[l]++;
      });
      HANDICAP_LINES.forEach((l) => {
        // Handicap do time da casa: casa cobre se (diferença + linha) > 0
        if (goalDiff + l > 0) homeCoversCounts[l]++;
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
      probabilities[`home_handicap_${l}`] = homeCoversCounts[l] / iterations;
      probabilities[`away_handicap_${l}`] = 1 - homeCoversCounts[l] / iterations;
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

  /**
   * Simulação de Escanteios ou Cartões via Poisson, usando médias reais dos
   * times (não o mesmo simulador de gols — a distribuição é diferente e as
   * médias vêm de fontes distintas). Sem isso, Corners/Cards nunca tinham
   * modelo de probabilidade — só chegavam a ser normalizados, nunca a virar
   * sinal.
   */
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
