import { MarketVertical, ArgosSignal } from "@/lib/core/contracts/SignalContract";

interface MarketOdds {
  [key: string]: number; // Ex: { "HOME_WIN": 2.05, "DRAW": 3.40, "AWAY_WIN": 3.75 }
}

export class AnomalyDetectionService {
  private brierScoreThreshold: number = 0.05; // Exemplo: 5% de diferença no Brier Score
  private oddsDiscrepancyThreshold: number = 0.10; // Exemplo: 10% de diferença nas odds implícitas

  constructor() {}

  /**
   * Compara as probabilidades do modelo com as odds de mercado para detectar anomalias.
   * @param signals Sinais gerados pelo Argos (probabilidades do modelo).
   * @param marketOdds Odds de mercado para os mesmos mercados.
   * @returns Uma lista de alertas de anomalia, se houver.
   */
  public detectAnomalies(
    signals: ArgosSignal[],
    marketOdds: MarketOdds
  ): string[] {
    const alerts: string[] = [];

    for (const signal of signals) {
      const marketKey = signal.market; // Ex: "HOME_WIN"
      const modelProbability = signal.probability;

      if (marketOdds[marketKey]) {
        const marketOdd = marketOdds[marketKey];
        const impliedMarketProbability = 1 / marketOdd;

        // Lógica de Valor 1: Brier Score
        // O Brier Score mede a precisão das previsões probabilísticas.
        // Um Brier Score menor indica melhor calibração.
        // Aqui, estamos usando uma variação para detectar discrepâncias significativas.
        const brierScoreDifference = Math.abs(modelProbability - impliedMarketProbability);
        if (brierScoreDifference > this.brierScoreThreshold) {
          alerts.push(
            `[ALERTA - Brier Score] matchId: ${signal.matchId}, Vertical: ${signal.vertical}, Mercado: ${marketKey}, ` +
            `Prob. Modelo: ${modelProbability.toFixed(4)}, Prob. Mercado: ${impliedMarketProbability.toFixed(4)}, ` +
            `Diferença: ${brierScoreDifference.toFixed(4)} (Threshold: ${this.brierScoreThreshold.toFixed(4)})`
          );
        }

        // Lógica de Valor 2: Discrepância de Odds
        // Compara a odd implícita do modelo com a odd de mercado.
        const modelImpliedOdd = 1 / modelProbability;
        const oddsDiscrepancy = Math.abs(modelImpliedOdd - marketOdd) / marketOdd;
        if (oddsDiscrepancy > this.oddsDiscrepancyThreshold) {
          alerts.push(
            `[ALERTA - Discrepância de Odds] matchId: ${signal.matchId}, Vertical: ${signal.vertical}, Mercado: ${marketKey}, ` +
            `Odd Modelo: ${modelImpliedOdd.toFixed(2)}, Odd Mercado: ${marketOdd.toFixed(2)}, ` +
            `Diferença: ${(oddsDiscrepancy * 100).toFixed(2)}% (Threshold: ${(this.oddsDiscrepancyThreshold * 100).toFixed(2)}%)`
          );
        }
      }
    }
    return alerts;
  }

  // TODO: Implementar lógica para thresholds dinâmicos baseados em regime ou histórico.
  // Por enquanto, os thresholds são fixos.
  
}
