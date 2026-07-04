// ============================================================
// SIGNAL TIER CLASSIFIER v6.1 — DEBUG UTILITY
// MUDANÇA: Atua apenas como utilitário auxiliar de logging/debug.
// Não decide o output final do pipeline (responsabilidade do SignalClassifierV4).
// ============================================================

import { ArgosSignal } from "@/lib/core/contracts/SignalContract";

export interface ClassifiedSignals {
  free: (ArgosSignal & { tier: "FREE" })[];
  vip: (ArgosSignal & { tier: "VIP" })[];
  rejected: ArgosSignal[];
}

/**
 * SIGNAL TIER CLASSIFIER v6.1 (DEBUG UTILITY)
 *
 * Este utilitário deve ser usado apenas para análise secundária e logs.
 * A decisão final de entrega e ranking é feita no SignalClassifierV4.
 */
export class SignalTierClassifier {
  private readonly FREE_THRESHOLD = 0.70; // Sincronizado com v4.3
  private readonly VIP_THRESHOLD = 0.50;  // Sincronizado com v4.3

  /**
   * Classifica sinais para fins de LOG e DEBUG.
   * NÃO use este método para filtrar o output final do sistema.
   */
  public classify(signals: ArgosSignal[]): ClassifiedSignals {
    const classified: ClassifiedSignals = {
      free: [],
      vip: [],
      rejected: [],
    };

    for (const signal of signals) {
      if (signal.probability >= this.FREE_THRESHOLD) {
        classified.free.push({ ...signal, tier: "FREE" });
        classified.vip.push({ ...signal, tier: "VIP" });
      } else if (signal.probability >= this.VIP_THRESHOLD) {
        classified.vip.push({ ...signal, tier: "VIP" });
      } else {
        classified.rejected.push(signal);
      }
    }

    // Log informativo para observabilidade
    console.log(
      `[DEBUG-SignalTier] Análise Secundária: ${classified.free.length} FREE, ${classified.vip.length} VIP, ${classified.rejected.length} ABAIXO_THRESHOLD`
    );

    return classified;
  }

  /**
   * Métodos utilitários de cálculo matemático (permanecem válidos)
   */
  public calculateProbability(
    poissonProb: number,
    historicalAccuracy: number,
    contextFactor: number = 1.0
  ): number {
    const combined = poissonProb * 0.6 + historicalAccuracy * 0.3 + (contextFactor * 100) * 0.1;
    return Math.min(1, Math.max(0, combined / 100));
  }

  public calculateEV(probability: number, odds: number): number {
    return probability * odds - 1;
  }

  public getStats(signals: ArgosSignal[]) {
    if (signals.length === 0) return { total: 0 };
    const avgProb = signals.reduce((sum, s) => sum + s.probability, 0) / signals.length;
    const highConfidence = signals.filter((s) => s.confidence === "HIGH").length;
    const withEV = signals.filter((s) => s.ev && s.ev > 0).length;

    return {
      total: signals.length,
      averageProbability: (avgProb * 100).toFixed(1),
      highConfidenceCount: highConfidence,
      withEVPlus: withEV,
      evPlusPercentage: ((withEV / signals.length) * 100).toFixed(1),
    };
  }
}

export const signalTierClassifier = new SignalTierClassifier();
