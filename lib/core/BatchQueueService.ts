import { MarketVertical } from "./ArgosUnifiedEngine";
import { getSupabaseClient } from "@/lib/core/SupabaseClient";

// ============================================================
// BATCH QUEUE SERVICE v6.0.0 — SYNDICATE MASTER EDITION
// Single-Pass Transport com:
//   - Payload completo (rawData) na fila
//   - Limpeza automática de itens expirados/concluídos
//   - Expiração configurável por item
//   - Prevenção de duplicidade por unique_key
//   - Zero chamada desnecessária à API externa
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

// Tempo máximo que um item pode ficar na fila antes de expirar (horas)
const QUEUE_EXPIRY_HOURS = 6;
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

    // Verificar se já existe item ativo (QUEUED, VALIDATED, PROCESSING)
    const { data: existing } = await this.supabase
      .from("argos_batch_queue")
      .select("id, status, created_at")
      .eq("unique_key", uniqueKey)
      .in("status", [QueueStatus.QUEUED, QueueStatus.VALIDATED, QueueStatus.PROCESSING])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      console.log(
        `[BatchQueue] Duplicidade prevenida: ${uniqueKey} já está na fila com status ${existing.status}.`
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
        expires_at: this.calculateExpiry(QUEUE_EXPIRY_HOURS),
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
   * 1. Marca como EXPIRED itens QUEUED/VALIDATED que ultrapassaram expires_at
   * 2. Remove itens COMPLETED/FAILED/EXPIRED/REJECTED mais antigos que CLEANUP_RETENTION_HOURS
   */
  async cleanupQueue(): Promise<{ expired: number; removed: number }> {
    let expired = 0;
    let removed = 0;

    try {
      // 1. Expirar itens que ultrapassaram o tempo limite
      const { data: expiredItems } = await this.supabase
        .from("argos_batch_queue")
        .update({ status: QueueStatus.EXPIRED, updated_at: new Date().toISOString() })
        .in("status", [QueueStatus.QUEUED, QueueStatus.VALIDATED])
        .lt("expires_at", new Date().toISOString())
        .select("id");

      expired = expiredItems?.length ?? 0;

      // 2. Remover itens finalizados antigos (limpeza de histórico)
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
        ])
        .lt("updated_at", cutoffDate)
        .select("id");

      removed = removedItems?.length ?? 0;

      if (expired > 0 || removed > 0) {
        console.log(
          `[BatchQueue-Cleanup] Expirados: ${expired} | Removidos: ${removed}`
        );
      }
    } catch (error: any) {
      console.error("[BatchQueue-Cleanup] Erro na limpeza:", error.message);
    }

    return { expired, removed };
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

  private calculateExpiry(hours: number): string {
    return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  }
}
