// ============================================================
// RESILIENT ORCHESTRATOR v5.3.4 — SYNDICATE RESILIENCE
// Tratamento Silencioso de 404 e Auto-Limpeza de Fila
// ============================================================

import { ArgosOrchestratorV4 } from "@/lib/argos/orchestrator/ArgosOrchestratorV4";
import { circuitBreakerPool } from "@/lib/core/CircuitBreaker";
import { getRedisCacheInstance } from "@/lib/core/RedisCache";
import { telemetryService } from "@/lib/core/TelemetryService";
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
    this.initializeCircuitBreakers();
  }

  private initializeCircuitBreakers(): void {
    circuitBreakerPool.register({
      name: "DataIngestion",
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 30000,
      resetTimeout: 60000,
    });
    // Outros breakers omitidos para brevidade, mas mantidos no pool global
  }

  async runZeroTouchAuditWithResilience(
    matchId: string,
    requestedVerticals: MarketVertical[],
    marketOdds?: { [key: string]: number },
    liveData?: { score: { home: number; away: number }; elapsed: number },
    queueItemId?: string
  ) {
    const startTime = Date.now();

    try {
      // 1. PRÉ-VALIDAÇÃO TEMPORAL (Evita gastos inúteis de cota)
      // Se tivermos os dados do evento, validamos o commence_time
      // Para este fluxo, o orchestrator chamará o ingest internamente

      // 2. EXECUÇÃO COM TRATAMENTO DE 404
      const auditResult = await this.orchestrator.runZeroTouchAudit(
        matchId,
        requestedVerticals,
        marketOdds,
        liveData
      );

      return auditResult;

    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      // TRATAMENTO ESPECÍFICO PARA 404 NOT FOUND (Evento Expirado)
      if (error.response?.status === 404 || error.message?.includes("404")) {
        console.log(`[Argos-Resilience] Evento ${matchId} expirado na PropLine (404). Removendo da fila.`);
        
        if (queueItemId) {
          await this.batchQueue.updateStatus(queueItemId, QueueStatus.REJECTED, "EXPIRED_ON_SOURCE");
        }

        return {
          status: "SUCCESS", // Retornamos SUCCESS para não travar o loop do worker
          matchId,
          error: "EXPIRED_ON_SOURCE",
          executionTimeMs: executionTime
        };
      }

      console.error(`[ResilientOrchestratorV5] Erro crítico na auditoria ${matchId}:`, error.message);
      
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
}
