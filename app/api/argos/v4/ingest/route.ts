import { NextResponse } from "next/server";
import { PropLineIngestionWorker } from "@/lib/workers/PropLineIngestionWorker";
import { BatchQueueService, QueueStatus } from "@/lib/core/BatchQueueService";
import { ArgosOrchestratorV4 } from "@/lib/argos/orchestrator/ArgosOrchestratorV4";
import { MarketNormalizer } from "@/lib/core/market-intelligence/MarketNormalizer";
import { FeatureEngine } from "@/lib/core/FeatureEngine";
import { MarketDiscoveryEngine } from "@/lib/core/market-intelligence/MarketDiscoveryEngine";
import { telegramDispatcher } from "@/lib/argos/notifications/TelegramDispatcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const start = Date.now();
  const { searchParams } = new URL(request.url);
  const isTest = searchParams.get("test") === "true";
  const isAudit = searchParams.get("audit") === "true";

  // 1. AUTH CHECK
  const auth = request.headers.get("x-argos-key");
  if (auth !== process.env.ARGOS_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // MODO EDGE AUDIT: Diagnóstico estatístico
  if (isAudit) {
    const worker = new PropLineIngestionWorker();
    const orchestrator = new ArgosOrchestratorV4();
    const sports = ["soccer_fifa_world_cup", "soccer_brazil_campeonato", "soccer_uefa_champs_league"];
    const auditLogs: any[] = [];

    try {
      for (const sport of sports) {
        const events = await (worker as any).getEvents(sport);
        if (!events || !Array.isArray(events)) continue;

        for (const event of events.slice(0, 10)) {
          try {
            if (!event || !event.teams || !event.league) continue;
            const normalized = MarketNormalizer.normalize(event);
            const features = FeatureEngine.generateFeatureVector(event);
            const mockRegime: any = { regime: "STABLE", confidence: 0.85 };
            const predictions = await (orchestrator as any).runFullMarketSimulation(features, mockRegime, "audit");
            const opportunities = MarketDiscoveryEngine.discover(normalized, predictions);

            for (const op of opportunities) {
              const impliedProb = 1 / op.fairOdd;
              const edge = op.probability - impliedProb;
              const decision = op.expectedValue >= 0.01 && op.edge >= 0.01 ? "ACCEPT" : "REJECT";
              auditLogs.push({
                match: `${event.home_team} vs ${event.away_team}`,
                market: op.vertical,
                selection: op.selection,
                odds: op.odd,
                model_prob: (op.probability * 100).toFixed(1) + "%",
                implied_prob: (impliedProb * 100).toFixed(1) + "%",
                ev: (op.expectedValue * 100).toFixed(2) + "%",
                edge: (edge * 100).toFixed(2) + "%",
                decision,
                reason: decision === "REJECT" ? (op.expectedValue < 0.01 ? "EV_TOO_LOW" : "EDGE_BELOW_THRESHOLD") : "NONE"
              });
            }
          } catch (e) { continue; }
        }
      }

      const stats = {
        total_analyzed: auditLogs.length,
        accepted: auditLogs.filter(l => l.decision === "ACCEPT").length,
        rejected: auditLogs.filter(l => l.decision === "REJECT").length,
        avg_ev: (auditLogs.reduce((acc, l) => acc + parseFloat(l.ev), 0) / (auditLogs.length || 1)).toFixed(2) + "%",
        avg_edge: (auditLogs.reduce((acc, l) => acc + parseFloat(l.edge), 0) / (auditLogs.length || 1)).toFixed(2) + "%",
        rejection_reasons: {
          ev_too_low: auditLogs.filter(l => l.reason === "EV_TOO_LOW").length,
          edge_below_threshold: auditLogs.filter(l => l.reason === "EDGE_BELOW_THRESHOLD").length
        }
      };
      return NextResponse.json({ status: "audit_completed", stats, logs: auditLogs.slice(0, 50) });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  // MODO TESTE: Telegram Dispatch
  if (isTest) {
    try {
      const testSignals = [
        {
          matchName: "TESTE DE SISTEMA | Argos v6.1.1",
          leagueName: "Pipeline Validation League",
          kickoffTime: new Date().toISOString(),
          vertical: "WINNER",
          selection: "Argos Intelligence",
          odd: 2.50,
          fairOdd: 1.80,
          expectedValue: 0.38,
          probability: 0.85,
          kellyCriterion: 0.15,
          ratingLabel: "ELITE",
          analysisSummary: "Validação do pipeline completo.",
          tier: "FREE" as const
        }
      ];
      const results = await telegramDispatcher.dispatch(testSignals);
      return NextResponse.json({ status: "success", results });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  // PIPELINE REAL
  try {
    const worker = new PropLineIngestionWorker();
    await worker.run();
    const queueService = new BatchQueueService();
    const orchestrator = new ArgosOrchestratorV4();
    const processed = [];
    for (let i = 0; i < 12; i++) {
      const item = await queueService.getNextInQueue();
      if (!item) break;
      try {
        const result = await orchestrator.runSyndicateAudit(item.rawData || { match_id: item.matchId });
        await queueService.updateStatus(item.id, result.status === "FAILED" ? QueueStatus.FAILED : QueueStatus.COMPLETED, result.error);
        processed.push({ matchId: item.matchId, status: result.status });
      } catch (e: any) {
        await queueService.updateStatus(item.id, QueueStatus.FAILED, e.message);
      }
    }
    await queueService.cleanupQueue();
    return NextResponse.json({ status: "success", processed_count: processed.length, executionTimeMs: Date.now() - start });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
