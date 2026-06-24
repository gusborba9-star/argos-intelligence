// ============================================================
// RESILIENT ORCHESTRATOR v5.5.0 — SINGLE-PASS ARCHITECTURE
// Processamento Direto de Objetos e Eliminação de 404
// ============================================================

import { ArgosOrchestratorV4 } from "@/lib/argos/orchestrator/ArgosOrchestratorV4";
import { circuitBreakerPool } from "@/lib/core/CircuitBreaker";
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
   * Execução Single-Pass: Processa o objeto completo vindo da Mega Call.
   * Elimina a necessidade de chamadas extras e erros 404.
   */
  async runSinglePassAudit(
    fixture: any,
    requestedVerticals: MarketVertical[],
    queueItemId?: string
  ) {
    const startTime = Date.now();
    const matchId = (fixture.id || fixture.fixture?.id || fixture.match_id).toString();

    try {
      console.log(`[Argos-SinglePass] Iniciando auditoria direta para ${matchId}...`);

      // 1. INGEST DE OBJETO (Persistência + Normalização)
      // O DataIngestionService.ingestObject agora faz o trabalho sem chamadas de API
      const ingestedData = await this.ingestionService.ingestObject(fixture);

      // 2. AUDITORIA ZERO-TOUCH
      // Chamamos a lógica de análise passando os dados já ingeridos
      // Nota: Ajustamos o orchestrator para aceitar os dados injetados se necessário, 
      // ou deixamos ele usar o matchId pois ele consultará o cache/DB que acabamos de popular.
      const auditResult = await this.orchestrator.runZeroTouchAudit(
        matchId,
        requestedVerticals
      );

      // 3. ATUALIZAÇÃO DE FILA
      if (queueItemId) {
        await this.batchQueue.updateStatus(queueItemId, QueueStatus.COMPLETED);
      }

      console.log(`[Argos-Processamento] Evento ${matchId} concluído com sucesso (Single-Pass).`);

      return {
        ...auditResult,
        executionTimeMs: Date.now() - startTime
      };

    } catch (error: any) {
      const executionTime = Date.now() - startTime;

      if (error.message?.includes("EXPIRED") || error.response?.status === 404) {
        console.log(`[Argos-Resilience] Evento ${matchId} expirado ou não encontrado. Marcando como EXPIRED.`);
        if (queueItemId) {
          await this.batchQueue.updateStatus(queueItemId, QueueStatus.REJECTED, "EXPIRED");
        }
        return { status: "SUCCESS", matchId, error: "EXPIRED", executionTimeMs: executionTime };
      }

      console.error(`[ResilientOrchestratorV5] Erro crítico no Single-Pass ${matchId}:`, error.message);
      
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
   * Método Legado (v5.3.4): Mantido para compatibilidade com workers que ainda enviam apenas matchId.
   */
  async runZeroTouchAuditWithResilience(
    matchId: string,
    requestedVerticals: MarketVertical[],
    marketOdds?: { [key: string]: number },
    liveData?: { score: { home: number; away: number }; elapsed: number },
    queueItemId?: string
  ) {
    console.warn(`[Argos-Legacy] Usando orquestração legada para ${matchId}.`);
    return this.runSinglePassAudit({ id: matchId }, requestedVerticals, queueItemId);
  }
}
