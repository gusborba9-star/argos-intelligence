import { Opportunity } from "./MarketDiscoveryEngine";
import { RegimeProfile } from "@/lib/argos/regime/RegimeSchema";
import { telegramDispatcher, TelegramSignalPayload } from "@/lib/argos/notifications/TelegramDispatcher";
import { DecisionGraphEngine, DecisionState } from "../DecisionGraphEngine";
import { SignalClassifierV4 } from "../SignalClassifierV4";

// ============================================================
// SIGNAL DISTRIBUTION ENGINE v6.2.0 — ZERO VETO EDITION
// Filosofia: TODO sinal classificado deve chegar ao Telegram.
// Integração: DecisionGraphEngine para distribuição de canais.
// ============================================================

export interface DistributedSignal extends Opportunity {
  tier: "FREE" | "VIP" | "LOW" | "NOISE";
  priority: number;
  displayLabel?: string;
}

export class SignalDistributionEngine {
  /**
   * Distribui e DESPACHA 100% dos sinais para o Telegram.
   * Utiliza o DecisionGraph para definir o canal de destino.
   */
  public static async processAndDispatch(
    opportunities: Opportunity[],
    regime: RegimeProfile,
    matchContext: { name: string; league: string; kickoff: string }
  ): Promise<DistributedSignal[]> {
    
    // 1. Classificação via Ranking (v4.4)
    const classifiedSignals = SignalClassifierV4.classify(opportunities as any, regime);
    
    // 2. Processamento via Decision Graph (v1.0)
    const decisionNodes = DecisionGraphEngine.process(classifiedSignals);
    
    const distributed: DistributedSignal[] = [];
    const signalsToDispatch: TelegramSignalPayload[] = [];

    for (let i = 0; i < classifiedSignals.length; i++) {
      const s = classifiedSignals[i];
      const node = decisionNodes[i];
      const op = opportunities[i];

      const tier = s.tier as any;
      const priority = s.probability * 0.6 + (s.expectedValue || 0) * 0.4;

      const distSignal: DistributedSignal = {
        ...op,
        tier,
        priority,
        displayLabel: this.buildDisplayLabel(op, tier),
      };
      distributed.push(distSignal);

      // Mapeamento de DecisionState para Tiers de Entrega
      // ACCEPT_VIP -> Canal VIP
      // ACCEPT_FREE -> Canal FREE
      // OBSERVE -> Canal de Monitoramento (Enviado como VIP com label de observação)
      
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
        tier: node.finalDecision === DecisionState.ACCEPT_FREE ? "FREE" : "VIP",
        line: op.line,
        analysisSummary: `Análise Argos DecisionGraph [${node.finalDecision}]: Probabilidade de ${(op.probability * 100).toFixed(1)}% com Edge de ${(op.edge * 100).toFixed(1)}%.`
      });
    }

    // Despacho assíncrono para o Telegram (100% dos sinais)
    if (signalsToDispatch.length > 0) {
      console.log(`[SignalDistribution] 🚀 Despachando ${signalsToDispatch.length} sinais para Telegram.`);
      await telegramDispatcher.dispatch(signalsToDispatch, regime);
    }

    return distributed;
  }

  private static buildDisplayLabel(op: Opportunity, tier: string): string {
    const prob = (op.probability * 100).toFixed(0);
    const ev = (op.edgePercent ?? op.edge * 100).toFixed(1);
    return `[${tier}] ${op.vertical} | ${op.selection} @ ${op.odd.toFixed(2)} | EV: +${ev}% | Prob: ${prob}%`;
  }
}
