export interface CalibrationObservation {
  probability: number;
  outcome: 0 | 1;
}

export interface CalibrationFit {
  slope: number;
  intercept: number;
}

const MIN_SLOPE = 0.8;
const MAX_SLOPE = 1.25;
const MAX_INTERCEPT = 0.05;
const MIN_PROBABILITY = 0.0001;

export function fitLogisticCalibration(observations: CalibrationObservation[]): CalibrationFit {
  let slope = 1;
  let intercept = 0;

  for (let iteration = 0; iteration < 20; iteration++) {
    let gSlope = 0;
    let gIntercept = 0;
    let hSS = 1e-6;
    let hSI = 0;
    let hII = 1e-6;

    for (const observation of observations) {
      const x = logit(observation.probability);
      const p = sigmoid(slope * x + intercept);
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
    slope: clamp(slope, MIN_SLOPE, MAX_SLOPE),
    intercept: clamp(intercept, -MAX_INTERCEPT, MAX_INTERCEPT),
  };
}

/** Apply the complete promoted logistic calibration transform. */
export function applyCalibration(
  probability: number,
  slope: number,
  intercept: number,
): number {
  const safeSlope = clamp(slope, MIN_SLOPE, MAX_SLOPE);
  const safeIntercept = clamp(intercept, -MAX_INTERCEPT, MAX_INTERCEPT);
  return sigmoid(safeSlope * logit(probability) + safeIntercept);
}

/** Backward-compatible intercept-only transform. */
export function applyCalibrationIntercept(probability: number, intercept: number): number {
  return applyCalibration(probability, 1, intercept);
}

export function brierScore(predictions: number[], observations: CalibrationObservation[]): number {
  if (predictions.length !== observations.length) {
    throw new Error("Brier score requires prediction and observation arrays of equal length");
  }
  if (observations.length === 0) return 0;

  return predictions.reduce(
    (sum, prediction, index) => sum + (prediction - observations[index].outcome) ** 2,
    0,
  ) / observations.length;
}

export function logLoss(predictions: number[], observations: CalibrationObservation[]): number {
  if (predictions.length !== observations.length) {
    throw new Error("Log loss requires prediction and observation arrays of equal length");
  }
  if (observations.length === 0) return 0;

  return predictions.reduce((sum, prediction, index) => {
    const p = clamp(prediction, MIN_PROBABILITY, 1 - MIN_PROBABILITY);
    const outcome = observations[index].outcome;
    return sum - (outcome * Math.log(p) + (1 - outcome) * Math.log(1 - p));
  }, 0) / observations.length;
}

function logit(probability: number): number {
  const p = clamp(probability, MIN_PROBABILITY, 1 - MIN_PROBABILITY);
  return Math.log(p / (1 - p));
}

function sigmoid(value: number): number {
  if (value >= 0) {
    const e = Math.exp(-value);
    return 1 / (1 + e);
  }
  const e = Math.exp(value);
  return e / (1 + e);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : 0));
}
