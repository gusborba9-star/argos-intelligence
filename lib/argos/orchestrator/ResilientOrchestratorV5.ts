// ============================================================
// RESILIENT ORCHESTRATOR v6.0.1 — SYNDICATE MASTER
// Processamento Direto de Objetos e Auditoria Master v6
// Instrumentação Completa de Fluxo (STEP 1-13)
// ============================================================

import { ArgosOrchestratorV4 } from "@/lib/argos/orchestrator/ArgosOrchestratorV4";
import { MarketVertical } from "@/lib/core/ArgosUnifiedEngine";
import { DataIngestionService } from "@/lib/core/DataIngestionService";
import { BatchQueueService, QueueStatus } from "@/lib/core/BatchQueueService";

export class ResilientOrchestratorV5 {
  private orchestrator: ArgosOrchestratorV4;
  private ingestionService: DataIngestionService;
  private batchQueue: BatchQueueService;

  constructor() {
    this.ingestionService = new DataIngestionService();
    this.orchestrator = new ArgosOrchestratorV4(this.ingestionService);
    this.batchQueue = new BatchQueueService();
  }

  private logStep(step: string, queueItemId: string, startTime: number, extra: any = {}) {
    const now = new Date().toISOString();
    const elapsed = Date.now() - startTime;
    console.log(`[INSTRUMENTATION] [${now}] [${queueItemId || 'DIRECT'}] ${step} | Elapsed: ${elapsed}ms`, extra);
  }

  /**
   * Execução Single-Pass Master v6.0.0.
   */
  async runSinglePassAudit(
    fixture: any,
    requestedVerticals: MarketVertical[],
    queueItemId?: string
  ) {
    const startTime = Date.now();
    const matchId = (fixture.id || fixture.fixture?.id || fixture.match_id || fixture.matchId).toString();
    const qid = queueItemId || "DIRECT";

    this.logStep("STEP 1 - queue item received", qid, startTime, { matchId });

    try {
      console.log(`[Argos-v6] 🛡️ Iniciando Auditoria Master para ${matchId}...`);

      // Auditoria Master v6.0.0 (Integração de todos os motores)
      // Nota: O ArgosOrchestratorV4 será instrumentado internamente para os STEPS 2-11
      const auditResult = await this.orchestrator.runSyndicateAudit(fixture, qid);

      // Atualização de Fila
      if (queueItemId) {
        let finalStatus: QueueStatus;
        if (auditResult.status === "SUCCESS") {
          finalStatus = QueueStatus.COMPLETED;
          this.logStep("STEP 12 - updateStatus(COMPLETED)", qid, startTime);
        } else if (auditResult.status === "NO_VALUE") {
          finalStatus = QueueStatus.SKIPPED;
          this.logStep("STEP 12 - updateStatus(SKIPPED)", qid, startTime);
        } else {
          finalStatus = QueueStatus.FAILED;
          this.logStep("STEP 12 - updateStatus(FAILED)", qid, startTime, { error: auditResult.error });
        }

        await this.batchQueue.updateStatus(queueItemId, finalStatus);
      }

      const result = {
        ...auditResult,
        executionTimeMs: Date.now() - startTime
      };

      this.logStep("STEP 13 - finished", qid, startTime, { status: result.status });
      return result;

    } catch (error: any) {
      const executionTime = Date.now() - startTime;
      console.error(`[INSTRUMENTATION] [${qid}] CRITICAL EXCEPTION at runSinglePassAudit:`, {
        message: error.message,
        stack: error.stack,
        matchId
      });

      if (error.message?.includes("EXPIRED") || error.response?.status === 404) {
        if (queueItemId) {
          await this.batchQueue.updateStatus(queueItemId, QueueStatus.REJECTED, "EXPIRED");
        }
        return { status: "SUCCESS", matchId, error: "EXPIRED", executionTimeMs: executionTime };
      }

      if (queueItemId) {
        this.logStep("STEP 12 (ERROR) - updateStatus(FAILED)", qid, startTime, { error: error.message });
        await this.batchQueue.updateStatus(queueItemId, QueueStatus.FAILED, error.message);
      }

      return {
        status: "FAILED",
        matchId,
        error: error.message,
        executionTimeMs: executionTime
      };
    }
  }

  /**
   * Fallback para chamadas com matchId.
   */
  async runZeroTouchAuditWithResilience(
    matchId: string,
    requestedVerticals: MarketVertical[],
    marketOdds?: { [key: string]: number },
    liveData?: { score: { home: number; away: number }; elapsed: number },
    queueItemId?: string
  ) {
    const startTime = Date.now();
    const qid = queueItemId || "DIRECT";
    this.logStep("STARTING runZeroTouchAuditWithResilience", qid, startTime, { matchId });

    // Na v6.0.0, precisamos do payload completo. Se não tivermos, tentamos buscar no banco/cache.
    const ingestedData = await this.ingestionService.getCachedMatchData(matchId);
    
    if (ingestedData) {
      return this.runSinglePassAudit(ingestedData.rawData, requestedVerticals, queueItemId);
    }

    this.logStep("FAILED runZeroTouchAuditWithResilience - DATA_NOT_FOUND", qid, startTime);
    return { status: "FAILED", matchId, error: "DATA_NOT_FOUND_FOR_LEGACY_CALL" };
  }
}
