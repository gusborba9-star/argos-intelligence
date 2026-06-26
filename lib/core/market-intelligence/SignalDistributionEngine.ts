import { Opportunity } from "./MarketDiscoveryEngine";
import { RegimeProfile } from "@/lib/argos/regime/RegimeSchema";

// ============================================================
// SIGNAL DISTRIBUTION ENGINE v6.0.0 — SYNDICATE MASTER EDITION
//
// FREE:
//   - Objetivo: retenção e marketing
//   - Máximo 2 mercados por jogo
//   - Alta probabilidade (>= 72%)
//   - Sinais visualmente fortes
//   - Pode existir sem EV positivo
//   - Não entrega toda a inteligência
//
// VIP:
//   - Recebe todos os mercados com EV+
//   - Edge, Fair Odds, análise profunda
//   - Contexto RAG, confiança, Kelly Fractional
// ============================================================

export interface DistributedSignal extends Opportunity {
  tier: "FREE" | "VIP" | "NONE";
  priority: number;
  marketingCTA?: string;
  displayLabel?: string;
}

// Thresholds Syndicate Master
const FREE_MIN_PROBABILITY = 0.72;   // Prob mínima para sinal FREE (alta assertividade)
const FREE_MAX_SIGNALS = 2;          // Máximo de sinais FREE por partida
const VIP_MIN_PROBABILITY = 0.52;    // Prob mínima para sinal VIP
const VIP_MIN_EV = 0.04;             // EV mínimo para sinal VIP (4%)
const VIP_MIN_EDGE = 0.04;           // Edge mínimo para sinal VIP

export class SignalDistributionEngine {
  /**
   * Classifica e distribui sinais com base nas regras Syndicate Master.
   * FREE: retenção/marketing — VIP: inteligência completa com EV+.
   */
  public static process(
    opportunities: Opportunity[],
    regime: RegimeProfile
  ): DistributedSignal[] {
    const distributed: DistributedSignal[] = [];
    let freeCount = 0;

    // Ordena por prioridade composta: Edge (60%) + Confiança (40%)
    const sortedOps = [...opportunities].sort((a, b) => {
      const priorityA = a.edge * 0.6 + a.confidence * 0.4;
      const priorityB = b.edge * 0.6 + b.confidence * 0.4;
      return priorityB - priorityA;
    });

    for (const op of sortedOps) {
      const priority = op.edge * 0.6 + op.confidence * 0.4;
      let tier: "FREE" | "VIP" | "NONE" = "NONE";

      // ── VIP: Todos os mercados com EV+ e edge consistente ──────────────
      // Recebe análise profunda: EV, Edge, Fair Odds, Kelly, contexto RAG
      const isVip =
        op.probability >= VIP_MIN_PROBABILITY &&
        op.expectedValue >= VIP_MIN_EV &&
        op.edge >= VIP_MIN_EDGE;

      if (isVip) {
        tier = "VIP";
      }

      // ── FREE: Alta probabilidade — isca de marketing ───────────────────
      // Pode existir sem EV positivo (objetivo é retenção, não lucro direto)
      // Limitado a no máximo FREE_MAX_SIGNALS por partida
      const isFree =
        op.probability >= FREE_MIN_PROBABILITY &&
        freeCount < FREE_MAX_SIGNALS;

      if (isFree) {
        tier = "FREE";
        freeCount++;
      }

      if (tier !== "NONE") {
        distributed.push({
          ...op,
          tier,
          priority,
          displayLabel: this.buildDisplayLabel(op, tier),
          marketingCTA:
            tier === "FREE"
              ? "🔥 SINAL FREE DE ALTA CONFIANÇA! Acesse o VIP para todos os mercados com Edge real."
              : undefined,
        });
      }
    }

    // Ordena resultado final por prioridade (VIP primeiro, depois FREE)
    return distributed.sort((a, b) => {
      if (a.tier === "VIP" && b.tier === "FREE") return -1;
      if (a.tier === "FREE" && b.tier === "VIP") return 1;
      return b.priority - a.priority;
    });
  }

  /**
   * Constrói um label de exibição legível para o sinal.
   */
  private static buildDisplayLabel(op: Opportunity, tier: "FREE" | "VIP"): string {
    const prob = (op.probability * 100).toFixed(0);
    const ev = (op.edgePercent ?? op.edge * 100).toFixed(1);
    if (tier === "VIP") {
      return `${op.vertical} | ${op.selection} @ ${op.odd.toFixed(2)} | EV: +${ev}% | Prob: ${prob}%`;
    }
    return `${op.vertical} | ${op.selection} @ ${op.odd.toFixed(2)} | Confiança: ${prob}%`;
  }
}
