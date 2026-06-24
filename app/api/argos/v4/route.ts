import { NextResponse } from "next/server";
import { ResilientOrchestratorV5 } from "@/lib/argos/orchestrator/ResilientOrchestratorV5";
import { BatchQueueService, QueueStatus } from "@/lib/core/BatchQueueService";
import { MarketVertical } from "@/lib/core/ArgosUnifiedEngine";
import { TelegramDispatcher } from "@/lib/argos/notifications/TelegramDispatcher";
import { DailyIngestionScheduler } from "@/lib/argos/ingestion/DailyIngestionScheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

    // Nota: Para chamadas POST diretas, ainda usamos o matchId, mas o orquestrador v5.5.0
    // lidará com isso usando o fallback de ingest individual se necessário.
    const auditResult = await orchestrator.runZeroTouchAuditWithResilience(matchId, requestedVerticals, marketOdds);

    if (auditResult.status === "FAILED") {
      return NextResponse.json(auditResult, { status: 500 });
    }

    // @ts-ignore
    let signalsToDeliver = auditResult.classifiedSignals || [];
    
    if (signalsToDeliver.length > 0) {
      const telegramDispatcher = new TelegramDispatcher();
      // @ts-ignore
      await telegramDispatcher.dispatch(signalsToDeliver, auditResult.regime).catch(() => {});
    }

    return NextResponse.json({
      matchId: auditResult.matchId,
      status: auditResult.status,
      // @ts-ignore
      regime: auditResult.regime,
      signals: signalsToDeliver
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

      // ARQUITETURA SINGLE-PASS (v5.5.0)
      // Se o item da fila já tiver o raw_data (payload completo), usamos o runSinglePassAudit
      let auditResult;
      if (nextItem.rawData) {
        auditResult = await orchestrator.runSinglePassAudit(nextItem.rawData, exhaustiveVerticals, nextItem.id);
      } else {
        // Fallback para itens antigos na fila que só têm o matchId
        auditResult = await orchestrator.runZeroTouchAuditWithResilience(nextItem.matchId, exhaustiveVerticals, undefined, undefined, nextItem.id);
      }

      if (auditResult.status === "FAILED") {
        processedResults.push({ matchId: nextItem.matchId, status: "FAILED" });
        continue;
      }

      // @ts-ignore
      let signalsToDeliver = auditResult.classifiedSignals || [];
      
      if (signalsToDeliver.length > 0) {
        const telegramDispatcher = new TelegramDispatcher();
        // @ts-ignore
        await telegramDispatcher.dispatch(signalsToDeliver, auditResult.regime).catch(() => {});
      }

      processedResults.push({ matchId: nextItem.matchId, status: "SUCCESS", signalsCount: signalsToDeliver.length });
    }

    return NextResponse.json({ status: "BATCH_PROCESSED", totalProcessed: processedResults.length, results: processedResults });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
