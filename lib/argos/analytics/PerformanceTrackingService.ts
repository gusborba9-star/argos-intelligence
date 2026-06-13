import { getSupabaseClient } from "@/lib/core/SupabaseClient";

export interface PerformanceMetrics {
  total_signals_delivered: number;
  total_signals_won: number;
  total_signals_lost: number;
  win_rate: number; // Percentual
  average_brier_score: number;
  average_clv_percentage: number;
  roi_percentage: number;
}

export interface UserPerformance {
  user_id: string;
  tier: 'FREE' | 'PRO' | 'WHALE/VIP';
  signals_delivered: number;
  signals_won: number;
  win_rate: number;
  average_clv: number;
  roi: number;
}

export class PerformanceTrackingService {
  private supabase;

  constructor() {
    this.supabase = getSupabaseClient();
  }

  /**
   * Obtém as estatísticas públicas do Argos (para o dashboard público).
   * @returns Métricas de performance agregadas.
   */
  public async getPublicStatistics(): Promise<PerformanceMetrics | null> {
    const { data, error } = await this.supabase
      .rpc('get_argos_public_statistics');

    if (error) {
      console.error("[PerformanceTrackingService] Erro ao buscar estatísticas públicas:", error);
      return null;
    }

    return data?.[0] || null;
  }

  /**
   * Obtém a performance de um usuário específico.
   * @param userId ID do usuário.
   * @returns Dados de performance do usuário.
   */
  public async getUserPerformance(userId: string): Promise<UserPerformance | null> {
    const { data, error } = await this.supabase
      .from('argos_performance_tracking')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error("[PerformanceTrackingService] Erro ao buscar performance do usuário:", error);
      return null;
    }

    if (!data || data.length === 0) {
      return null;
    }

    const signals_won = data.filter(d => d.settled_status === 'WIN').length;
    const signals_lost = data.filter(d => d.settled_status === 'LOSS').length;
    const total_signals = data.filter(d => d.settled_status !== null).length;

    const average_clv = data.reduce((sum, d) => sum + (d.clv_percentage || 0), 0) / data.length;
    const total_roi = data.reduce((sum, d) => {
      if (d.settled_status === 'WIN') return sum + (d.kelly_stake || 0);
      if (d.settled_status === 'LOSS') return sum - (d.kelly_stake || 0);
      return sum;
    }, 0);

    return {
      user_id: userId,
      tier: 'PRO', // Será obtido do user_tiers em um contexto real
      signals_delivered: data.length,
      signals_won,
      win_rate: total_signals > 0 ? (signals_won / total_signals) * 100 : 0,
      average_clv,
      roi: total_roi
    };
  }

  /**
   * Registra o resultado de um sinal após o fechamento do mercado.
   * @param signalDeliveryId ID do log de entrega do sinal.
   * @param settledStatus Status final ('WIN', 'LOSS', 'VOID').
   * @param closingOdds Odd de fechamento do mercado.
   * @param brierScore Brier Score calculado.
   */
  public async recordSignalResult(
    signalDeliveryId: string,
    settledStatus: 'WIN' | 'LOSS' | 'VOID',
    closingOdds: number,
    brierScore: number
  ): Promise<void> {
    // Primeiro, buscar o log de entrega para obter informações do sinal
    const { data: deliveryLog, error: fetchError } = await this.supabase
      .from('signal_delivery_log')
      .select('*')
      .eq('id', signalDeliveryId)
      .single();

    if (fetchError || !deliveryLog) {
      console.error("[PerformanceTrackingService] Erro ao buscar log de entrega:", fetchError);
      return;
    }

    // Buscar o sinal original para obter as odds de abertura
    const { data: signal, error: signalError } = await this.supabase
      .from('argos_signal_ledger')
      .select('*')
      .eq('id', deliveryLog.signal_id)
      .single();

    if (signalError || !signal) {
      console.error("[PerformanceTrackingService] Erro ao buscar sinal:", signalError);
      return;
    }

    const opening_odds = signal.implied_odds || 0;
    const clv_percentage = opening_odds > 0 ? ((closingOdds - opening_odds) / opening_odds) * 100 : 0;

    // Registrar o resultado na tabela de performance
    const { error: insertError } = await this.supabase
      .from('argos_performance_tracking')
      .insert({
        signal_delivery_id: signalDeliveryId,
        user_id: deliveryLog.user_id,
        signal_id: deliveryLog.signal_id,
        market: signal.market,
        vertical: signal.vertical,
        probability: signal.probability,
        implied_odds: opening_odds,
        kelly_stake: signal.units || 0, // Assumindo que 'units' é o stake
        settled_status: settledStatus,
        settled_at: new Date().toISOString(),
        brier_score: brierScore,
        market_opening_odds: opening_odds,
        market_closing_odds: closingOdds,
        clv_percentage
      });

    if (insertError) {
      console.error("[PerformanceTrackingService] Erro ao registrar resultado do sinal:", insertError);
    }
  }
}
