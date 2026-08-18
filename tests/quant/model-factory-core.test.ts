import assert from "node:assert/strict";
import test from "node:test";
import { ModelFactory } from "../../lib/core/ModelFactory";
import { MarketRegime, RegimeProfile } from "../../lib/argos/regime/RegimeSchema";

const regime: RegimeProfile = {
  regime: MarketRegime.NORMAL,
  confidence: 1,
  model_bias: 0,
  variance_multiplier: 1.1,
  reasoning_tags: [],
};

test("Monte Carlo is reproducible for identical quantitative inputs", () => {
  const a = ModelFactory.runMonteCarlo({ homeMean: 1.45, awayMean: 1.05 }, regime, 10000, "GOALS");
  const b = ModelFactory.runMonteCarlo({ homeMean: 1.45, awayMean: 1.05 }, regime, 10000, "GOALS");
  assert.deepEqual(a, b);
});

test("winner probabilities form a closed partition", () => {
  const result = ModelFactory.runMonteCarlo({ homeMean: 1.45, awayMean: 1.05 }, regime, 10000, "GOALS");
  const sum = result.probabilities.home + result.probabilities.draw + result.probabilities.away;
  assert.ok(Math.abs(sum - 1) < 1e-12);
});

test("binary market probabilities remain complementary", () => {
  const result = ModelFactory.runMonteCarlo({ homeMean: 1.45, awayMean: 1.05 }, regime, 10000, "GOALS");
  assert.ok(Math.abs((result.probabilities.over! + result.probabilities.under!) - 1) < 1e-12);
  assert.ok(Math.abs((result.probabilities.btts_yes! + result.probabilities.btts_no!) - 1) < 1e-12);
});

test("Monte Carlo expected goals remains close to the supplied means", () => {
  const homeMean = 1.45;
  const awayMean = 1.05;
  const result = ModelFactory.runMonteCarlo({ homeMean, awayMean }, regime, 20000, "GOALS");
  assert.ok(Math.abs(result.expectedGoals - (homeMean + awayMean)) < 0.08);
});

test("signed handicap states are not collapsed into absolute magnitudes", () => {
  const result = ModelFactory.runMonteCarlo({ homeMean: 1.45, awayMean: 1.05 }, regime, 10000, "GOALS");
  assert.notEqual(result.probabilities["home_handicap_1"], result.probabilities["home_handicap_-1"]);
  assert.notEqual(result.probabilities["away_handicap_1"], result.probabilities["away_handicap_-1"]);
});
