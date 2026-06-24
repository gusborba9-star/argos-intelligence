import { MarketVertical } from "./ArgosUnifiedEngine";
import { getSupabaseClient } from "@/lib/core/SupabaseClient";

// ============================================================
// BATCH QUEUE SERVICE v4.6 — INDUSTRIAL TELEMETRY
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
}

export class BatchQueueService {
  private supabase;

  constructor() {
    this.supabase = getSupabaseClient();
  }

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
        const { data: existing } = await this.supabase
          .from("argos_batch_queue")
          .select("id, status, created_at")
          .eq("unique_key", uniqueKey)
          .order("created_at", { ascending: false })
          .limit(1)
          .single();

        if (existing) {
          console.log(`[BatchQueue-Trace] Item ${uniqueKey} já existe. Status: ${existing.status} | Criado em: ${existing.created_at}`);
          return existing.id;
        }
      }
      throw error;
    }

    return data.id;
  }

  async isAlreadyEnqueued(matchId: string, marketFamily: string = "ALL_MARKETS"): Promise<boolean> {
    const uniqueKey = `${matchId}_${marketFamily}`;
    const { data, error } = await this.supabase
      .from("argos_batch_queue")
      .select("id, status, created_at")
      .eq("unique_key", uniqueKey)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error || !data || data.length === 0) return false;

    const lastEntry = data[0];
    const isRecent = (new Date().getTime() - new Date(lastEntry.created_at).getTime()) < (12 * 60 * 60 * 1000); 

    // Argos v5.2: Se o status for COMPLETED mas já faz mais de 2 horas, permitimos re-enfileirar para atualizar odds
    if (lastEntry.status === QueueStatus.COMPLETED) {
      const isVeryRecent = (new Date().getTime() - new Date(lastEntry.created_at).getTime()) < (2 * 60 * 60 * 1000);
      return isVeryRecent;
    }

    return [QueueStatus.QUEUED, QueueStatus.PROCESSING].includes(lastEntry.status) && isRecent;
  }

  async getNextInQueue(): Promise<QueueItem | null> {
    const { data, error } = await this.supabase.rpc('get_next_queue_item');

    if (error || !data || data.length === 0) return null;

    const item = data[0];
    console.log(`[BatchQueue-Worker] Consumindo item: ${item.unique_key} (ID: ${item.id})`);
    
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

  async updateStatus(id: string, status: QueueStatus, errorMessage?: string): Promise<void> {
    if (status === QueueStatus.COMPLETED) {
      console.log(`[Argos-Processamento] Item ID ${id} concluído com sucesso.`);
    }
    
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
