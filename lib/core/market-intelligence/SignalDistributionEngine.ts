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
    const distributed: DistributedSignal[] = [];
    const signalsToDispatch: TelegramSignalPayload[] = [];

    // VIP: TODA seleção com edge real (EV+) — varredura completa, como pedido.
    const vipOps = opportunities.filter(op => op.hasEdge);

    // FREE: as seleções de MAIOR probabilidade, mesmo sem EV+ — é vitrine de
    // assertividade, existe só "quando existir" algo de fato alto (>=70%).
    const freeOps = [...opportunities]
      .filter(op => op.probability >= 0.70)
      .sort((a, b) => b.probability - a.probability);

    const buildPayload = (op: Opportunity, tier: "FREE" | "VIP", matchContext: { name: string; league: string; kickoff: string }): TelegramSignalPayload => ({
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
      tier,
      line: op.line,
      analysisSummary: `Análise Argos Syndicate Master: Probabilidade de ${(op.probability * 100).toFixed(1)}% com Edge de ${(op.edge * 100).toFixed(1)}%.`
    });

    for (const op of vipOps) {
      const priority = op.probability * 0.6 + (op.expectedValue || 0) * 0.4;
      distributed.push({ ...op, tier: "VIP", priority, displayLabel: this.buildDisplayLabel(op, "VIP") });
      signalsToDispatch.push(buildPayload(op, "VIP", matchContext));
    }
    for (const op of freeOps) {
      const priority = op.probability;
      distributed.push({ ...op, tier: "FREE", priority, displayLabel: this.buildDisplayLabel(op, "FREE") });
      signalsToDispatch.push(buildPayload(op, "FREE", matchContext));
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
