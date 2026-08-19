import { MarketVertical } from "./ArgosUnifiedEngine";
import { getSupabaseClient } from "@/lib/core/SupabaseClient";

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
  rawData?: any;
  createdAt?: string;
}

const CLEANUP_RETENTION_HOURS = 24;
// A match may be discovered earlier, but quantitative execution requires a
// fresh pre-match snapshot. Keep this identical to the scheduler gate so a
// stale queued item cannot bypass the admission policy.
export const MAX_ANALYSIS_HORIZON_HOURS = 24;

export class BatchQueueService {
  private supabase;

  constructor() {
    this.supabase = getSupabaseClient();
  }

  async enqueue(
    matchId: string,
    marketFamily: string,
    verticals: string[],
    rawData?: any,
    status: QueueStatus = QueueStatus.QUEUED,
    priority: number = 0
  ): Promise<string> {
    const uniqueKey = `${matchId}_${marketFamily}`;
    const safeVerticals = (verticals || []).filter((v) => Object.values(MarketVertical).includes(v as MarketVertical));

    if (!rawData || (!rawData.id && !rawData.match_id)) {
      throw new Error(`[BatchQueue] Dados brutos inválidos para ${uniqueKey}`);
    }

    const kickoff = rawData.commence_time ? new Date(rawData.commence_time).getTime() : null;
    if (kickoff && kickoff < Date.now() - 10 * 60 * 1000) {
      throw new Error(`[BatchQueue] Kickoff expirado para ${uniqueKey}`);
    }
    if (kickoff && ((kickoff - Date.now()) / (1000 * 60 * 60)) > MAX_ANALYSIS_HORIZON_HOURS) {
      throw new Error(`[BatchQueue] Partida fora da janela de maturidade quantitativa para ${uniqueKey}`);
    }

    const COOLDOWN_MS = 60 * 60 * 1000;
    const { data: existing } = await this.supabase
      .from("argos_batch_queue")
      .select("id, status, created_at, updated_at")
      .eq("unique_key", uniqueKey)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing && [QueueStatus.COMPLETED, QueueStatus.FAILED].includes(existing.status as QueueStatus)) {
      const lastUpdate = new Date(existing.updated_at || existing.created_at).getTime();
      if (Date.now() - lastUpdate < COOLDOWN_MS) return existing.id;
    }

    if (rawData.home_team && rawData.away_team) {
      const TEAM_PAIR_COOLDOWN_MS = 18 * 60 * 60 * 1000;
      const { data: recentSameTeams } = await this.supabase
        .from("argos_batch_queue")
        .select("id, updated_at, created_at")
        .eq("status", QueueStatus.COMPLETED)
        .contains("raw_data", { home_team: rawData.home_team, away_team: rawData.away_team })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentSameTeams) {
        const last = new Date(recentSameTeams.updated_at || recentSameTeams.created_at).getTime();
        if (Date.now() - last < TEAM_PAIR_COOLDOWN_MS) {
          throw new Error(`[BatchQueue] Confronto já analisado recentemente: ${rawData.home_team} vs ${rawData.away_team}`);
        }
      }
    }

    if (existing && existing.status === QueueStatus.QUEUED) {
      const { data: updated, error: updateErr } = await this.supabase
        .from("argos_batch_queue")
        .update({ raw_data: rawData, requested_verticals: safeVerticals, updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select()
        .single();
      if (!updateErr) return updated.id;
    }

    if (existing && [QueueStatus.VALIDATED, QueueStatus.PROCESSING].includes(existing.status as QueueStatus)) return existing.id;

    const { data, error } = await this.supabase
      .from("argos_batch_queue")
      .insert({ match_id: matchId, market_family: marketFamily, unique_key: uniqueKey, requested_verticals: safeVerticals, raw_data: rawData, status, priority })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        const { data: fallback } = await this.supabase.from("argos_batch_queue").select("id, status").eq("unique_key", uniqueKey).order("created_at", { ascending: false }).limit(1).single();
        if (fallback) return fallback.id;
      }
      throw error;
    }
    return data.id;
  }

  /**
   * Fetches the next item atomically. Temporal validation happens AGAIN here,
   * immediately before quantitative execution, so stale queued data cannot
   * bypass the scheduler gate.
   */
  async getNextInQueue(): Promise<QueueItem | null> {
    const { data, error } = await this.supabase.rpc("get_next_queue_item");
    if (error || !data || data.length === 0) return null;

    const item = data[0];
    const rawData = item.raw_data;
    const kickoff = rawData?.commence_time ? new Date(rawData.commence_time).getTime() : NaN;
    const hoursToKickoff = (kickoff - Date.now()) / (1000 * 60 * 60);

    if (!Number.isFinite(kickoff) || hoursToKickoff < 0 || hoursToKickoff > MAX_ANALYSIS_HORIZON_HOURS) {
      console.warn(`[BatchQueue] ⏭️ Temporal gate: ${item.unique_key} skipped (${Number.isFinite(hoursToKickoff) ? `${hoursToKickoff.toFixed(1)}h` : "invalid kickoff"}).`);
      await this.updateStatus(item.id, QueueStatus.SKIPPED, "OUTSIDE_ANALYSIS_HORIZON");
      return this.getNextInQueue();
    }

    return {
      id: item.id,
      matchId: item.match_id,
      marketFamily: item.market_family,
      uniqueKey: item.unique_key,
      requestedVerticals: item.requested_verticals,
      userId: item.user_id,
      status: QueueStatus.PROCESSING,
      priority: item.priority,
      rawData,
      createdAt: item.created_at,
    };
  }

  async updateStatus(id: string, status: QueueStatus, errorMessage?: string): Promise<void> {
    await this.supabase.from("argos_batch_queue").update({ status, error_message: errorMessage, updated_at: new Date().toISOString() }).eq("id", id);
  }

  async cleanupQueue(): Promise<{ removed: number }> {
    let removed = 0;
    try {
      const cutoffDate = new Date(Date.now() - CLEANUP_RETENTION_HOURS * 60 * 60 * 1000).toISOString();
      const { data: removedItems } = await this.supabase
        .from("argos_batch_queue")
        .delete()
        .in("status", [QueueStatus.COMPLETED, QueueStatus.FAILED, QueueStatus.EXPIRED, QueueStatus.REJECTED, QueueStatus.SKIPPED])
        .lt("updated_at", cutoffDate)
        .select("id");
      removed = removedItems?.length ?? 0;
    } catch (error: any) {
      console.error("[BatchQueue-Cleanup] Erro na limpeza:", error.message);
    }
    return { removed };
  }

  async getQueueStats(): Promise<Record<string, number>> {
    const { data } = await this.supabase.from("argos_batch_queue").select("status");
    if (!data) return {};
    const stats: Record<string, number> = {};
    for (const item of data) stats[item.status] = (stats[item.status] || 0) + 1;
    return stats;
  }
}
