import { getSupabaseClient } from "@/lib/core/SupabaseClient";

// ============================================================
// CALIBRATION ENGINE v6.2.0 — CONSERVATIVE ONLINE CALIBRATION
// Learning may correct a demonstrated historical bias, but it must never
// manufacture confidence from a small or heterogeneous sample.
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
  private static readonly MIN_SAMPLE_SIZE = 50;
  private static readonly PRIOR_SAMPLE_SIZE = 100;
  private static readonly MAX_ABSOLUTE_LOGIT_ADJUSTMENT = 0.05;
  private supabase = getSupabaseClient();

  public async getCalibration(leagueId: string, vertical: string): Promise<LearningCalibration> {
    try {
      const stats = await this.getInternalStats(leagueId, vertical);
      const baseFree = 0.70;
      const baseVip = 0.50;

      if (stats.sampleSize < ContinuousLearningEngine.MIN_SAMPLE_SIZE) {
        return {
          probabilityAdjustment: 0,
          expectedValueAdjustment: 0,
          dynamicThresholds: { free: baseFree, vip: baseVip },
          sampleSize: stats.sampleSize,
        };
      }

      // Empirical bias is shrunk toward zero. A mature sample receives more
      // influence, but even at large N the online correction remains tiny.
      const shrinkage = stats.sampleSize / (stats.sampleSize + ContinuousLearningEngine.PRIOR_SAMPLE_SIZE);
      const adjustment = this.clamp(
        stats.bias * shrinkage,
        -ContinuousLearningEngine.MAX_ABSOLUTE_LOGIT_ADJUSTMENT,
        ContinuousLearningEngine.MAX_ABSOLUTE_LOGIT_ADJUSTMENT,
      );

      return {
        probabilityAdjustment: adjustment,
        expectedValueAdjustment: 0,
        dynamicThresholds: { free: baseFree, vip: baseVip },
        sampleSize: stats.sampleSize,
      };
    } catch (error) {
      console.error("[CalibrationEngine] Erro ao obter calibração:", error);
      return {
        probabilityAdjustment: 0,
        expectedValueAdjustment: 0,
        dynamicThresholds: { free: 0.70, vip: 0.50 },
        sampleSize: 0,
      };
    }
  }

  private async getInternalStats(leagueId: string, vertical: string) {
    try {
      const { data, error } = await this.supabase
        .from("argos_signal_ledger")
        .select("probability, is_correct")
        .eq("league_id", leagueId)
        .eq("vertical", vertical)
        .not("is_correct", "is", null)
        .order("created_at", { ascending: false })
        .limit(200);

      if (error || !data || data.length < ContinuousLearningEngine.MIN_SAMPLE_SIZE) {
        return { bias: 0, sampleSize: data?.length || 0 };
      }

      const valid = data.filter((row) => Number.isFinite(Number(row.probability)) && typeof row.is_correct === "boolean");
      if (valid.length < ContinuousLearningEngine.MIN_SAMPLE_SIZE) return { bias: 0, sampleSize: valid.length };

      const avgPredicted = valid.reduce((sum, row) => sum + Number(row.probability), 0) / valid.length;
      const actualWinRate = valid.filter((row) => row.is_correct).length / valid.length;
      return { bias: actualWinRate - avgPredicted, sampleSize: valid.length };
    } catch {
      return { bias: 0, sampleSize: 0 };
    }
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
  }
}

export const learningEngine = new ContinuousLearningEngine();
