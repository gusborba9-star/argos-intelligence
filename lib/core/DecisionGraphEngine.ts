import { ClassifiedSignal } from "./SignalClassifierV4";

// ============================================================
// ARGOS DECISION GRAPH ENGINE v1.0
// Função: Transformar sinais em um grafo probabilístico de decisão
// Filosofia: NÃO decide "sim/não", apenas distribui probabilidade entre estados.
// ============================================================

export enum DecisionState {
  ACCEPT_VIP = "ACCEPT_VIP",
  ACCEPT_FREE = "ACCEPT_FREE",
  OBSERVE = "OBSERVE"
}

export interface DecisionNode {
  signalId: string;
  probability: number;
  expectedValue: number;
  confidence: number;
  edges: {
    to: DecisionState;
    weight: number;
  }[];
  finalDecision: DecisionState;
}

export class DecisionGraphEngine {
  /**
   * Processa sinais classificados e gera um grafo de decisão probabilístico.
   */
  static process(signals: ClassifiedSignal[]): DecisionNode[] {
    return signals.map(s => {
      const prob = s.probability ?? 0;
      const ev = s.expectedValue ?? 0;
      const conf = s.confidence_score ?? 0;

      // Cálculo de pesos para o grafo (probabilístico)
      const weights = this.calculateWeights(prob, ev, conf);

      // Decisão baseada no maior peso (mas mantendo o grafo para análise)
      const finalDecision = this.determineFinalState(weights);

      return {
        signalId: s.id || `sig_${Math.random().toString(36).substr(2, 9)}`,
        probability: prob,
        expectedValue: ev,
        confidence: conf,
        edges: [
          { to: DecisionState.ACCEPT_VIP, weight: weights.vip },
          { to: DecisionState.ACCEPT_FREE, weight: weights.free },
          { to: DecisionState.OBSERVE, weight: weights.observe }
        ],
        finalDecision
      };
    });
  }

  /**
   * Distribui pesos entre os estados possíveis.
   * Regra: Nunca bloqueia, apenas distribui.
   */
  private static calculateWeights(prob: number, ev: number, conf: number) {
    // Lógica de atribuição de pesos baseada em probabilidade e valor
    let vip = 0;
    let free = 0;
    let observe = 0;

    if (prob >= 0.75) {
      free = 0.8;
      vip = 0.2;
    } else if (prob >= 0.55 && ev > 0.02) {
      vip = 0.7;
      free = 0.1;
      observe = 0.2;
    } else {
      observe = 0.9;
      vip = 0.1;
    }

    // Normalização para garantir que a soma seja 1.0
    const total = vip + free + observe;
    return {
      vip: vip / total,
      free: free / total,
      observe: observe / total
    };
  }

  private static determineFinalState(weights: { vip: number, free: number, observe: number }): DecisionState {
    if (weights.free >= weights.vip && weights.free >= weights.observe) return DecisionState.ACCEPT_FREE;
    if (weights.vip >= weights.observe) return DecisionState.ACCEPT_VIP;
    return DecisionState.OBSERVE;
  }
}
