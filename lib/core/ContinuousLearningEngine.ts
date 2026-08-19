import { getSupabaseClient } from "@/lib/core/SupabaseClient";
import {
  applyCalibration,
  brierScore,
  fitLogisticCalibration,
  logLoss,
  type CalibrationObservation,
} from "./CalibrationMath";

// ============================================================
// CALIBRATION ENGINE v6.5.0 — TIME-SPLIT, CONSERVATIVE
// Learning is a calibration layer, not a prediction generator.
// ============================================================

export interface LearningCalibration {
  probabilityAdjustment: number;
  logitSlope: number;
  logitIntercept: number;
  expectedValueAdjustment: number;
  dynamicThresholds: { free: number; vip: number };
  sampleSize: number;
  validationSampleSize: number;
  validationBrier: number | null;
  validationLogLoss: number | null;
}

export class ContinuousLearningEngine {
  private static readonly MIN_TRAINING_SAMPLE = 80;
  private static readonly MIN_VALIDATION_SAMPLE = 20;
  private static readonly MAX_INTERCEPT = 0.05;
  private static readonly MIN_SLOPE = 0.8;
  private static readonly MAX_SLOPE = 1.25;
  private static readonly MAX_ROWS = 500;
  private supabase = getSupabaseClient();

  public async getCalibration(leagueId: string, vertical: string): Promise<LearningCalibration> {
    const base = this.safeDefault();
    try {
      const { data, error } = await this.supabase
        .from("argos_signal_ledger")
        .select("probability, is_correct, created_at")
        .eq("league_id", leagueId)
        .eq("vertical", vertical)
        .not("is_correct", "is", null)
        .not("probability", "is", null)
        .order("created_at", { ascending: true })
        .limit(ContinuousLearningEngine.MAX_ROWS);

      if (error || !data) return base;

      const observations: CalibrationObservation[] = data
        .map((row): CalibrationObservation => ({
          probability: Number(row.probability),
          outcome: row.is_correct === true ? 1 : 0,
        }))
        .filter(
          (row) =>
            Number.isFinite(row.probability) &&
            row.probability > 0 &&
            row.probability < 1,
        );

      const minimumRows =
        ContinuousLearningEngine.MIN_TRAINING_SAMPLE +
        ContinuousLearningEngine.MIN_VALIDATION_SAMPLE;
      if (observations.length < minimumRows) {
        return { ...base, sampleSize: observations.length };
      }

      // Strict temporal split: the newest observations never train the transform.
      const validationSize = Math.max(
        ContinuousLearningEngine.MIN_VALIDATION_SAMPLE,
        Math.floor(observations.length * 0.2),
      );
      const training = observations.slice(0, observations.length - validationSize);
      const validation = observations.slice(observations.length - validationSize);

      if (training.length < ContinuousLearningEngine.MIN_TRAINING_SAMPLE) {
        return {
          ...base,
          sampleSize: training.length,
          validationSampleSize: validation.length,
        };
      }

      const fitted = fitLogisticCalibration(training);
      const promotedSlope = Math.max(
        ContinuousLearningEngine.MIN_SLOPE,
        Math.min(ContinuousLearningEngine.MAX_SLOPE, fitted.slope),
      );
      const promotedIntercept = Math.max(
        -ContinuousLearningEngine.MAX_INTERCEPT,
        Math.min(ContinuousLearningEngine.MAX_INTERCEPT, fitted.intercept),
      );

      const calibratedPredictions = validation.map((observation) =>
        applyCalibration(observation.probability, promotedSlope, promotedIntercept),
      );
      const baselinePredictions = validation.map((observation) => observation.probability);
      const validationBrier = brierScore(calibratedPredictions, validation);
      const baselineBrier = brierScore(baselinePredictions, validation);
      const validationLogLoss = logLoss(calibratedPredictions, validation);
      const baselineLogLoss = logLoss(baselinePredictions, validation);

      // Promotion is strictly out-of-sample. Calibration must not materially
      // degrade either proper scoring rule before it can influence production.
      const brierDegrades = validationBrier > baselineBrier + 0.005;
      const logLossDegrades = validationLogLoss > baselineLogLoss + 0.02;
      if (brierDegrades || logLossDegrades) {
        return {
          ...base,
          sampleSize: training.length,
          validationSampleSize: validation.length,
          validationBrier,
          validationLogLoss,
        };
      }

      return {
        probabilityAdjustment: promotedIntercept,
        logitSlope: promotedSlope,
        logitIntercept: promotedIntercept,
        expectedValueAdjustment: 0,
        dynamicThresholds: { free: 0.70, vip: 0.50 },
        sampleSize: training.length,
        validationSampleSize: validation.length,
        validationBrier,
        validationLogLoss,
      };
    } catch (error) {
      console.error("[CalibrationEngine] Erro ao obter calibração:", error);
      return base;
    }
  }

  private safeDefault(): LearningCalibration {
    return {
      probabilityAdjustment: 0,
      logitSlope: 1,
      logitIntercept: 0,
      expectedValueAdjustment: 0,
      dynamicThresholds: { free: 0.70, vip: 0.50 },
      sampleSize: 0,
      validationSampleSize: 0,
      validationBrier: null,
      validationLogLoss: null,
    };
  }
}

export const learningEngine = new ContinuousLearningEngine();
