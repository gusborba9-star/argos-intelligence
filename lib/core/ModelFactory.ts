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
  static runMonteCarlo(
    metrics: MarketMetrics,
    regime: RegimeProfile,
    iterations: number = 1500,
    marketType: 'GOALS' | 'CORNERS' | 'CARDS' | 'SHOTS' = 'GOALS'
  ): SimulationResult {
    let homeWins = 0;
    let draws = 0;
    let awayWins = 0;
    let totalScore = 0;

    // Ajuste de dispersão baseado no regime
    const variance = regime.variance_multiplier || 1.0;
    
    for (let i = 0; i < iterations; i++) {
      const hLambda = metrics.homeMean * (1 + (Math.random() - 0.5) * (variance - 1));
      const aLambda = metrics.awayMean * (1 + (Math.random() - 0.5) * (variance - 1));

      const hScore = this.poisson(hLambda);
      const aScore = this.poisson(aLambda);

      totalScore += (hScore + aScore);

      if (hScore > aScore) homeWins++;
      else if (hScore === aScore) draws++;
      else awayWins++;
    }

    return {
      probabilities: {
        home: homeWins / iterations,
        draw: draws / iterations,
        away: awayWins / iterations
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
