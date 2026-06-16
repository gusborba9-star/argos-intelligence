// ============================================================
// MODEL FACTORY v4.1 — EXPANDED EDITION
// Suporte para Gols, Escanteios, Cartões e Finalizações
// ============================================================

import { RegimeProfile } from "@/lib/argos/regime/RegimeSchema";

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
  };
  iterations: number;
  expectedValue: number;
}

export class ModelFactory {
  /**
   * Simulação de Monte Carlo com 1.500 iterações
   * Agora suporta múltiplos mercados e ajustes de regime
   */
  /**
   * Simulação de Monte Carlo com Probabilidade Condicional (Time-Aware)
   * @param elapsedTime Tempo decorrido em minutos (0-90)
   * @param currentScore Placar atual { home: number, away: number }
   */
  static runMonteCarlo(
    metrics: MarketMetrics,
    regime: RegimeProfile,
    iterations: number = 1500,
    marketType: 'GOALS' | 'CORNERS' | 'CARDS' | 'SHOTS' = 'GOALS',
    elapsedTime: number = 0,
    currentScore: { home: number, away: number } = { home: 0, away: 0 }
  ): SimulationResult {
    let homeWins = 0;
    let draws = 0;
    let awayWins = 0;
    let totalScore = 0;
    let over25Count = 0;

    // 1. CÁLCULO DE TEMPO RESIDUAL (Time-Decay)
    const remainingTimeRatio = Math.max(0, (90 - elapsedTime) / 90);
    
    // 2. INTENSIDADE POR MINUTO (Fadiga & Contexto)
    // Se o tempo passa e o evento não ocorre, a intensidade residual cai exponencialmente
    const intensityFactor = Math.pow(remainingTimeRatio, 1.1); 

    // Ajuste de dispersão baseado no regime
    const variance = regime.variance_multiplier || 1.0;
    
    for (let i = 0; i < iterations; i++) {
      // Aplicamos o intensityFactor nas médias para refletir o tempo restante
      const hLambda = (metrics.homeMean * intensityFactor) * (1 + (Math.random() - 0.5) * (variance - 1));
      const aLambda = (metrics.awayMean * intensityFactor) * (1 + (Math.random() - 0.5) * (variance - 1));

      const hAddedScore = this.poisson(hLambda);
      const aAddedScore = this.poisson(aLambda);

      const finalHomeScore = currentScore.home + hAddedScore;
      const finalAwayScore = currentScore.away + aAddedScore;

      totalScore += (hAddedScore + aAddedScore);
      if (finalHomeScore + finalAwayScore > 2.5) over25Count++;

      if (finalHomeScore > finalAwayScore) homeWins++;
      else if (finalHomeScore === finalAwayScore) draws++;
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
      expectedValue: totalScore / iterations
    };
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
   * Modelagem específica para Escanteios
   */
  static modelCorners(homeAttack: number, awayDefense: number, regime: RegimeProfile): SimulationResult {
    const homeMean = homeAttack * 1.2; // Exemplo de peso
    const awayMean = awayDefense * 0.8;
    return this.runMonteCarlo({ homeMean, awayMean }, regime, 1500, 'CORNERS');
  }

  /**
   * Modelagem específica para Cartões
   */
  static modelCards(homeAggression: number, awayAggression: number, refereeStrictness: number, regime: RegimeProfile): SimulationResult {
    const homeMean = homeAggression * refereeStrictness;
    const awayMean = awayAggression * refereeStrictness;
    return this.runMonteCarlo({ homeMean, awayMean }, regime, 1500, 'CARDS');
  }
}
