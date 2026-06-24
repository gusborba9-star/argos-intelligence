import { NextResponse } from "next/server";
import { ResilientOrchestratorV5 } from "@/lib/argos/orchestrator/ResilientOrchestratorV5";
import { BatchQueueService, QueueStatus } from "@/lib/core/BatchQueueService";
import { ValueDeliveryService } from "@/lib/argos/delivery/ValueDeliveryService";
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
    const { matchId, requestedVerticals, marketOdds, userId, mode = "DIRECT" } = body;

    if (!matchId || !requestedVerticals) {
      return NextResponse.json({ error: "matchId e requestedVerticals são obrigatórios" }, { status: 400 });
    }

    const orchestrator = new ResilientOrchestratorV5();
    const deliveryService = new ValueDeliveryService();

    if (mode === "BATCH") {
      const queueService = new BatchQueueService();
      const queueId = await queueService.enqueue(matchId, "ALL_MARKETS", requestedVerticals, userId);
      return NextResponse.json({ status: "QUEUED", queueId, matchId });
    }

    const auditResult = await orchestrator.runZeroTouchAuditWithResilience(matchId, requestedVerticals, marketOdds);

    if (auditResult.status === "FAILED") {
      return NextResponse.json(auditResult, { status: 500 });
    }

    // @ts-ignore - auditResult pode vir com erro de expiração
    let signalsToDeliver = auditResult.classifiedSignals || [];
    let userTier: any = (req.headers.get("x-user-tier") as any) || 'FREE';
    
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
      signals: signalsToDeliver,
      userTier
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

      const auditResult = await orchestrator.runZeroTouchAuditWithResilience(nextItem.matchId, exhaustiveVerticals, undefined, undefined, nextItem.id);

      if (auditResult.status === "FAILED") {
        processedResults.push({ matchId: nextItem.matchId, status: "FAILED" });
        continue;
      }

      // Se expirou (404), marcamos como EXPIRED e prosseguimos
      if (auditResult.error === "EXPIRED_ON_SOURCE") {
        await queueService.updateStatus(nextItem.id, QueueStatus.EXPIRED, "404 Not Found");
        processedResults.push({ matchId: nextItem.matchId, status: "EXPIRED" });
        continue;
      }

      await queueService.updateStatus(nextItem.id, QueueStatus.COMPLETED);
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
