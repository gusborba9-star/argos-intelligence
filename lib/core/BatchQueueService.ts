import { getSupabaseClient } from "@/lib/core/SupabaseClient";

// ============================================================
// BATCH QUEUE SERVICE v4.5 — INDUSTRIAL ORCHESTRATION
// Gerencia a fila de processamento para auditorias massivas
// ============================================================

export type QueueStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface QueueItem {
  id: string;
  matchId: string;
  requestedVerticals: string[];
  userId?: string; // Adicionado para rastreamento de usuário
  status: QueueStatus;
}

export class BatchQueueService {
  private supabase;

  constructor() {
    this.supabase = getSupabaseClient();
  }

  /**
   * Adiciona um jogo à fila de processamento
   */
  async enqueue(matchId: string, verticals: string[], userId?: string): Promise<string> {
    const { data, error } = await this.supabase
      .from("argos_batch_queue")
      .insert({
        match_id: matchId,
        requested_verticals: verticals,
        user_id: userId, // Persiste o userId na fila
        status: "QUEUED"
      })
      .select()
      .single();

    if (error) throw error;
    return data.id;
  }

  /**
   * Verifica se um jogo já está na fila com status QUEUED ou PROCESSING
   */
  async isAlreadyEnqueued(matchId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from("argos_batch_queue")
      .select("id")
      .eq("match_id", matchId)
      .in("status", ["QUEUED", "PROCESSING"])
      .maybeSingle();

    if (error) return false;
    return !!data;
  }

  /**
   * Busca o próximo item da fila para processamento, priorizando ligas Tier 1
   */
  async getNextInQueue(): Promise<QueueItem | null> {
    // Tenta buscar primeiro itens com prioridade manual alta
    const { data, error } = await this.supabase
      .from("argos_batch_queue")
      .select("*")
      .eq("status", "QUEUED")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;

    // Marcar como processando imediatamente (Atomicidade simulada)
    await this.updateStatus(data.id, "PROCESSING");

    return {
      id: data.id,
      matchId: data.match_id,
      requestedVerticals: data.requested_verticals,
      userId: data.user_id, // Retorna o userId
      status: "PROCESSING"
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
