import { Opportunity } from "./MarketDiscoveryEngine";
import { RegimeProfile } from "@/lib/argos/regime/RegimeSchema";
import { telegramDispatcher, TelegramSignalPayload } from "@/lib/argos/notifications/TelegramDispatcher";
import { getSupabaseClient } from "@/lib/core/SupabaseClient";

// ============================================================
// SIGNAL DISTRIBUTION ENGINE v6.3.0 — ZERO-VETO / CHANNEL POLICY
// ============================================================
// The analysis layer retains the full opportunity set. This layer only decides
// presentation tier and delivery. It does not alter model probabilities or EV.

export interface DistributedSignal extends Opportunity {
  tier: "FREE" | "VIP" | "LOW" | "NOISE";
  priority: number;
  displayLabel?: string;
}

export class SignalDistributionEngine {
  public static async processAndDispatch(
    opportunities: Opportunity[],
    regime: RegimeProfile,
    matchContext: { matchId: string; name: string; homeTeam: string; awayTeam: string; league: string; kickoff: string }
  ): Promise<DistributedSignal[]> {
    const distributed: DistributedSignal[] = [];
    const signalsToDispatch: TelegramSignalPayload[] = [];

    // VIP receives every independently computed positive-EV opportunity from the
    // analysis layer. FREE is a showcase: the dispatcher itself further limits
    // presentation to at most two distinct verticals per match.
    const vipOps = opportunities.filter((op) => op.hasEdge);
    const freeOps = [...opportunities]
      .filter((op) => op.probability >= 0.70)
      .sort((a, b) => b.probability - a.probability);

    const buildPayload = (
      op: Opportunity,
      tier: "FREE" | "VIP",
      context: { name: string; league: string; kickoff: string }
    ): TelegramSignalPayload => ({
      matchName: context.name,
      leagueName: context.league,
      kickoffTime: context.kickoff,
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
      analysisSummary:
        `Análise Argos Syndicate Master: probabilidade de ${(op.probability * 100).toFixed(1)}% com EV de ${(op.edge * 100).toFixed(1)}%.`
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

    // Idempotency is scoped to match + vertical + selection + line + tier.
    // Including the line prevents Over 2.5 and Over 3.5 from being treated as
    // the same signal while keeping retries of the exact signal suppressed.
    let alreadySentKeys = new Set<string>();
    try {
      const supabase = getSupabaseClient();
      const { data: recentlySent } = await supabase
        .from("argos_signal_ledger")
        .select("vertical, selection, line, tier")
        .eq("match_id", matchContext.matchId)
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      alreadySentKeys = new Set(
        (recentlySent || []).map(
          (r: any) => `${r.vertical}|${r.selection}|${r.line ?? 0}|${r.tier}`
        )
      );
    } catch {
      // Observability/idempotency must never break the analysis path.
    }

    const dedupedSignalsToDispatch = signalsToDispatch.filter(
      (s) => !alreadySentKeys.has(`${s.vertical}|${s.selection}|${s.line ?? 0}|${s.tier}`)
    );

    if (dedupedSignalsToDispatch.length > 0) {
      await telegramDispatcher.dispatch(dedupedSignalsToDispatch, regime);
    }

    // Keep the complete classified set in the ledger, including signals that
    // were already sent. This preserves research evidence and allows later
    // settlement/learning to operate independently from Telegram delivery.
    if (distributed.length > 0) {
      try {
        const supabase = getSupabaseClient();
        const rows = distributed.map((d) => ({
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
          tier: d.tier
        }));
        await supabase.from("argos_signal_ledger").insert(rows);
      } catch (err: any) {
        console.error("[SignalDistribution] ledger write failed:", err.message);
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
