// ============================================================
// CONSENSUS ENGINE v1.0 — VOTAÇÃO PONDERADA ENTRE MODELOS
// Sinais validados como VIP apenas com > 85% convergência
// ============================================================

import { MarketVertical } from "@/lib/core/ArgosUnifiedEngine";
import { telemetryService } from "@/lib/core/TelemetryService";

export interface ModelPrediction {
  modelName: "POISSON" | "ELO" | "MONTE_CARLO" | "RAG" | "REGRESSOR";
  prediction: number; // Probabilidade 0-1
  confidence: number; // Confiança 0-1
  weight: number; // Peso do modelo 0-1
}

export interface ConsensusResult {
  matchId: string;
  vertical: MarketVertical;
  consensusScore: number; // 0-100
  convergencePercentage: number; // 0-100
  isVipSignal: boolean; // true se convergência > 85%
  predictions: ModelPrediction[];
  finalPrediction: number;
  reasoning: string;
}

export class ConsensusEngine {
  private readonly CONVERGENCE_THRESHOLD_VIP = 85; // 85% para VIP
  private readonly CONVERGENCE_THRESHOLD_PRO = 70; // 70% para PRO
  private readonly CONVERGENCE_THRESHOLD_FREE = 60; // 60% para Free

  /**
   * Executa votação ponderada entre múltiplos modelos
   */
  async runConsensusVoting(
    matchId: string,
    vertical: MarketVertical,
    predictions: ModelPrediction[]
  ): Promise<ConsensusResult> {
    try {
      console.log(
        `[ConsensusEngine] Iniciando votação para ${matchId} - ${vertical}. Modelos: ${predictions.length}`
      );

      // 1. Validar que temos pelo menos 3 modelos
      if (predictions.length < 3) {
        throw new Error(`Mínimo de 3 modelos necessários. Recebido: ${predictions.length}`);
      }

      // 2. Calcular predição final ponderada
      const finalPrediction = this.calculateWeightedPrediction(predictions);

      // 3. Calcular convergência (desvio padrão das previsões)
      const convergencePercentage = this.calculateConvergence(predictions, finalPrediction);

      // 4. Determinar se é sinal VIP
      const isVipSignal = convergencePercentage >= this.CONVERGENCE_THRESHOLD_VIP;

      // 5. Gerar reasoning
      const reasoning = this.generateReasoning(predictions, convergencePercentage, isVipSignal);

      const result: ConsensusResult = {
        matchId,
        vertical,
        consensusScore: finalPrediction * 100,
        convergencePercentage,
        isVipSignal,
        predictions,
        finalPrediction,
        reasoning,
      };

      console.log(
        `[ConsensusEngine] Votação concluída. Convergência: ${convergencePercentage.toFixed(2)}% | VIP: ${isVipSignal ? "✅" : "❌"}`
      );

      // 6. Registrar na telemetria
      telemetryService.recordEvent({
        eventType: "CONSENSUS_VOTING",
        matchId,
        details: `Convergence: ${convergencePercentage.toFixed(2)}% | VIP: ${isVipSignal}`,
      });

      return result;
    } catch (error: any) {
      console.error(`[ConsensusEngine] Erro na votação:`, error.message);
      throw error;
    }
  }

  /**
   * Calcula a predição final ponderada
   */
  private calculateWeightedPrediction(predictions: ModelPrediction[]): number {
    const totalWeight = predictions.reduce((sum, p) => sum + p.weight, 0);

    if (totalWeight === 0) {
      throw new Error("Total weight cannot be zero");
    }

    const weightedSum = predictions.reduce((sum, p) => sum + p.prediction * p.weight, 0);
    return weightedSum / totalWeight;
  }

  /**
   * Calcula a convergência entre modelos (quanto maior, melhor)
   * Usa o inverso do coeficiente de variação
   */
  private calculateConvergence(predictions: ModelPrediction[], finalPrediction: number): number {
    // Calcular desvio padrão das previsões
    const mean = finalPrediction;
    const variance = predictions.reduce((sum, p) => sum + Math.pow(p.prediction - mean, 2), 0) / predictions.length;
    const stdDev = Math.sqrt(variance);

    // Coeficiente de variação (CV)
    const cv = mean !== 0 ? stdDev / mean : stdDev;

    // Convergência: quanto menor o CV, maior a convergência
    // Fórmula: 1 - min(CV, 1) = 1 - CV (limitado a 0-1)
    const convergence = Math.max(0, 1 - cv) * 100;

    console.log(`[ConsensusEngine] Análise de convergência: StdDev=${stdDev.toFixed(4)}, CV=${cv.toFixed(4)}, Convergência=${convergence.toFixed(2)}%`);

    return convergence;
  }

  /**
   * Gera reasoning explicativo da votação
   */
  private generateReasoning(
    predictions: ModelPrediction[],
    convergencePercentage: number,
    isVipSignal: boolean
  ): string {
    const modelsSorted = predictions.sort((a, b) => b.confidence - a.confidence);
    const topModels = modelsSorted.slice(0, 2).map((p) => `${p.modelName} (${(p.confidence * 100).toFixed(0)}%)`).join(", ");

    let reasoning = `Votação entre ${predictions.length} modelos. Modelos com maior confiança: ${topModels}. `;
    reasoning += `Convergência: ${convergencePercentage.toFixed(2)}%. `;

    if (isVipSignal) {
      reasoning += "✅ SINAL VIP: Convergência acima de 85% - Alta confiabilidade.";
    } else if (convergencePercentage >= this.CONVERGENCE_THRESHOLD_PRO) {
      reasoning += "⚠️ SINAL PRO: Convergência entre 70-85% - Confiabilidade moderada.";
    } else {
      reasoning += "❌ SINAL LIVRE: Convergência abaixo de 70% - Baixa confiabilidade.";
    }

    return reasoning;
  }

  /**
   * Filtra sinais por nível de convergência (para diferentes tiers)
   */
  filterSignalsByTier(
    signals: ConsensusResult[],
    tier: "FREE" | "PRO" | "WHALE"
  ): ConsensusResult[] {
    const thresholds: Record<string, number> = {
      FREE: this.CONVERGENCE_THRESHOLD_FREE,
      PRO: this.CONVERGENCE_THRESHOLD_PRO,
      WHALE: this.CONVERGENCE_THRESHOLD_VIP,
    };

    const threshold = thresholds[tier];
    const filtered = signals.filter((s) => s.convergencePercentage >= threshold);

    console.log(
      `[ConsensusEngine] Filtragem para tier ${tier}: ${filtered.length}/${signals.length} sinais acima de ${threshold}%`
    );

    return filtered;
  }

  /**
   * Executa votação em batch para múltiplos matchIds
   */
  async runBatchConsensusVoting(
    matches: Array<{ matchId: string; vertical: MarketVertical; predictions: ModelPrediction[] }>
  ): Promise<ConsensusResult[]> {
    console.log(`[ConsensusEngine] Iniciando votação em batch para ${matches.length} jogos...`);

    const results = await Promise.allSettled(
      matches.map((match) =>
        this.runConsensusVoting(match.matchId, match.vertical, match.predictions)
      )
    );

    const successfulResults = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => (r as PromiseFulfilledResult<ConsensusResult>).value);

    console.log(
      `[ConsensusEngine] Votação em batch concluída: ${successfulResults.length}/${matches.length} bem-sucedidas`
    );

    return successfulResults;
  }
}

export const consensusEngine = new ConsensusEngine();
