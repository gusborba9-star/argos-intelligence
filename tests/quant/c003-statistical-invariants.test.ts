import test from "node:test";
import assert from "node:assert/strict";
import { PredictionCore } from "../../lib/core/quant/PredictionCore";

const simulate = (homeMean: number, awayMean: number, seed: number, iterations = 50_000) =>
  PredictionCore.simulate({ homeMean, awayMean }, { seed }, iterations);

test("C003: seeded Monte Carlo is exactly replayable", () => {
  const a = simulate(1.55, 1.10, 0xc00301);
  const b = simulate(1.55, 1.10, 0xc00301);
  assert.deepEqual(a, b);
});

test("C003: Monte Carlo converges toward configured Poisson means", () => {
  const r = simulate(1.70, 1.25, 0xc00302, 100_000);
  assert.ok(Math.abs(r.expectedGoals.home - 1.70) < 0.04);
  assert.ok(Math.abs(r.expectedGoals.away - 1.25) < 0.04);
});

test("C003: 1X2 probabilities are normalized and bounded", () => {
  const r = simulate(1.45, 1.20, 0xc00303, 100_000);
  const sum = r.probabilities.homeWin + r.probabilities.draw + r.probabilities.awayWin;
  assert.ok(Math.abs(sum - 1) < 0.001);
  for (const p of [r.probabilities.homeWin, r.probabilities.draw, r.probabilities.awayWin]) {
    assert.ok(p >= 0 && p <= 1);
  }
});

test("C003: BTTS is complementary", () => {
  const r = simulate(1.60, 1.30, 0xc00304, 100_000);
  assert.ok(Math.abs(r.probabilities.bttsYes + r.probabilities.bttsNo - 1) < 1e-12);
});

test("C003: score matrix is normalized", () => {
  const r = simulate(1.50, 1.15, 0xc00305, 100_000);
  const total = r.scoreMatrix.reduce((sum, cell) => sum + cell.probability, 0);
  assert.ok(Math.abs(total - 1) < 1e-12);
});

test("C003: signed goal-difference thresholds remain distinct", () => {
  const r = simulate(1.55, 1.10, 0xc00306, 100_000);
  const minusOne = r.probabilities.goalDifferenceAtLeast["-1"];
  const plusOne = r.probabilities.goalDifferenceAtLeast["1"];
  assert.notEqual(minusOne, plusOne);
  assert.ok(Number.isFinite(minusOne));
  assert.ok(Number.isFinite(plusOne));
});

test("C003: simulation metadata is reproducible", () => {
  const r = simulate(1.40, 1.10, 0xc00307, 12_345);
  assert.equal(r.iterations, 12_345);
  assert.equal(r.seed, 0xc00307);
  assert.match(r.modelVersion, /^ARGOS_PREDICTION_CORE_/);
  assert.equal(r.expectedGoals.total, r.expectedGoals.home + r.expectedGoals.away);
});
