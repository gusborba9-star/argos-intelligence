import { createClient } from "@supabase/supabase-js";

// ============================================================
// BATCH QUEUE SERVICE v4.5 — INDUSTRIAL ORCHESTRATION
// Gerencia a fila de processamento para auditorias massivas
// ============================================================

export type QueueStatus = "QUEUED" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface QueueItem {
  id: string;
  matchId: string;
  requestedVerticals: string[];
  status: QueueStatus;
}

export class BatchQueueService {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Adiciona um jogo à fila de processamento
   */
  async enqueue(matchId: string, verticals: string[]): Promise<string> {
    const { data, error } = await this.supabase
      .from("argos_batch_queue")
      .insert({
        match_id: matchId,
        requested_verticals: verticals,
        status: "QUEUED"
      })
      .select()
      .single();

    if (error) throw error;
    return data.id;
  }

  /**
   * Busca o próximo item da fila para processamento
   */
  async getNextInQueue(): Promise<QueueItem | null> {
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
