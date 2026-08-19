/**
 * Evidence-based reliability diagnostics.
 *
 * Reliability is deliberately NOT probability. A prediction can be 72% while
 * the evidence supporting that estimate is weak. This score measures the
 * strength of the evidence chain without changing the model probability.
 */
export interface PredictionReliabilityInput {
  sampleSize: number;
  marketDivergence?: number;
  sharpReference?: boolean;
  bookmakerCount?: number;
  calibrationSource?: string;
  regime?: string;
}

export interface PredictionReliability {
  score: number;
  label: "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH";
  components: {
    sample: number;
    marketEvidence: number;
    agreement: number;
    calibration: number;
  };
}

const clamp01 = (value: number): number => Math.max(0, Math.min(1, value));

export function calculatePredictionReliability(input: PredictionReliabilityInput): PredictionReliability {
  const sample = Number.isFinite(input.sampleSize) && input.sampleSize > 0
    ? clamp01(Math.sqrt(input.sampleSize / 20))
    : 0;

  const bookmakerCount = Number.isFinite(input.bookmakerCount) ? Math.max(0, input.bookmakerCount as number) : 0;
  const marketEvidence = clamp01(bookmakerCount / 5 + (input.sharpReference ? 0.20 : 0));

  const divergence = Number.isFinite(input.marketDivergence) ? Math.max(0, input.marketDivergence as number) : 0.15;
  const agreement = clamp01(1 - divergence / 0.15);

  const calibration = input.calibrationSource?.startsWith("OOS_") ? 1 : 0.75;

  const score = clamp01(
    sample * 0.40 +
    marketEvidence * 0.20 +
    agreement * 0.20 +
    calibration * 0.20,
  );

  const label = score >= 0.85
    ? "VERY_HIGH"
    : score >= 0.70
      ? "HIGH"
      : score >= 0.50
        ? "MODERATE"
        : "LOW";

  return {
    score,
    label,
    components: { sample, marketEvidence, agreement, calibration },
  };
}
