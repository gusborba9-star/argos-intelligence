import { ArgosSignal } from "@/lib/core/contracts/SignalContract";

export interface LiquidityMetrics {
  market: string;
  estimated_volume: number; // Volume estimado em unidades de aposta
  liquidity_score: number; // 0-100, onde 100 é máxima liquidez
  is_liquid: boolean; // true se > threshold
}

export interface SyndicateLevelSignal extends ArgosSignal {
  clv_potential: number; // Potencial de CLV (Closing Line Value)
  liquidity_score: number;
  is_syndicate_worthy: boolean; // true se passa nos critérios de sindicato
  risk_adjusted_ev: number; // EV ajustado pelo risco de liquidez
}

export class SyndicateLevelOptimizer {
  private liquidityThreshold: number = 70; // Threshold mínimo de liquidez
  private clvThreshold: number = 0.02; // CLV mínimo de 2%
  private minVolumeThreshold: number = 1000; // Volume mínimo em unidades

  constructor() {}

  /**
   * Avalia se um sinal atende aos critérios de "Syndicate-Level".
   * Critérios:
   * - Liquidez > 70%
   * - CLV Potencial > 2%
   * - Volume > 1000 unidades
   * - EV > 0.05 (5%)
   * @param signal Sinal a ser avaliado.
   * @param liquidityMetrics Métricas de liquidez do mercado.
   * @returns Sinal enriquecido com análise de sindicato.
   */
  public evaluateForSyndicate(
    signal: ArgosSignal,
    liquidityMetrics: LiquidityMetrics
  ): SyndicateLevelSignal {
    const clvPotential = this.estimateCLVPotential(signal);
    const riskAdjustedEV = signal.expectedValue * (liquidityMetrics.liquidity_score / 100);

    const isSyndicateWorthy =
      liquidityMetrics.liquidity_score >= this.liquidityThreshold &&
      clvPotential >= this.clvThreshold &&
      liquidityMetrics.estimated_volume >= this.minVolumeThreshold &&
      signal.expectedValue > 0.05;

    return {
      ...signal,
      clv_potential: clvPotential,
      liquidity_score: liquidityMetrics.liquidity_score,
      is_syndicate_worthy: isSyndicateWorthy,
      risk_adjusted_ev: riskAdjustedEV
    };
  }

  /**
   * Estima o potencial de CLV (Closing Line Value) de um sinal.
   * CLV é a diferença entre a odd no momento da aposta e a odd de fechamento.
   * @param signal Sinal a ser avaliado.
   * @returns Potencial de CLV como percentual.
   */
  private estimateCLVPotential(signal: ArgosSignal): number {
    // Heurística: sinais com alta confiança tendem a ter CLV positivo
    // Estimamos CLV como uma função da probabilidade e do EV
    const confidenceBoost = signal.probability > 0.7 ? 0.03 : signal.probability > 0.6 ? 0.02 : 0.01;
    const evBoost = signal.expectedValue > 0.1 ? 0.02 : signal.expectedValue > 0.05 ? 0.01 : 0;

    return confidenceBoost + evBoost;
  }

  /**
   * Filtra sinais para apenas aqueles que atendem aos critérios de sindicato.
   * @param signals Lista de sinais.
   * @param liquidityMap Mapa de liquidez por mercado.
   * @returns Sinais filtrados e enriquecidos.
   */
  public filterForSyndicate(
    signals: ArgosSignal[],
    liquidityMap: Record<string, LiquidityMetrics>
  ): SyndicateLevelSignal[] {
    return signals
      .map(signal => {
        const liquidity = liquidityMap[signal.market] || {
          market: signal.market,
          estimated_volume: 0,
          liquidity_score: 0,
          is_liquid: false
        };
        return this.evaluateForSyndicate(signal, liquidity);
      })
      .filter(signal => signal.is_syndicate_worthy);
  }

  /**
   * Calcula um "Syndicate Score" para priorização de sinais.
   * Pontuação leva em conta: EV, CLV, Liquidez e Confiança.
   * @param signal Sinal enriquecido de sindicato.
   * @returns Score de 0-100.
   */
  public calculateSyndicateScore(signal: SyndicateLevelSignal): number {
    const evScore = Math.min(signal.expectedValue * 1000, 40); // Até 40 pontos por EV
    const clvScore = signal.clv_potential * 1000; // Até 30 pontos por CLV (assumindo max 0.03)
    const liquidityScore = (signal.liquidity_score / 100) * 20; // Até 20 pontos por liquidez
    const confidenceScore = signal.probability * 10; // Até 10 pontos por confiança

    return Math.min(evScore + clvScore + liquidityScore + confidenceScore, 100);
  }

  /**
   * Ordena sinais por "Syndicate Score" (maior primeiro).
   * @param signals Lista de sinais enriquecidos.
   * @returns Sinais ordenados por score.
   */
  public rankByScore(signals: SyndicateLevelSignal[]): SyndicateLevelSignal[] {
    return signals
      .map(signal => ({
        ...signal,
        syndicateScore: this.calculateSyndicateScore(signal)
      }))
      .sort((a, b) => (b as any).syndicateScore - (a as any).syndicateScore);
  }
}
