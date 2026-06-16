// ============================================================
// ASSERTIVITY OPTIMIZATION ENGINE v1.0 — ROI FOCUS
// Refina a seleção de sinais para máxima assertividade
// Cada sinal gerado deve ter probabilidade de sucesso > 65%
// ============================================================

import { ConsensusResult } from "@/lib/core/ConsensusEngine";
import { telemetryService } from "@/lib/core/TelemetryService";

export interface AssertivityScore {
  signalId: string;
  matchId: string;
  vertical: string;
  consensusScore: number; // 0-100
  convergencePercentage: number; // 0-100
  historicalAccuracy: number; // 0-100 (baseado em histórico)
  contextualBoost: number; // 0-50 (fatores externos)
  finalAssertivityScore: number; // 0-100
  shouldPublish: boolean; // true se > 65%
  riskLevel: "LOW" | "MEDIUM" | "HIGH"; // Classificação de risco
  recommendedStake: "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE"; // Recomendação de aposta
}

export class AssertivityOptimizationEngine {
  private readonly ASSERTIVITY_THRESHOLD = 65; // Mínimo para publicar sinal
  private readonly HIGH_CONFIDENCE_THRESHOLD = 85; // Sinal de alta confiança
  private readonly HISTORICAL_ACCURACY_WEIGHT = 0.3;
  private readonly CONSENSUS_WEIGHT = 0.5;
  private readonly CONTEXTUAL_WEIGHT = 0.2;

  private signalHistory: Map<string, { success: boolean; timestamp: number }[]> = new Map();

  /**
   * Calcula o score de assertividade de um sinal
   */
  public calculateAssertivityScore(
    signal: ConsensusResult,
    leagueId: string,
    contextualFactors: {
      isDerby: boolean;
      isTopMatch: boolean;
      hasKeyInjuries: boolean;
      weatherExtreme: boolean;
    }
  ): AssertivityScore {
    // 1. Componente de Consenso (50%)
    const consensusComponent = signal.consensusScore / 100;

    // 2. Componente de Acurácia Histórica (30%)
    const historicalAccuracy = this.getHistoricalAccuracy(leagueId);
    const historicalComponent = historicalAccuracy / 100;

    // 3. Componente Contextual (20%)
    let contextualBoost = 0;
    if (contextualFactors.isTopMatch) contextualBoost += 15; // Top matches têm mais dados
    if (contextualFactors.isDerby) contextualBoost += 10; // Derbies têm padrões previsíveis
    if (contextualFactors.hasKeyInjuries) contextualBoost -= 10; // Lesões reduzem previsibilidade
    if (contextualFactors.weatherExtreme) contextualBoost -= 5; // Clima extremo afeta o jogo

    const contextualComponent = Math.max(0, contextualBoost) / 100;

    // 4. Calcular score final ponderado
    const finalAssertivityScore =
      consensusComponent * this.CONSENSUS_WEIGHT +
      historicalComponent * this.HISTORICAL_ACCURACY_WEIGHT +
      contextualComponent * this.CONTEXTUAL_WEIGHT;

    const finalScore = Math.min(100, finalAssertivityScore * 100);

    // 5. Determinar risco e recomendação de stake
    const riskLevel = this.calculateRiskLevel(finalScore, signal.convergencePercentage);
    const recommendedStake = this.recommendStakeLevel(finalScore, riskLevel);

    const result: AssertivityScore = {
      signalId: `${signal.matchId}-${signal.vertical}`,
      matchId: signal.matchId,
      vertical: signal.vertical,
      consensusScore: signal.consensusScore,
      convergencePercentage: signal.convergencePercentage,
      historicalAccuracy,
      contextualBoost,
      finalAssertivityScore: finalScore,
      shouldPublish: finalScore >= this.ASSERTIVITY_THRESHOLD,
      riskLevel,
      recommendedStake,
    };

    console.log(
      `[AssertivityOptimizationEngine] Sinal ${result.signalId}: Assertividade=${finalScore.toFixed(2)}% | Risco=${riskLevel} | Publicar=${result.shouldPublish}`
    );

    // Registrar na telemetria
    telemetryService.recordEvent({
      eventType: "SIMULATION_END",
      matchId: signal.matchId,
      metadata: {
        assertivityScore: finalScore,
        shouldPublish: result.shouldPublish,
        riskLevel,
      },
    });

    return result;
  }

  /**
   * Calcula o nível de risco baseado no score e convergência
   */
  private calculateRiskLevel(assertivityScore: number, convergence: number): "LOW" | "MEDIUM" | "HIGH" {
    if (assertivityScore >= this.HIGH_CONFIDENCE_THRESHOLD && convergence >= 85) {
      return "LOW";
    } else if (assertivityScore >= this.ASSERTIVITY_THRESHOLD && convergence >= 70) {
      return "MEDIUM";
    } else {
      return "HIGH";
    }
  }

  /**
   * Recomenda o nível de stake baseado no risco
   */
  private recommendStakeLevel(assertivityScore: number, riskLevel: "LOW" | "MEDIUM" | "HIGH"): "CONSERVATIVE" | "MODERATE" | "AGGRESSIVE" {
    if (riskLevel === "LOW" && assertivityScore >= 90) {
      return "AGGRESSIVE";
    } else if (riskLevel === "LOW" || (riskLevel === "MEDIUM" && assertivityScore >= 80)) {
      return "MODERATE";
    } else {
      return "CONSERVATIVE";
    }
  }

  /**
   * Retorna a acurácia histórica de uma liga
   */
  private getHistoricalAccuracy(leagueId: string): number {
    const history = this.signalHistory.get(leagueId) || [];

    if (history.length === 0) {
      return 70; // Valor padrão para ligas sem histórico
    }

    // Calcular acurácia baseada nos últimos 100 sinais
    const recentHistory = history.slice(-100);
    const successCount = recentHistory.filter((h) => h.success).length;
    const accuracy = (successCount / recentHistory.length) * 100;

    return Math.min(100, accuracy);
  }

  /**
   * Registra o resultado de um sinal (sucesso ou fracasso)
   */
  public recordSignalResult(leagueId: string, success: boolean): void {
    if (!this.signalHistory.has(leagueId)) {
      this.signalHistory.set(leagueId, []);
    }

    const history = this.signalHistory.get(leagueId)!;
    history.push({ success, timestamp: Date.now() });

    // Manter apenas os últimos 500 resultados por liga
    if (history.length > 500) {
      history.shift();
    }

    console.log(
      `[AssertivityOptimizationEngine] Resultado registrado para ${leagueId}: ${success ? "✅ SUCESSO" : "❌ FRACASSO"}`
    );
  }

  /**
   * Filtra sinais por assertividade mínima
   */
  public filterHighAssertivitySignals(signals: AssertivityScore[], minAssertivity: number = 75): AssertivityScore[] {
    const filtered = signals.filter((s) => s.finalAssertivityScore >= minAssertivity);

    console.log(
      `[AssertivityOptimizationEngine] Filtragem de alta assertividade: ${filtered.length}/${signals.length} sinais acima de ${minAssertivity}%`
    );

    return filtered;
  }

  /**
   * Retorna estatísticas de assertividade por liga
   */
  public getLeagueAssertivityStats(leagueId: string): {
    leagueId: string;
    historicalAccuracy: number;
    totalSignalsRecorded: number;
    successRate: number;
  } {
    const history = this.signalHistory.get(leagueId) || [];
    const successCount = history.filter((h) => h.success).length;
    const successRate = history.length > 0 ? (successCount / history.length) * 100 : 0;

    return {
      leagueId,
      historicalAccuracy: this.getHistoricalAccuracy(leagueId),
      totalSignalsRecorded: history.length,
      successRate,
    };
  }

  /**
   * Log detalhado de assertividade
   */
  public logAssertivityStatus(): void {
    console.log("\n╔════════════════════════════════════════════════════════╗");
    console.log("║     ASSERTIVITY OPTIMIZATION ENGINE — STATUS         ║");
    console.log("╚════════════════════════════════════════════════════════╝");
    console.log(`📊 Ligas Monitoradas: ${this.signalHistory.size}`);

    for (const [leagueId, history] of this.signalHistory.entries()) {
      const stats = this.getLeagueAssertivityStats(leagueId);
      console.log(
        `   ${leagueId}: ${stats.successRate.toFixed(2)}% acurácia (${stats.totalSignalsRecorded} sinais)`
      );
    }

    console.log("");
  }
}

// Singleton global
export const assertivityOptimizationEngine = new AssertivityOptimizationEngine();
