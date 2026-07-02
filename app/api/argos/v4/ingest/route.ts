import { NextResponse } from "next/server";
import { PropLineIngestionWorker } from "@/lib/workers/PropLineIngestionWorker";
import { BatchQueueService, QueueStatus } from "@/lib/core/BatchQueueService";
import { ArgosOrchestratorV4 } from "@/lib/argos/orchestrator/ArgosOrchestratorV4";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ARGOS V4 MASTER INGESTION PIPELINE
 * - Ingestão via PropLineIngestionWorker (Persistência + Enfileiramento)
 * - Processamento imediato da fila (Pipeline End-to-End)
 * - Protegido por x-argos-key
 */
import { telegramDispatcher } from "@/lib/argos/notifications/TelegramDispatcher";

export async function GET(request: Request) {
  const start = Date.now();
  const { searchParams } = new URL(request.url);
  const isTest = searchParams.get("test") === "true";

  // 1. AUTH CHECK (Sincronizado com Middleware)
  const auth = request.headers.get("x-argos-key");
  if (auth !== process.env.ARGOS_API_KEY) {
    console.warn("[Ingest-Auth] ❌ Unauthorized access attempt");
    return NextResponse.json(
      { error: "Unauthorized: Missing or invalid authentication" },
      { status: 401 }
    );
  }

  // MODO TESTE: Disparo manual para Telegram
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
          analysisSummary: "Este é um sinal de teste gerado para validar o pipeline completo (Ingestão -> Engine -> Telegram). Se você está vendo isso, o despacho está FUNCIONANDO.",
          tier: "FREE" as const
        },
        {
          matchName: "TESTE VIP | Argos v6.1.1",
          leagueName: "Pipeline Validation League",
          kickoffTime: new Date().toISOString(),
          vertical: "GOALS",
          selection: "Over 2.5 Goals",
          odd: 2.10,
          fairOdd: 1.60,
          expectedValue: 0.31,
          probability: 0.75,
          kellyCriterion: 0.12,
          ratingLabel: "ELITE",
          analysisSummary: "Validação do canal VIP. Pipeline Syndicate Master Edition operando em regime de alta performance.",
          tier: "VIP" as const
        }
      ];
      await telegramDispatcher.dispatch(testSignals);
      return NextResponse.json({ status: "success", message: "Sinais de teste disparados!" });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  try {
    // 2. DISPARAR INGESTÃO (Popula argos_matches e enfileira em argos_batch_queue)
    const worker = new PropLineIngestionWorker();
    await worker.run();

    // 3. PROCESSAR FILA IMEDIATAMENTE (Pipeline Zero-Latency)
    const queueService = new BatchQueueService();
    const orchestrator = new ArgosOrchestratorV4();
    
    const processedResults = [];
    const MAX_PROCESS_PER_CALL = 5; // Processa até 5 jogos por ciclo de ingestão

    for (let i = 0; i < MAX_PROCESS_PER_CALL; i++) {
      const nextItem = await queueService.getNextInQueue();
      if (!nextItem) break;

      try {
        // Executa auditoria completa (Engine -> Sinais -> Telegram)
        const auditResult = await orchestrator.runSyndicateAudit(nextItem.rawData || { match_id: nextItem.matchId });
        
        await queueService.updateStatus(
          nextItem.id, 
          auditResult.status === "FAILED" ? QueueStatus.FAILED : QueueStatus.COMPLETED,
          auditResult.error
        );

        processedResults.push({
          matchId: nextItem.matchId,
          status: auditResult.status,
          signals: auditResult.signals,
          executionTimeMs: auditResult.executionTime
        });
      } catch (itemErr: any) {
        console.error(`[Ingest-Pipeline] ❌ Error processing item ${nextItem.matchId}:`, itemErr.message);
        await queueService.updateStatus(nextItem.id, QueueStatus.FAILED, itemErr.message);
      }
    }

    // 4. LIMPEZA AUTOMÁTICA DA FILA
    await queueService.cleanupQueue();

    return NextResponse.json({
      status: "success",
      layer: "argos-v4-master-pipeline",
      ingestion: "completed",
      processing: {
        total: processedResults.length,
        results: processedResults
      },
      executionTimeMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Argos V4 Ingest] 🚨 Fatal pipeline error:", error?.message);

    return NextResponse.json(
      {
        status: "error",
        message: error?.message || "unknown_error",
      },
      { status: 500 }
    );
  }
}
