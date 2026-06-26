import { NextResponse } from "next/server";
import { ResilientOrchestratorV5 } from "@/lib/argos/orchestrator/ResilientOrchestratorV5";
import { BatchQueueService } from "@/lib/core/BatchQueueService";
import { MarketVertical } from "@/lib/core/ArgosUnifiedEngine";
import { DailyIngestionScheduler } from "@/lib/argos/ingestion/DailyIngestionScheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Todos os mercados obrigatórios para varredura completa (Syndicate Master)
const EXHAUSTIVE_VERTICALS: MarketVertical[] = [
  MarketVertical.WINNER,
  MarketVertical.HANDICAP,
  MarketVertical.GOALS,
  MarketVertical.GOALS_HT,
  MarketVertical.BTTS,
  MarketVertical.CORNERS,
  MarketVertical.CARDS,
  MarketVertical.SHOTS,
  MarketVertical.SHOTS_ON_TARGET,
];

/**
 * ENDPOINT MASTER v6.0.0 — SYNDICATE MASTER EDITION
 * POST: Processa uma partida diretamente ou enfileira para processamento em lote.
 * GET:  Worker de fila — executa discovery + processa itens enfileirados.
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
      return NextResponse.json(
        { error: "matchId e requestedVerticals são obrigatórios" },
        { status: 400 }
      );
    }

    const orchestrator = new ResilientOrchestratorV5();

    // Modo BATCH: enfileira com payload completo se disponível
    if (mode === "BATCH") {
      const queueService = new BatchQueueService();
      const queueId = await queueService.enqueue(
        matchId,
        "ALL_MARKETS",
        requestedVerticals
        // rawData não disponível neste modo — será buscado do cache no worker
      );
      return NextResponse.json({ status: "QUEUED", queueId, matchId });
    }

    // Modo DIRECT: processamento imediato via fallback de cache
    const auditResult = await orchestrator.runZeroTouchAuditWithResilience(
      matchId,
      requestedVerticals,
      marketOdds
    );

    if (auditResult.status === "FAILED") {
      return NextResponse.json(auditResult, { status: 500 });
    }

    return NextResponse.json({
      matchId: auditResult.matchId,
      status: auditResult.status,
      regime: (auditResult as any).regime,
      normalizationReport: (auditResult as any).normalizationReport,
      discoveryReport: (auditResult as any).discoveryReport,
      signals: (auditResult as any).distributedSignals || [],
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

    // Discovery + Limpeza: executa sempre no cron, ou com 25% de chance em chamadas manuais
    const shouldRunIngestion = isVercelCron || Math.random() < 0.25;

    let discoveryResult: any = null;
    if (shouldRunIngestion) {
      const scheduler = new DailyIngestionScheduler();
      discoveryResult = await scheduler.scheduleDailyIngestion().catch((err) => ({
        status: "FAILED",
        error: err.message,
      }));
    }

    // Processamento da fila (Single-Pass Architecture)
    const processedResults = [];
    const MAX_PROCESS_PER_CALL = 3;

    for (let i = 0; i < MAX_PROCESS_PER_CALL; i++) {
      const nextItem = await queueService.getNextInQueue();
      if (!nextItem) break;

      const orchestrator = new ResilientOrchestratorV5();

      let auditResult;
      if (nextItem.rawData) {
        // SINGLE-PASS: payload completo disponível — zero re-fetch
        auditResult = await orchestrator.runSinglePassAudit(
          nextItem.rawData,
          EXHAUSTIVE_VERTICALS,
          nextItem.id
        );
      } else {
        // FALLBACK LEGADO: busca do cache do banco
        auditResult = await orchestrator.runZeroTouchAuditWithResilience(
          nextItem.matchId,
          EXHAUSTIVE_VERTICALS,
          undefined,
          undefined,
          nextItem.id
        );
      }

      processedResults.push({
        matchId: nextItem.matchId,
        status: auditResult.status,
        signalsCount: (auditResult as any).signals || 0,
        executionTimeMs: (auditResult as any).executionTimeMs,
      });
    }

    // Estatísticas da fila para monitoramento
    const queueStats = await queueService.getQueueStats();

    return NextResponse.json({
      status: "BATCH_PROCESSED",
      totalProcessed: processedResults.length,
      results: processedResults,
      queueStats,
      discoveryResult,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
