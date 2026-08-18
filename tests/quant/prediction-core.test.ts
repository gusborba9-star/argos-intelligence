import assert from "node:assert/strict";
import { test } from "node:test";
import { PredictionCore } from "../../lib/core/quant/PredictionCore";

test("PredictionCore is deterministic for the same seed", () => {
  const input = { homeMean: 1.65, awayMean: 0.95 };
  const a = PredictionCore.simulate(input, { seed: 123456, featureVersion: "features-v1" }, 5000);
  const b = PredictionCore.simulate(input, { seed: 123456, featureVersion: "features-v1" }, 5000);
  assert.deepEqual(a, b);
});

test("PredictionCore changes replay when the seed changes", () => {
  const input = { homeMean: 1.65, awayMean: 0.95 };
  const a = PredictionCore.simulate(input, { seed: 1 }, 3000);
  const b = PredictionCore.simulate(input, { seed: 2 }, 3000);
  assert.notDeepEqual(a, b);
});

test("winner probabilities form a complete partition", () => {
  const result = PredictionCore.simulate({ homeMean: 1.4, awayMean: 1.1 }, { seed: 77 }, 10000);
  const total = result.probabilities.homeWin + result.probabilities.draw + result.probabilities.awayWin;
  assert.ok(Math.abs(total - 1) < 1e-12);
});

test("BTTS is complementary", () => {
  const result = PredictionCore.simulate({ homeMean: 1.4, awayMean: 1.1 }, { seed: 77 }, 10000);
  assert.equal(result.probabilities.bttsYes + result.probabilities.bttsNo, 1);
});

test("score probability is independent and bounded", () => {
  const p = PredictionCore.scoreProbability(1, 0, { homeMean: 1.5, awayMean: 0.8 });
  assert.ok(p >= 0 && p <= 1);
});

test("signed goal-difference thresholds remain distinct", () => {
  const result = PredictionCore.simulate({ homeMean: 1.5, awayMean: 1.0 }, { seed: 99 }, 10000);
  assert.notEqual(
    result.probabilities.goalDifferenceAtLeast["1"],
    result.probabilities.goalDifferenceAtLeast["-1"]
  );
});

test("expected goals converge toward supplied means", () => {
  const result = PredictionCore.simulate({ homeMean: 1.7, awayMean: 0.9 }, { seed: 4242 }, 100000);
  assert.ok(Math.abs(result.expectedGoals.home - 1.7) < 0.04);
  assert.ok(Math.abs(result.expectedGoals.away - 0.9) < 0.04);
});

test("Poisson PMF is normalized for a practical football range", () => {
  const lambda = 1.55;
  let total = 0;
  for (let k = 0; k <= 20; k++) total += PredictionCore.poissonPmf(k, lambda);
  assert.ok(Math.abs(total - 1) < 1e-10);
});
