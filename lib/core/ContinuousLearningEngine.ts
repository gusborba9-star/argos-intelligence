import { getSupabaseClient } from "@/lib/core/SupabaseClient";

// ============================================================
// CALIBRATION ENGINE v6.3.0 — TIME-SPLIT, CONSERVATIVE
// Learning is a calibration layer, not a prediction generator.
// ============================================================

export interface LearningCalibration {
  /** Logit intercept applied by the canonical binary calibration path. */
  probabilityAdjustment: number;
  /** Diagnostic slope from the fitted calibration model. Not applied until promoted separately. */
  logitSlope: number;
  /** Diagnostic intercept of the fitted model. */
  logitIntercept: number;
  expectedValueAdjustment: number;
  dynamicThresholds: { free: number; vip: number };
  sampleSize: number;
  validationSampleSize: number;
  validationBrier: number | null;
}

interface Observation {
  probability: number;
  outcome: 0 | 1;
}

export class ContinuousLearningEngine {
  private static readonly MIN_TRAINING_SAMPLE = 80;
  private static readonly MIN_VALIDATION_SAMPLE = 20;
  private static readonly MAX_SLOPE = 1.25;
  private static readonly MIN_SLOPE = 0.80;
  private static readonly MAX_INTERCEPT = 0.05;
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

      const observations: Observation[] = data
        .map((row) => ({ probability: Number(row.probability), outcome: row.is_correct === true ? 1 : 0 }))
        .filter((row) => Number.isFinite(row.probability) && row.probability > 0 && row.probability < 1);

      if (observations.length < ContinuousLearningEngine.MIN_TRAINING_SAMPLE + ContinuousLearningEngine.MIN_VALIDATION_SAMPLE) {
        return { ...base, sampleSize: observations.length };
      }

      // Strict temporal split: the newest observations never train the transform.
      const validationSize = Math.max(ContinuousLearningEngine.MIN_VALIDATION_SAMPLE, Math.floor(observations.length * 0.2));
      const training = observations.slice(0, observations.length - validationSize);
      const validation = observations.slice(observations.length - validationSize);
      if (training.length < ContinuousLearningEngine.MIN_TRAINING_SAMPLE) {
        return { ...base, sampleSize: training.length, validationSampleSize: validation.length };
      }

      const fitted = this.fitLogisticCalibration(training);
      // Production currently applies only the intercept through ModelFactory.
      // Therefore the promotion gate evaluates exactly that transform.
      const promotedIntercept = this.clamp(fitted.intercept, -ContinuousLearningEngine.MAX_INTERCEPT, ContinuousLearningEngine.MAX_INTERCEPT);
      const calibratedPredictions = validation.map((o) => this.applyIntercept(o.probability, promotedIntercept));
      const validationBrier = this.brier(calibratedPredictions, validation);
      const baselineBrier = this.brier(validation.map((o) => o.probability), validation);

      // Calibration may only be promoted when out-of-sample performance is not
      // materially worse than the uncalibrated model.
      if (validationBrier > baselineBrier + 0.005) {
        return { ...base, sampleSize: training.length, validationSampleSize: validation.length, validationBrier };
      }

      return {
        probabilityAdjustment: promotedIntercept,
        logitSlope: fitted.slope,
        logitIntercept: fitted.intercept,
        expectedValueAdjustment: 0,
        dynamicThresholds: { free: 0.70, vip: 0.50 },
        sampleSize: training.length,
        validationSampleSize: validation.length,
        validationBrier,
      };
    } catch (error) {
      console.error("[CalibrationEngine] Erro ao obter calibração:", error);
      return base;
    }
  }

  private fitLogisticCalibration(observations: Observation[]): { slope: number; intercept: number } {
    let slope = 1;
    let intercept = 0;

    // Newton-Raphson logistic regression on logit(model probability).
    for (let iteration = 0; iteration < 20; iteration++) {
      let gSlope = 0;
      let gIntercept = 0;
      let hSS = 1e-6;
      let hSI = 0;
      let hII = 1e-6;

      for (const observation of observations) {
        const x = this.logit(observation.probability);
        const eta = slope * x + intercept;
        const p = this.sigmoid(eta);
        const weight = Math.max(1e-6, p * (1 - p));
        const residual = observation.outcome - p;
        gSlope += residual * x;
        gIntercept += residual;
        hSS += weight * x * x;
        hSI += weight * x;
        hII += weight;
      }

      const determinant = hSS * hII - hSI * hSI;
      if (!Number.isFinite(determinant) || Math.abs(determinant) < 1e-10) break;
      const deltaSlope = (gSlope * hII - gIntercept * hSI) / determinant;
      const deltaIntercept = (gIntercept * hSS - gSlope * hSI) / determinant;
      slope += deltaSlope;
      intercept += deltaIntercept;
      if (Math.abs(deltaSlope) + Math.abs(deltaIntercept) < 1e-7) break;
    }

    return {
      slope: this.clamp(slope, ContinuousLearningEngine.MIN_SLOPE, ContinuousLearningEngine.MAX_SLOPE),
      intercept: this.clamp(intercept, -ContinuousLearningEngine.MAX_INTERCEPT, ContinuousLearningEngine.MAX_INTERCEPT),
    };
  }

  private applyIntercept(probability: number, intercept: number): number {
    return this.sigmoid(this.logit(probability) + intercept);
  }

  private brier(predictions: number[], observations: Observation[]): number {
    if (observations.length === 0) return 0;
    return predictions.reduce((sum, prediction, index) => sum + (prediction - observations[index].outcome) ** 2, 0) / observations.length;
  }

  private logit(probability: number): number {
    const p = this.clamp(probability, 0.0001, 0.9999);
    return Math.log(p / (1 - p));
  }

  private sigmoid(value: number): number {
    if (value >= 0) {
      const e = Math.exp(-value);
      return 1 / (1 + e);
    }
    const e = Math.exp(value);
    return e / (1 + e);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
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
    };
  }
}

export const learningEngine = new ContinuousLearningEngine();
