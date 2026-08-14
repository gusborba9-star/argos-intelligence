import { Opportunity } from "./MarketDiscoveryEngine";
import { RegimeProfile } from "@/lib/argos/regime/RegimeSchema";
import { telegramDispatcher, TelegramSignalPayload } from "@/lib/argos/notifications/TelegramDispatcher";
import { getSupabaseClient } from "@/lib/core/SupabaseClient";
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
    matchContext: { matchId: string; name: string; homeTeam: string; awayTeam: string; league: string; kickoff: string }
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

    // TRAVA CONTRA DUPLICATA: nunca reenviar pro Telegram um sinal
    // (mesma partida+mercado+selecao) que ja foi disparado nas ultimas 24h.
    let alreadySentKeys = new Set<string>();
    try {
      const supabase = getSupabaseClient();
      const { data: recentlySent } = await supabase
        .from("argos_signal_ledger")
        .select("vertical, selection, tier")
        .eq("match_id", matchContext.matchId)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
      alreadySentKeys = new Set((recentlySent || []).map((r: any) => `${r.vertical}|${r.selection}|${r.tier}`));
    } catch { /* se falhar, segue sem bloquear */ }

    const dedupedSignalsToDispatch = signalsToDispatch.filter(
      (s) => !alreadySentKeys.has(`${s.vertical}|${s.selection}|${s.tier}`)
    );
    if (dedupedSignalsToDispatch.length < signalsToDispatch.length) {
      console.warn(`[SignalDistribution] suprimidos por duplicata: ${signalsToDispatch.length - dedupedSignalsToDispatch.length}`);
    }

    // Despacho assíncrono para o Telegram (100% dos sinais)
    if (dedupedSignalsToDispatch.length > 0) {
      console.log(`[SignalDistribution] Despachando ${dedupedSignalsToDispatch.length} sinais para Telegram.`);
      await telegramDispatcher.dispatch(dedupedSignalsToDispatch, regime);
    }

    // Grava cada sinal no ledger — sem isso, o aprendizado contínuo nunca
    // teve dado real pra aprender, e o bilhete do dia não tinha de onde
    // puxar os sinais de hoje.
    if (distributed.length > 0) {
      try {
        const supabase = getSupabaseClient();
        const rows = distributed.map(d => ({
          match_id: matchContext.matchId,
          league_name: matchContext.league,
          home_team: matchContext.homeTeam,
          away_team: matchContext.awayTeam,
          kickoff_at: matchContext.kickoff,
          vertical: d.vertical,
          market: d.vertical,
          selection: d.selection,
          line: d.line,
          odd: d.odd,
          probability: d.probability,
          expected_value: d.expectedValue,
          confidence: d.probability,
          regime: (regime as any)?.market_regime || "NEUTRAL",
          tier: d.tier,
        }));
        await supabase.from("argos_signal_ledger").insert(rows);
      } catch (err: any) {
        console.error("[SignalDistribution] ⚠️ Falha ao gravar ledger:", err.message);
      }
    }

    return distributed;
  }

  private static buildDisplayLabel(op: Opportunity, tier: string): string {
    const prob = (op.probability * 100).toFixed(0);
    const ev = (op.edgePercent ?? op.edge * 100).toFixed(1);
    return `[${tier}] ${op.vertical} | ${op.selection} @ ${op.odd.toFixed(2)} | EV: +${ev}% | Prob: ${prob}%`;
  }
}
