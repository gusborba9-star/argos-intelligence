// ============================================================
// RESILIENT ORCHESTRATOR v6.0.0 — SYNDICATE MASTER
// Processamento Direto de Objetos e Auditoria Master v6
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

    try {
      console.log(`[Argos-v6] 🛡️ Iniciando Auditoria Master para ${matchId}...`);

      // Auditoria Master v6.0.0 (Integração de todos os motores)
      const auditResult = await this.orchestrator.runSyndicateAudit(fixture);

      // Atualização de Fila
      if (queueItemId) {
        const status = auditResult.status === "SUCCESS" ? QueueStatus.COMPLETED : QueueStatus.FAILED;
        await this.batchQueue.updateStatus(queueItemId, status);
      }

      return {
        ...auditResult,
        executionTimeMs: Date.now() - startTime
      };

    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      if (error.message?.includes("EXPIRED") || error.response?.status === 404) {
        if (queueItemId) {
          await this.batchQueue.updateStatus(queueItemId, QueueStatus.REJECTED, "EXPIRED");
        }
        return { status: "SUCCESS", matchId, error: "EXPIRED", executionTimeMs: executionTime };
      }

      if (queueItemId) {
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
    // Na v6.0.0, precisamos do payload completo. Se não tivermos, tentamos buscar no banco/cache.
    const ingestedData = await this.ingestionService.getCachedMatchData(matchId);
    
    if (ingestedData) {
      return this.runSinglePassAudit(ingestedData.rawData, requestedVerticals, queueItemId);
    }

    return { status: "FAILED", matchId, error: "DATA_NOT_FOUND_FOR_LEGACY_CALL" };
  }
}
