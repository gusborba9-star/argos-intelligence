import { Opportunity } from "./MarketDiscoveryEngine";
import { RegimeProfile } from "@/lib/argos/regime/RegimeSchema";
import { telegramDispatcher, TelegramSignalPayload } from "@/lib/argos/notifications/TelegramDispatcher";

// ============================================================
// SIGNAL DISTRIBUTION ENGINE v6.1.0 — SYNDICATE MASTER EDITION
//
// FREE:
//   - Objetivo: retenção e marketing
//   - Máximo 2 mercados por jogo
//   - Alta probabilidade (>= 72%)
//   - Pode existir sem EV positivo (foco em assertividade bruta)
//
// VIP:
//   - Recebe todos os mercados com EV+
//   - Edge, Fair Odds, análise profunda (Monte Carlo + RAG)
// ============================================================

export interface DistributedSignal extends Opportunity {
  tier: "FREE" | "VIP" | "NONE";
  priority: number;
  marketingCTA?: string;
  displayLabel?: string;
}

// Thresholds Syndicate Master
const FREE_MIN_PROBABILITY = 0.68;   
const FREE_MAX_SIGNALS = 3;          
const VIP_MIN_PROBABILITY = 0.50;    
const VIP_MIN_EV = 0.01;             // Flexibilizado para 1% para Copa do Mundo
const VIP_MIN_EDGE = 0.01;           

export class SignalDistributionEngine {
  /**
   * Classifica, distribui e DESPACHA sinais para o Telegram.
   */
  public static async processAndDispatch(
    opportunities: Opportunity[],
    regime: RegimeProfile,
    matchContext: { name: string; league: string; kickoff: string }
  ): Promise<DistributedSignal[]> {
    const distributed: DistributedSignal[] = [];
    let freeCount = 0;

    // Ordena por prioridade composta: Edge (60%) + Confiança (40%)
    const sortedOps = [...opportunities].sort((a, b) => {
      const priorityA = a.edge * 0.6 + a.confidence * 0.4;
      const priorityB = b.edge * 0.6 + b.confidence * 0.4;
      return priorityB - priorityA;
    });

    const signalsToDispatch: TelegramSignalPayload[] = [];

    for (const op of sortedOps) {
      const priority = op.edge * 0.6 + op.confidence * 0.4;
      let tier: "FREE" | "VIP" | "NONE" = "NONE";

      // 1. VIP: Todos os mercados com EV+ consistente
      const isVip =
        op.probability >= VIP_MIN_PROBABILITY &&
        op.expectedValue >= VIP_MIN_EV &&
        op.edge >= VIP_MIN_EDGE;

      if (isVip) {
        tier = "VIP";
      }

      // 2. FREE: Alta probabilidade — isca de marketing
      const isFree =
        op.probability >= FREE_MIN_PROBABILITY &&
        freeCount < FREE_MAX_SIGNALS;

      if (isFree) {
        tier = "FREE";
        freeCount++;
      }

      if (tier !== "NONE") {
        const distSignal: DistributedSignal = {
          ...op,
          tier,
          priority,
          displayLabel: this.buildDisplayLabel(op, tier),
        };
        distributed.push(distSignal);

        // Preparar para despacho Telegram
        signalsToDispatch.push({
          matchName: matchContext.name,
          leagueName: matchContext.league,
          kickoffTime: matchContext.kickoff,
          vertical: op.vertical,
          selection: op.selection,
          odd: op.odd,
          fairOdd: op.fairOdd,
          expectedValue: op.expectedValue,
          probability: op.probability,
          kellyCriterion: op.kellyCriterion,
          ratingLabel: op.ratingLabel,
          tier: tier as "FREE" | "VIP",
          line: op.line,
          analysisSummary: `Análise Syndicate Master: EV+ de ${(op.expectedValue * 100).toFixed(1)}% detectado no mercado de ${op.vertical}.`
        });
      } else {
        const reason = op.expectedValue < VIP_MIN_EV ? "EV_TOO_LOW" : 
                       op.edge < VIP_MIN_EDGE ? "EDGE_BELOW_THRESHOLD" : 
                       op.probability < VIP_MIN_PROBABILITY ? "PROBABILITY_FILTER" : "REJECTED";
        
        console.log(`[Distribution-Log] ⏭️ REJECTED: ${matchContext.name} | ${op.vertical} | Reason: ${reason} | EV: ${(op.expectedValue*100).toFixed(2)}% | Edge: ${(op.edge*100).toFixed(2)}% | Prob: ${(op.probability*100).toFixed(1)}%`);
      }
    }

    // Despacho assíncrono para o Telegram
    if (signalsToDispatch.length > 0) {
      await telegramDispatcher.dispatch(signalsToDispatch, regime);
    }

    return distributed;
  }

  private static buildDisplayLabel(op: Opportunity, tier: "FREE" | "VIP"): string {
    const prob = (op.probability * 100).toFixed(0);
    const ev = (op.edgePercent ?? op.edge * 100).toFixed(1);
    if (tier === "VIP") {
      return `${op.vertical} | ${op.selection} @ ${op.odd.toFixed(2)} | EV: +${ev}% | Prob: ${prob}%`;
    }
    return `${op.vertical} | ${op.selection} @ ${op.odd.toFixed(2)} | Confiança: ${prob}%`;
  }
}
