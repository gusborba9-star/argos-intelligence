import { getSupabaseClient } from "@/lib/core/SupabaseClient";

// ============================================================
// CALIBRATION ENGINE v6.1.0 — CONSULTATIVE EDITION
// Função: Ajustar thresholds dinâmicos por liga/vertical
// Filosofia: NÃO bloqueia sinais, apenas ajusta parâmetros de ranking.
// ============================================================

export interface LearningCalibration {
  probabilityAdjustment: number;
  expectedValueAdjustment: number;
  dynamicThresholds: {
    free: number;
    vip: number;
  };
  sampleSize: number;
}

export class ContinuousLearningEngine {
  private static readonly MIN_SAMPLE_SIZE = 20;
  private supabase = getSupabaseClient();

  /**
   * Obtém a calibração dinâmica baseada em percentis e histórico.
   * Atua como guia para o SignalClassifierV4.
   */
  public async getCalibration(leagueId: string, vertical: string): Promise<LearningCalibration> {
    try {
      const stats = await this.getInternalStats(leagueId, vertical);

      // Thresholds base (fallback)
      const baseFree = 0.70;
      const baseVip = 0.50;

      // Se houver dados suficientes, ajustamos os thresholds dinamicamente
      // Ex: Se a liga está muito difícil (bias negativo), aumentamos a exigência
      const adj = stats.bias; // bias negativo significa que o modelo está superestimando
      
      return {
        probabilityAdjustment: stats.bias,
        expectedValueAdjustment: stats.bias * 0.5,
        dynamicThresholds: {
          free: Math.min(0.85, Math.max(0.60, baseFree - adj)), // Ajuste inverso ao bias
          vip: Math.min(0.75, Math.max(0.40, baseVip - adj))
        },
        sampleSize: stats.sampleSize
      };
    } catch (error) {
      console.error("[CalibrationEngine] Erro ao obter calibração:", error);
      return {
        probabilityAdjustment: 0,
        expectedValueAdjustment: 0,
        dynamicThresholds: { free: 0.70, vip: 0.50 },
        sampleSize: 0
      };
    }
  }

  private async getInternalStats(leagueId: string, vertical: string) {
    const { data, error } = await this.supabase
      .from("argos_signal_ledger")
      .select("probability, is_correct")
      .eq("league_id", leagueId)
      .eq("vertical", vertical)
      .not("is_correct", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error || !data || data.length < ContinuousLearningEngine.MIN_SAMPLE_SIZE) {
      return { bias: 0, sampleSize: data?.length || 0 };
    }

    const avgPredicted = data.reduce((sum, s) => sum + s.probability, 0) / data.length;
    const actualWinRate = data.filter(s => s.is_correct).length / data.length;
    const bias = actualWinRate - avgPredicted;

    return { bias, sampleSize: data.length };
  }
}

export const learningEngine = new ContinuousLearningEngine();
