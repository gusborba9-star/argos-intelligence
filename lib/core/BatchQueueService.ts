import { MarketVertical } from "./ArgosUnifiedEngine";
import { getSupabaseClient } from "@/lib/core/SupabaseClient";

// ============================================================
// BATCH QUEUE SERVICE v4.5 — INDUSTRIAL ORCHESTRATION
// Gerencia a fila de processamento para auditorias massivas
// ============================================================

export enum QueueStatus {
  DISCOVERED = "DISCOVERED",
  VALIDATED = "VALIDATED",
  QUEUED = "QUEUED",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  REJECTED = "REJECTED",
}

export interface QueueItem {
  id: string;
  matchId: string;
  marketFamily: string; // Nova chave operacional: ex: GOALS, CORNERS
  uniqueKey: string; // matchId + marketFamily
  requestedVerticals: MarketVertical[];
  userId?: string; // Adicionado para rastreamento de usuário
  status: QueueStatus;
  priority?: number; // Adicionado para priorização
}

export class BatchQueueService {
  private supabase;

  constructor() {
    this.supabase = getSupabaseClient();
  }

  /**
   * Adiciona um jogo à fila de processamento
   */
  async enqueue(matchId: string, marketFamily: string, verticals: string[], userId?: string, status: QueueStatus = QueueStatus.QUEUED, priority: number = 0): Promise<string> {
        const uniqueKey = `${matchId}_${marketFamily}`;
    const safeVerticals = (verticals || []).filter(v =>
      Object.values(MarketVertical).includes(v as MarketVertical)
    );

    const { data, error } = await this.supabase
      .from("argos_batch_queue")
      .insert({
        match_id: matchId,
        market_family: marketFamily,
        unique_key: uniqueKey,
        requested_verticals: safeVerticals,
        user_id: userId,
        status: status,
        priority: priority,
      })
      .select()
      .single();

    if (error) {
            if (error.code === "23505") {
        console.log(`[BatchQueueService] Item com uniqueKey ${uniqueKey} já existe na fila.`);

        const { data: existing, error: fetchError } = await this.supabase
          .from("argos_batch_queue")
          .select("id")
          .eq("unique_key", uniqueKey)
          .limit(1)
          .single();

        if (fetchError || !existing) {
          throw fetchError || new Error("Registro duplicado não encontrado.");
        }

        return existing.id;
      }

      throw error;
    }

    return data.id;
  }

  /**
   * Verifica se um jogo já está na fila com status QUEUED ou PROCESSING
   */
    async isAlreadyEnqueued(uniqueKey: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("argos_batch_queue")
      .select("id")
      .eq("unique_key", uniqueKey)
      .in("status", [QueueStatus.QUEUED, QueueStatus.PROCESSING])
      .limit(1);

    if (error) {
      console.error("[BatchQueueService] Erro verificando duplicidade:", error.message);
      return false;
    }

    return !!data && data.length > 0;
  }

  /**
   * Busca o próximo item da fila para processamento, priorizando ligas Tier 1.
   * Implementa um lock de processamento para garantir idempotência real.
   */
  async getNextInQueue(): Promise<QueueItem | null> {
    // Usamos uma transação simulada via Supabase RPC ou uma lógica de update atômico
    // Para simplificar no Supabase, tentamos dar update em um registro QUEUED para PROCESSING
    // e o que conseguirmos o update, nós retornamos.
    
    const { data, error } = await this.supabase.rpc('get_next_queue_item');

    if (error) {
      console.error("[BatchQueueService] Erro ao buscar próximo item da fila via RPC:", error.message);
      
      // Fallback para o método antigo se o RPC não existir (embora devamos criá-lo)
      const { data: fallbackData, error: fallbackError } = await this.supabase
        .from("argos_batch_queue")
        .select("*")
        .eq("status", QueueStatus.QUEUED)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (fallbackError || !fallbackData) return null;

      // Tentativa de lock simples
      const { error: updateError } = await this.supabase
        .from("argos_batch_queue")
        .update({ status: QueueStatus.PROCESSING, updated_at: new Date().toISOString() })
        .eq("id", fallbackData.id)
        .eq("status", QueueStatus.QUEUED); // Garantia de que ainda está QUEUED

      if (updateError) return null; // Outro worker pegou primeiro

      return {
        id: fallbackData.id,
        matchId: fallbackData.match_id,
        marketFamily: fallbackData.market_family,
        uniqueKey: fallbackData.unique_key,
        requestedVerticals: fallbackData.requested_verticals,
        userId: fallbackData.user_id,
        status: QueueStatus.PROCESSING,
        priority: fallbackData.priority,
      };
    }

    if (!data || data.length === 0) return null;

    const item = data[0];
    return {
      id: item.id,
      matchId: item.match_id,
      marketFamily: item.market_family,
      uniqueKey: item.unique_key,
      requestedVerticals: item.requested_verticals,
      userId: item.user_id,
      status: QueueStatus.PROCESSING,
      priority: item.priority,
    };
  }

  /**
   * Atualiza o status de um item na fila
   */
  async updateStatus(id: string, status: QueueStatus, errorMessage?: string): Promise<void> {
    await this.supabase
      .from("argos_batch_queue")
      .update({ 
        status, 
        error_message: errorMessage,
        updated_at: new Date().toISOString()
      })
      .eq("id", id);
  }
}
