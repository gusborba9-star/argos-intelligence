import { PredictionResult } from "./PredictionCore";
import { HandicapSettlementProbability } from "./HandicapSettlement";

export const PROBABILITY_EPSILON = 1e-9;

export function assertProbability(value: number, name: string): void {
  if (!Number.isFinite(value) || value < -PROBABILITY_EPSILON || value > 1 + PROBABILITY_EPSILON) {
    throw new Error(`Invariant violation: ${name} must be within [0,1].`);
  }
}

export function assertNormalized(values: readonly number[], name: string, epsilon = PROBABILITY_EPSILON): void {
  values.forEach((value, index) => assertProbability(value, `${name}[${index}]`));
  const sum = values.reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > epsilon) throw new Error(`Invariant violation: ${name} must sum to 1; received ${sum}.`);
}

export function validatePredictionInvariants(result: PredictionResult): void {
  assertNormalized([result.probabilities.homeWin, result.probabilities.draw, result.probabilities.awayWin], "1X2");
  assertNormalized([result.probabilities.bttsYes, result.probabilities.bttsNo], "BTTS");
  const scoreTotal = result.scoreMatrix.reduce((sum, cell) => sum + cell.probability, 0);
  if (Math.abs(scoreTotal - 1) > 1e-9) throw new Error(`Invariant violation: score matrix must sum to 1; received ${scoreTotal}.`);
}

export function validateHandicapSettlementInvariants(value: HandicapSettlementProbability): void {
  assertNormalized([value.win, value.halfWin, value.push, value.halfLoss, value.loss], "handicap settlement");
}
