// ============================================================
// MODEL FACTORY v4.5 — INDUSTRIAL EDITION
// Suporte para 10.000 iterações, Modelos Proprietários e Tipagem Estrita
// ============================================================

import { RegimeProfile } from "@/lib/argos/regime/RegimeSchema";
import { LeagueProfile, LeagueValueScoreEngine } from "@/lib/argos/ingestion/LeagueValueScoreEngine";
import { ContextualFactorsEngine, ContextualFactors } from "@/lib/core/ContextualFactorsEngine";

export interface MarketMetrics {
  homeMean: number;
  awayMean: number;
  dispersion?: number;
}

export interface ExpectedOpportunityDensityModel {
  expectedEdge: number; // Expected Value (EV+)
  marketLiquidity: number; // Liquidez do mercado para o fixture
  volatility: number; // Volatilidade esperada
  opportunityScore: number; // Score combinado de oportunidade
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
  private static readonly DEFAULT_ITERATIONS = 10000;

  /**
   * Argos v5.0: EXPECTED OPPORTUNITY DENSITY MODEL (EODM)
   * 
   * Responsabilidade: Medir a densidade operacional e o potencial de CPU do fixture.
   * Atua como o "Market-Selection Engine" principal.
   */
  static calculateExpectedOpportunityDensity(
    fixture: any,
    leagueStats: LeagueProfile,
    marketContext: { saturation: number; calendarPressure: number },
    timeToKickoffMinutes: number
  ): ExpectedOpportunityDensityModel {
    const score = LeagueValueScoreEngine.evaluate({
      fixture,
      leagueStats,
      marketContext,
      timeToKickoffMinutes,
    });

    // O EODM agora foca na densidade de mercados e qualidade operacional
    const opportunityScore = score.operationalDensity;
    const marketLiquidity = score.liquidityScore;
    const volatility = score.dataQualityScore;

    return {
      expectedEdge: 0, // Argos v5.0: EV não é previsto aqui.
      marketLiquidity: parseFloat(marketLiquidity.toFixed(2)),
      volatility: parseFloat(volatility.toFixed(2)),
      opportunityScore: parseFloat(opportunityScore.toFixed(2)),
    };
  }


  /**
   * Simulação de Monte Carlo com contexto total (variáveis reais)
   */
  static runMonteCarloWithContext(
    metrics: MarketMetrics,
    regime: RegimeProfile,
    contextualFactors: ContextualFactors,
    iterations: number = ModelFactory.DEFAULT_ITERATIONS,
    marketType: "GOALS" | "CORNERS" | "CARDS" | "SHOTS" = "GOALS",
    elapsedTime: number = 0,
    currentScore: { home: number; away: number } = { home: 0, away: 0 }
  ): SimulationResult {
    // Argos v5.0: REMOVIDO ajuste de EV (expectedEdge) das médias de gols.
    // O Monte Carlo deve ser um modelo preditivo puro de probabilidades, 
    // não deve ser enviesado por uma expectativa de valor financeiro externa.
    const contextualMultiplier = ContextualFactorsEngine.calculateTotalContextualMultiplier(contextualFactors);

    // Aplicar multiplicador contextual aos métricas (Fatores reais de jogo)
    const adjustedMetrics: MarketMetrics = {
      homeMean: metrics.homeMean * contextualMultiplier,
      awayMean: metrics.awayMean * contextualMultiplier,
      dispersion: metrics.dispersion,
    };

    // Executar Monte Carlo com métricas ajustadas
    return this.runMonteCarlo(adjustedMetrics, regime, iterations, marketType, elapsedTime, currentScore);
  }

  /**
   * Simulação de Monte Carlo com 10.000 iterações
   * Suporta múltiplos mercados e ajustes de regime
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
    let totalScore = 0;
    let over25Count = 0;

    // 1. CÁLCULO DE TEMPO RESIDUAL (Time-Decay)
    const remainingTimeRatio = Math.max(0, (90 - elapsedTime) / 90);

    // 2. CURVA DE INTENSIDADE NÃO-LINEAR (Momento de Pressão)
    let pressureFactor = 1.0;
    if (elapsedTime > 75) {
      pressureFactor = 1.0 + (elapsedTime - 75) * 0.02;
    } else if (elapsedTime < 15) {
      pressureFactor = 1.15;
    }

    const intensityFactor = Math.pow(remainingTimeRatio, 1.1) * pressureFactor;

    // 3. FATOR DE IMPORTÂNCIA (World Cup Bias)
    const importanceMultiplier = regime.reasoning_tags?.includes("WORLD_CUP") ? 1.25 : 1.0;

    // 4. SHOCK & VOLATILITY ENGINE
    const goalDiff = currentScore.home - currentScore.away;
    const totalGoals = currentScore.home + currentScore.away;

    let homeUrgency = 1.0;
    let awayUrgency = 1.0;
    let volatilityMultiplier = 1.0;

    if (Math.abs(goalDiff) === 1 && totalGoals >= 2) {
      homeUrgency = 1.45;
      awayUrgency = 1.45;
      volatilityMultiplier = 1.35;
    } else if (goalDiff >= 2) {
      homeUrgency = 0.65;
      awayUrgency = 1.4;
    } else if (goalDiff <= -2) {
      homeUrgency = 1.4;
      awayUrgency = 0.65;
    } else if (goalDiff === 0 && elapsedTime > 70) {
      homeUrgency = 1.25;
      awayUrgency = 1.25;
    }

    // 5. TENSOR DE DECISÃO MULTIMODAL (Overdispersion Layer)
    // Argos v5.0: Estabilização via Fator de Variância Tier-based
    const tierVariance = regime.reasoning_tags?.includes("TIER_1") ? 1.05 : 1.25;
    const finalVariance = (regime.variance_multiplier || 1.0) * importanceMultiplier * volatilityMultiplier * tierVariance;

    for (let i = 0; i < iterations; i++) {
      // Argos v5.0: Negative Binomial Simulation (via Gamma-Poisson mixture)
      // Substitui o Poisson simples por uma distribuição mais estável para evitar subestimação de outliers.
      const hLambda = this.generateGamma(metrics.homeMean * intensityFactor * homeUrgency, finalVariance);
      const aLambda = this.generateGamma(metrics.awayMean * intensityFactor * awayUrgency, finalVariance);

      const hAddedScore = this.poisson(hLambda);
      const aAddedScore = this.poisson(aLambda);

      const finalHomeScore = currentScore.home + hAddedScore;
      const finalAwayScore = currentScore.away + aAddedScore;

      totalScore += hAddedScore + aAddedScore;
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
        under: 1 - over25Count / iterations,
      },
      iterations,
      expectedValue: totalScore / iterations,
    };
  }

  /**
   * Gerador Gamma para simular Overdispersion (Negative Binomial)
   */
  private static generateGamma(mean: number, varianceFactor: number): number {
    if (varianceFactor <= 1.0) return mean;
    
    // Simulação simplificada de Gamma: mean + ruído baseado na variância
    const alpha = mean / (varianceFactor - 1);
    const beta = varianceFactor - 1;
    
    // Aproximação de Gamma via amostragem centralizada
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
   * Modelagem específica para Escanteios
   */
  static modelCorners(homeAttack: number, awayDefense: number, regime: RegimeProfile): SimulationResult {
    const homeMean = homeAttack * 1.2;
    const awayMean = awayDefense * 0.8;
    return this.runMonteCarlo({ homeMean, awayMean }, regime, ModelFactory.DEFAULT_ITERATIONS, "CORNERS");
  }

  /**
   * Modelagem específica para Cartões
   */
  static modelCards(homeAggression: number, awayAggression: number, refereeStrictness: number, regime: RegimeProfile): SimulationResult {
    const homeMean = homeAggression * refereeStrictness;
    const awayMean = awayAggression * refereeStrictness;
    return this.runMonteCarlo({ homeMean, awayMean }, regime, ModelFactory.DEFAULT_ITERATIONS, "CARDS");
  }

  /**
   * Modelagem de Ambas Marcam (BTTS)
   */
  static modelBTTS(homeMean: number, awayMean: number, regime: RegimeProfile): { yes: number; no: number } {
    let yesCount = 0;
    const iterations = ModelFactory.DEFAULT_ITERATIONS;
    for (let i = 0; i < iterations; i++) {
      const h = this.poisson(homeMean);
      const a = this.poisson(awayMean);
      if (h > 0 && a > 0) yesCount++;
    }
    return { yes: yesCount / iterations, no: 1 - yesCount / iterations };
  }
}
