import { NextResponse } from "next/server";
import { ResilientOrchestratorV5 } from "@/lib/argos/orchestrator/ResilientOrchestratorV5";
import { BatchQueueService } from "@/lib/core/BatchQueueService";
import { MarketVertical } from "@/lib/core/ArgosUnifiedEngine";
import { DailyIngestionScheduler } from "@/lib/argos/ingestion/DailyIngestionScheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ENDPOINT MASTER v6.0.0
 * Gerencia a ingestão e o processamento da fila com orquestração Single-Pass.
 */
export async function POST(req: Request) {
  try {
    const isAuthorized = req.headers.get("x-authorized") === "true";
    const apiKey = req.headers.get("x-api-key");
    const isValidApiKey = apiKey && apiKey === process.env.ARGOS_API_KEY;

    if (!isAuthorized && !isValidApiKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { matchId, requestedVerticals, marketOdds, mode = "DIRECT" } = body;

    if (!matchId || !requestedVerticals) {
      return NextResponse.json({ error: "matchId e requestedVerticals são obrigatórios" }, { status: 400 });
    }

    const orchestrator = new ResilientOrchestratorV5();

    if (mode === "BATCH") {
      const queueService = new BatchQueueService();
      const queueId = await queueService.enqueue(matchId, "ALL_MARKETS", requestedVerticals);
      return NextResponse.json({ status: "QUEUED", queueId, matchId });
    }

    // Processamento Direto (v6.0.0)
    // O Orquestrador agora lida com o despacho do Telegram internamente para evitar duplicidade.
    const auditResult = await orchestrator.runZeroTouchAuditWithResilience(matchId, requestedVerticals, marketOdds);

    if (auditResult.status === "FAILED") {
      return NextResponse.json(auditResult, { status: 500 });
    }

    return NextResponse.json({
      matchId: auditResult.matchId,
      status: auditResult.status,
      regime: (auditResult as any).regime,
      signals: (auditResult as any).distributedSignals || []
    });

  } catch (error: any) {
    return NextResponse.json({ status: "FAILED", error: error.message }, { status: 500 });
  }
} 

export async function GET(request: Request) {
  try {
    const isAuthorized = request.headers.get("x-authorized") === "true";
    const isVercelCron = request.headers.get("x-vercel-cron") === "1";

    if (!isAuthorized && !isVercelCron) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const queueService = new BatchQueueService();
    const shouldRunIngestion = isVercelCron || Math.random() < 0.25;

    if (shouldRunIngestion) {
      const scheduler = new DailyIngestionScheduler();
      await scheduler.scheduleDailyIngestion().catch(() => {});
    }

    const processedResults = [];
    const MAX_PROCESS_PER_CALL = 3;
    
    for (let i = 0; i < MAX_PROCESS_PER_CALL; i++) {
      const nextItem = await queueService.getNextInQueue();
      if (!nextItem) break;

      const orchestrator = new ResilientOrchestratorV5();
      const exhaustiveVerticals: MarketVertical[] = [
        MarketVertical.WINNER, MarketVertical.GOALS, MarketVertical.GOALS_HT,
        MarketVertical.CORNERS, MarketVertical.CARDS, MarketVertical.BTTS,
        MarketVertical.HANDICAP, MarketVertical.SHOTS, MarketVertical.SHOTS_ON_TARGET
      ];

      // ARQUITETURA SINGLE-PASS (v6.0.0)
      // O Orquestrador agora despacha para o Telegram internamente.
      let auditResult;
      if (nextItem.rawData) {
        auditResult = await orchestrator.runSinglePassAudit(nextItem.rawData, exhaustiveVerticals, nextItem.id);
      } else {
        auditResult = await orchestrator.runZeroTouchAuditWithResilience(nextItem.matchId, exhaustiveVerticals, undefined, undefined, nextItem.id);
      }

      processedResults.push({ 
        matchId: nextItem.matchId, 
        status: auditResult.status, 
        signalsCount: (auditResult as any).distributedSignals?.length || 0 
      });
    }

    return NextResponse.json({ status: "BATCH_PROCESSED", totalProcessed: processedResults.length, results: processedResults });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
