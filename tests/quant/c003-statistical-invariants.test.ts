import test from "node:test";
import assert from "node:assert/strict";
import { PredictionCore } from "../../lib/core/quant/PredictionCore";

const EPS = 0.02;

test("C003: seeded Monte Carlo is exactly replayable", () => {
  const a = PredictionCore.simulate({ homeLambda: 1.55, awayLambda: 1.10, iterations: 50000, seed: "c003-replay" });
  const b = PredictionCore.simulate({ homeLambda: 1.55, awayLambda: 1.10, iterations: 50000, seed: "c003-replay" });
  assert.deepEqual(a, b);
});

test("C003: Monte Carlo converges toward configured Poisson means", () => {
  const r = PredictionCore.simulate({ homeLambda: 1.70, awayLambda: 1.25, iterations: 100000, seed: "c003-convergence" });
  assert.ok(Math.abs(r.expectedGoals.home - 1.70) < 0.04);
  assert.ok(Math.abs(r.expectedGoals.away - 1.25) < 0.04);
});

test("C003: 1X2 probabilities are normalized and bounded", () => {
  const r = PredictionCore.simulate({ homeLambda: 1.45, awayLambda: 1.20, iterations: 100000, seed: "c003-1x2" });
  const sum = r.probabilities.homeWin + r.probabilities.draw + r.probabilities.awayWin;
  assert.ok(Math.abs(sum - 1) < 0.001);
  for (const p of [r.probabilities.homeWin, r.probabilities.draw, r.probabilities.awayWin]) {
    assert.ok(p >= 0 && p <= 1);
  }
});

test("C003: BTTS is complementary", () => {
  const r = PredictionCore.simulate({ homeLambda: 1.60, awayLambda: 1.30, iterations: 100000, seed: "c003-btts" });
  assert.ok(Math.abs(r.probabilities.bttsYes + r.probabilities.bttsNo - 1) < 1e-12);
});

test("C003: score matrix is normalized", () => {
  const r = PredictionCore.simulate({ homeLambda: 1.50, awayLambda: 1.15, iterations: 100000, seed: "c003-score" });
  const total = Object.values(r.scoreMatrix).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(total - 1) < 1e-12);
});

test("C003: signed handicap thresholds remain distinct", () => {
  const r = PredictionCore.settleHandicap({ homeGoals: 1, awayGoals: 0, line: 1 });
  const s = PredictionCore.settleHandicap({ homeGoals: 1, awayGoals: 0, line: -1 });
  assert.notDeepEqual(r, s);
});

test("C003: simulation metadata is reproducible", () => {
  const r = PredictionCore.simulate({ homeLambda: 1.4, awayLambda: 1.1, iterations: 12345, seed: "meta" });
  assert.equal(r.metadata.iterations, 12345);
  assert.equal(r.metadata.seed, "meta");
  assert.match(r.metadata.modelVersion, /^PredictionCore-/);
});
