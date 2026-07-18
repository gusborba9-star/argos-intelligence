import { MarketVertical } from "./ArgosUnifiedEngine";
import { getSupabaseClient } from "@/lib/core/SupabaseClient";

// ============================================================
// BATCH QUEUE SERVICE v6.0.1 — SYNDICATE MASTER EDITION
// Single-Pass Transport com:
//   - Payload completo (rawData) na fila
//   - Limpeza automática de itens concluídos
//   - Prevenção de duplicidade por unique_key
//   - Zero chamada desnecessária à API externa
//
// CORREÇÃO AUDITORIA 2026-07-02:
//   - Removido campo 'expires_at' (não existe no schema físico do banco)
// ============================================================

export enum QueueStatus {
  DISCOVERED = "DISCOVERED",
  VALIDATED = "VALIDATED",
  QUEUED = "QUEUED",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  REJECTED = "REJECTED",
  EXPIRED = "EXPIRED",
  SKIPPED = "SKIPPED",
}

export interface QueueItem {
  id: string;
  matchId: string;
  marketFamily: string;
  uniqueKey: string;
  requestedVerticals: MarketVertical[];
  userId?: string;
  status: QueueStatus;
  priority?: number;
  rawData?: any; // Payload completo para Single-Pass (zero re-fetch)
  createdAt?: string;
}

// Tempo máximo que itens COMPLETED/FAILED ficam no banco antes de serem limpos (horas)
const CLEANUP_RETENTION_HOURS = 24;

export class BatchQueueService {
  private supabase;

  constructor() {
    this.supabase = getSupabaseClient();
  }

  /**
   * Enfileira um item com payload completo (Single-Pass).
   * Prevenção de duplicidade: retorna o ID existente se unique_key já existe.
   */
    async enqueue(
    matchId: string,
    marketFamily: string,
    verticals: string[],
    rawData?: any,
    status: QueueStatus = QueueStatus.QUEUED,
    priority: number = 0
  ): Promise<string> {
    const uniqueKey = `${matchId}_${marketFamily}`;
    const safeVerticals = (verticals || []).filter((v) =>
      Object.values(MarketVertical).includes(v as MarketVertical)
    );

    // --- PROTEÇÃO CONTRA DADOS CORROMPIDOS ---
    // Na v6, o rawData é o payload bruto da PropLine, não o objeto de sinal final.
    if (!rawData || (!rawData.id && !rawData.match_id)) {
      console.error(`[BatchQueue] ⚠️ Registro rejeitado: Payload bruto incompleto para ${uniqueKey}`, { rawData });
      throw new Error(`[BatchQueue] Dados brutos inválidos para ${uniqueKey}`);
    }
    // ------------------------------------------


    // Verificar se já existe item ativo (QUEUED, VALIDATED, PROCESSING)
    const { data: existing } = await this.supabase
      .from("argos_batch_queue")
      .select("id, status, created_at")
      .eq("unique_key", uniqueKey)
      .in("status", [QueueStatus.QUEUED, QueueStatus.VALIDATED, QueueStatus.PROCESSING])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing && existing.status === QueueStatus.QUEUED) {
      // Se já está na fila mas ainda não foi processado, atualizamos com os dados mais recentes
      const { data: updated, error: updateErr } = await this.supabase
        .from("argos_batch_queue")
        .update({
          raw_data: rawData,
          requested_verticals: safeVerticals,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (!updateErr) {
        console.log(`[BatchQueue] 🔄 Item atualizado na fila: ${uniqueKey} (Odds novas)`);
        return updated.id;
      }
    }

    if (existing && existing.status !== QueueStatus.QUEUED) {
      console.log(
        `[BatchQueue] ⏭️ Pulando: ${uniqueKey} está em processamento (${existing.status}).`
      );
      return existing.id;
    }

    const { data, error } = await this.supabase
      .from("argos_batch_queue")
      .insert({
        match_id: matchId,
        market_family: marketFamily,
        unique_key: uniqueKey,
        requested_verticals: safeVerticals,
        raw_data: rawData, // Payload completo — zero re-fetch
        status: status,
        priority: priority,
      })
      .select()
      .single();

    if (error) {
      // Fallback para conflito de unique_key (race condition)
      if (error.code === "23505") {
        const { data: fallback } = await this.supabase
          .from("argos_batch_queue")
          .select("id, status")
          .eq("unique_key", uniqueKey)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (fallback) {
          console.log(`[BatchQueue] Race condition resolvida: retornando item existente ${uniqueKey}.`);
          return fallback.id;
        }
      }
      throw error;
    }

    return data.id;
  }

  /**
   * Busca o próximo item da fila de forma atômica (via RPC com SKIP LOCKED).
   * Prioriza itens com maior prioridade e mais antigos.
   */
  async getNextInQueue(): Promise<QueueItem | null> {
    const { data, error } = await this.supabase.rpc("get_next_queue_item");

    if (error || !data || data.length === 0) return null;

    const item = data[0];
    const hasSinglePass = !!item.raw_data;
    console.log(
      `[BatchQueue-Worker] Consumindo: ${item.unique_key} | Single-Pass: ${hasSinglePass} | Prioridade: ${item.priority}`
    );

    return {
      id: item.id,
      matchId: item.match_id,
      marketFamily: item.market_family,
      uniqueKey: item.unique_key,
      requestedVerticals: item.requested_verticals,
      userId: item.user_id,
      status: QueueStatus.PROCESSING,
      priority: item.priority,
      rawData: item.raw_data,
      createdAt: item.created_at,
    };
  }

  /**
   * Atualiza o status de um item da fila.
   */
  async updateStatus(
    id: string,
    status: QueueStatus,
    errorMessage?: string
  ): Promise<void> {
    await this.supabase
      .from("argos_batch_queue")
      .update({
        status,
        error_message: errorMessage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);
  }

  /**
   * Limpeza automática da fila:
   * 1. Remove itens COMPLETED/FAILED/EXPIRED/REJECTED mais antigos que CLEANUP_RETENTION_HOURS
   */
  async cleanupQueue(): Promise<{ removed: number }> {
    let removed = 0;

    try {
      // Remover itens finalizados antigos (limpeza de histórico)
      const cutoffDate = new Date(
        Date.now() - CLEANUP_RETENTION_HOURS * 60 * 60 * 1000
      ).toISOString();

      const { data: removedItems } = await this.supabase
        .from("argos_batch_queue")
        .delete()
        .in("status", [
          QueueStatus.COMPLETED,
          QueueStatus.FAILED,
          QueueStatus.EXPIRED,
          QueueStatus.REJECTED,
          QueueStatus.SKIPPED,
        ])
        .lt("updated_at", cutoffDate)
        .select("id");

      removed = removedItems?.length ?? 0;

      if (removed > 0) {
        console.log(
          `[BatchQueue-Cleanup] Removidos: ${removed}`
        );
      }
    } catch (error: any) {
      console.error("[BatchQueue-Cleanup] Erro na limpeza:", error.message);
    }

    return { removed };
  }

  /**
   * Retorna estatísticas da fila para monitoramento.
   */
  async getQueueStats(): Promise<Record<string, number>> {
    const { data } = await this.supabase
      .from("argos_batch_queue")
      .select("status");

    if (!data) return {};

    const stats: Record<string, number> = {};
    for (const item of data) {
      stats[item.status] = (stats[item.status] || 0) + 1;
    }
    return stats;
  }
}
