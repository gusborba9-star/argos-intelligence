import { Opportunity } from "./MarketDiscoveryEngine";
import { RegimeProfile } from "@/lib/argos/regime/RegimeSchema";
import { telegramDispatcher, TelegramSignalPayload } from "@/lib/argos/notifications/TelegramDispatcher";
// DecisionGraphEngine removido na v6.0.0.
// SignalClassifierV4 removido na v6.0.0. A classificação agora é feita no Master Orchestrator.

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
    
    // Na v6.0.0, as oportunidades já chegam classificadas e com rating do OddsValueEngine.
    const classifiedSignals = opportunities;
    
    const distributed: DistributedSignal[] = [];
    const signalsToDispatch: TelegramSignalPayload[] = [];

    for (let i = 0; i < classifiedSignals.length; i++) {
      const s = classifiedSignals[i];
      const op = opportunities[i];

      // Lógica de Tier Syndicate: 
      // FREE: Alta probabilidade (>70%) ou Rating ELITE.
      // VIP: Todos os sinais com EV+.
      const isFreeTier = op.probability >= 0.70 || op.ratingLabel === "ELITE";
      const tier = isFreeTier ? "FREE" : "VIP";
      
      const priority = op.probability * 0.6 + (op.expectedValue || 0) * 0.4;

      const distSignal: DistributedSignal = {
        ...op,
        tier,
        priority,
        displayLabel: this.buildDisplayLabel(op, tier),
      };
      distributed.push(distSignal);

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
        kellyCriterion: op.kellyCriterion || 0,
        ratingLabel: op.ratingLabel || "VALUE",
        tier: tier,
        line: op.line,
        analysisSummary: `Análise Argos Syndicate Master: Probabilidade de ${(op.probability * 100).toFixed(1)}% com Edge de ${(op.edge * 100).toFixed(1)}%.`
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
