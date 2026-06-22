// ============================================================
// SIGNAL TIER CLASSIFIER v6.0 — Zero Veto Approach
// Classifica sinais por tier: FREE (75%+) vs VIP (55%+)
// ============================================================

import { TelegramSignal } from "@/lib/argos/notifications/TelegramDispatcher";

export interface ClassifiedSignals {
  free: TelegramSignal[];
  vip: TelegramSignal[];
  rejected: TelegramSignal[];
}

/**
 * SIGNAL TIER CLASSIFIER v6.0
 *
 * Filosofia: NUNCA descartar oportunidades
 * - FREE: Apenas sinais com probabilidade > 75% (Marketing puro)
 * - VIP: TUDO com probabilidade > 55% (Sem filtro absoluto, máximo volume)
 * - REJECTED: Apenas abaixo de 55% (ruído definitivo)
 *
 * Nota: Argos sempre processa TUDO e entrega para VIP.
 * FREE é apenas a versão mais assertiva para validação do modelo.
 */
export class SignalTierClassifier {
  private readonly FREE_THRESHOLD = 0.75; // 75%+
  private readonly VIP_THRESHOLD = 0.55; // 55%+
  private readonly REJECTED_THRESHOLD = 0.55; // < 55% = ruído

  /**
   * Classifica sinais por tier
   */
  public classify(signals: TelegramSignal[]): ClassifiedSignals {
    const classified: ClassifiedSignals = {
      free: [],
      vip: [],
      rejected: [],
    };

    for (const signal of signals) {
      if (signal.probability >= this.FREE_THRESHOLD) {
        // Tier FREE: Alta assertividade
        classified.free.push({
          ...signal,
          tier: "FREE",
        });

        // Também vai para VIP (VIP recebe tudo + mais)
        classified.vip.push({
          ...signal,
          tier: "VIP",
        });
      } else if (signal.probability >= this.VIP_THRESHOLD) {
        // Tier VIP: Volume de oportunidades
        classified.vip.push({
          ...signal,
          tier: "VIP",
        });
      } else {
        // Rejected: Ruído
        classified.rejected.push(signal);
      }
    }

    console.log(
      `[SignalTierClassifier] Classificação: ${classified.free.length} FREE, ${classified.vip.length} VIP, ${classified.rejected.length} REJECTED`
    );

    return classified;
  }

  /**
   * Valida se um sinal é entregável (mesmo critério de VIP)
   */
  public isDeliverable(probability: number): boolean {
    return probability >= this.VIP_THRESHOLD;
  }

  /**
   * Calcula a probabilidade de um sinal
   * Baseado em: Distribuição Poisson + Historical Accuracy + Context
   */
  public calculateProbability(
    poissonProb: number,
    historicalAccuracy: number,
    contextFactor: number = 1.0
  ): number {
    // Weighted average: 60% Poisson + 30% Historical + 10% Context
    const combined =
      poissonProb * 0.6 + historicalAccuracy * 0.3 + (contextFactor * 100) * 0.1;

    // Normalizar para 0-1
    return Math.min(1, Math.max(0, combined / 100));
  }

  /**
   * Calcula Expected Value (EV) para um sinal
   * EV = (Prob × Odds) - 1
   */
  public calculateEV(probability: number, odds: number): number {
    return probability * odds - 1;
  }

  /**
   * Recomenda um sinal para qual tier
   */
  public recommendTier(probability: number): "FREE" | "VIP" | "REJECTED" {
    if (probability >= this.FREE_THRESHOLD) {
      return "FREE";
    } else if (probability >= this.VIP_THRESHOLD) {
      return "VIP";
    }
    return "REJECTED";
  }

  /**
   * Estatísticas de uma batch de sinais
   */
  public getStats(signals: TelegramSignal[]) {
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
