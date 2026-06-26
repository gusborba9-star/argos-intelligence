import { getSupabaseClient } from "@/lib/core/SupabaseClient";

/**
 * QUEUE MAINTENANCE v6.0.0 — SYNDICATE EDITION
 * Limpeza de itens expirados e otimização da fila de processamento.
 */
export class QueueMaintenance {
  private static supabase = getSupabaseClient();

  public static async cleanup(): Promise<void> {
    console.log("[Argos-Maintenance] 🧹 Iniciando limpeza de fila v6.0.0...");
    
    // 1. Marcar como EXPIRED itens com mais de 12h na fila
    const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
    
    const { error: expireError } = await this.supabase
      .from("argos_batch_queue")
      .update({ status: "EXPIRED" })
      .eq("status", "QUEUED")
      .lt("created_at", twelveHoursAgo);

    if (expireError) console.error("[Maintenance] Erro ao expirar itens:", expireError.message);

    // 2. Limpar logs de auditoria antigos (> 7 dias)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    
    const { error: logError } = await this.supabase
      .from("argos_signal_ledger")
      .delete()
      .lt("created_at", sevenDaysAgo);

    if (logError) console.error("[Maintenance] Erro ao limpar ledger:", logError.message);

    console.log("[Argos-Maintenance] ✅ Limpeza concluída.");
  }
}
