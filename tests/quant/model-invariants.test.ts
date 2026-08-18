import assert from "node:assert/strict";
import { ModelFactory } from "../../lib/core/ModelFactory";

const regime = {
  variance_multiplier: 1.1,
  model_bias: 0,
  market_regime: "NEUTRAL",
} as any;

const result = ModelFactory.runMonteCarlo(
  { homeMean: 1.55, awayMean: 1.05 },
  regime,
  20000,
  "GOALS"
);

assert.equal(result.iterations, 20000);
assert.ok(Number.isFinite(result.expectedGoals));
assert.ok(result.expectedGoals > 0);

const oneXTwo = result.probabilities.home + result.probabilities.draw + result.probabilities.away;
assert.ok(Math.abs(oneXTwo - 1) < 1e-12, `1X2 probabilities must sum to 1, got ${oneXTwo}`);

for (const [key, value] of Object.entries(result.probabilities)) {
  assert.ok(value !== undefined && Number.isFinite(value), `${key} must be finite`);
  assert.ok((value as number) >= 0 && (value as number) <= 1, `${key} must be in [0,1]`);
}

assert.ok(Math.abs((result.probabilities.over_2.5 ?? 0) + (result.probabilities.under_2.5 ?? 0) - 1) < 1e-12);
assert.ok(Math.abs((result.probabilities.btts_yes ?? 0) + (result.probabilities.btts_no ?? 0) - 1) < 1e-12);

// Asian handicap invariant: for Home -1 / Away +1, a one-goal home
// win is PUSH for both sides. Therefore the two win probabilities do not
// sum to 1, and Away +1 includes draws so it should exceed Home -1.
const homeMinus1 = result.probabilities.home_handicap_1 ?? 0;
const awayPlus1 = result.probabilities.away_handicap_1 ?? 0;
assert.ok(awayPlus1 > homeMinus1, `Away +1 should exceed Home -1: ${awayPlus1} <= ${homeMinus1}`);
assert.ok(awayPlus1 + homeMinus1 < 1, "integer Asian handicap win probabilities must leave room for PUSH");

console.log("Quant invariant tests: PASS");
