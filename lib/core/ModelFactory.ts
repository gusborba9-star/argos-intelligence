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
    
    // 2. CURVA DE INTENSIDADE NÃO-LINEAR (Momento de Pressão)
    // Reconhece que o final do jogo tem uma "pressão de desespero" que compensa a fadiga
    let pressureFactor = 1.0;
    if (elapsedTime > 75) {
      // Aumenta a intensidade no final do jogo (75-90 min)
      pressureFactor = 1.0 + (elapsedTime - 75) * 0.02; 
    } else if (elapsedTime < 15) {
      // Intensidade de início de jogo (0-15 min)
      pressureFactor = 1.15;
    }
    
    const intensityFactor = Math.pow(remainingTimeRatio, 1.1) * pressureFactor;

    // 3. FATOR DE IMPORTÂNCIA (World Cup Bias)
    // Se for Copa do Mundo, a variância é maior devido à tensão emocional
    const importanceMultiplier = regime.reasoning_tags?.includes("WORLD_CUP") ? 1.25 : 1.0;

    // 4. MATRIZ DE CORRELAÇÃO DE GAME STATE (Gols vs Escanteios)
    // Se um time está vencendo por 2+, a intensidade de escanteios cai.
    // Se está perdendo, a urgência aumenta a busca por fundo de campo.
    const goalDiff = currentScore.home - currentScore.away;
    const totalGoals = currentScore.home + currentScore.away;
    
    // 4. SHOCK & VOLATILITY ENGINE (Estado de Arte)
    // Detecta mudanças bruscas (ex: 2x1) que resetam a inércia tática
    let homeUrgency = 1.0;
    let awayUrgency = 1.0;
    let volatilityMultiplier = 1.0;

    if (Math.abs(goalDiff) === 1 && totalGoals >= 2) {
      // "Shock State": Placar perigoso (2x1, 1x2, 3x2). Explosão de intensidade.
      homeUrgency = 1.45; 
      awayUrgency = 1.45;
      volatilityMultiplier = 1.35; // Aumenta a incerteza/caos
    } else if (goalDiff >= 2) {
      homeUrgency = 0.65; // Acomodação profunda
      awayUrgency = 1.40; // Desespero total do visitante
    } else if (goalDiff <= -2) {
      homeUrgency = 1.40;
      awayUrgency = 0.65;
    } else if (goalDiff === 0 && elapsedTime > 70) {
      homeUrgency = 1.25; // Tensão máxima pelo gol da vitória
      awayUrgency = 1.25;
    }

    // 5. TENSOR DE DECISÃO MULTIMODAL
    // Unifica Regime, Contexto e Volatilidade em um único vetor de variância
    const finalVariance = (regime.variance_multiplier || 1.0) * importanceMultiplier * volatilityMultiplier;
    
    for (let i = 0; i < iterations; i++) {
      // Aplicamos o intensityFactor e Urgency nas médias com a Variância Multimodal
      const hLambda = (metrics.homeMean * intensityFactor * homeUrgency) * (1 + (Math.random() - 0.5) * (finalVariance - 1));
      const aLambda = (metrics.awayMean * intensityFactor * awayUrgency) * (1 + (Math.random() - 0.5) * (finalVariance - 1));

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

  /**
   * Modelagem de Ambas Marcam (BTTS)
   */
  static modelBTTS(homeMean: number, awayMean: number, regime: RegimeProfile): { yes: number, no: number } {
    let yesCount = 0;
    const iterations = 1500;
    for (let i = 0; i < iterations; i++) {
      const h = this.poisson(homeMean);
      const a = this.poisson(awayMean);
      if (h > 0 && a > 0) yesCount++;
    }
    return { yes: yesCount / iterations, no: 1 - (yesCount / iterations) };
  }
}
