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
export async function GET(request: Request) {
  const start = Date.now();

  // 1. AUTH CHECK (Sincronizado com Middleware)
  const auth = request.headers.get("x-argos-key");
  if (auth !== process.env.ARGOS_API_KEY) {
    console.warn("[Ingest-Auth] ❌ Unauthorized access attempt");
    return NextResponse.json(
      { error: "Unauthorized: Missing or invalid authentication" },
      { status: 401 }
    );
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
        await queueService.updateStatus(nextItem.id, "FAILED", itemErr.message);
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
