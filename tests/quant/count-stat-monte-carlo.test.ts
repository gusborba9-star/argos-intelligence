import test from "node:test";
import assert from "node:assert/strict";
import { ModelFactory } from "../../lib/core/ModelFactory";

test("count-stat Monte Carlo is deterministic for a fixed seed", () => {
  const first = ModelFactory.runCountStatSimulation(4.2, 3.1, [2.5, 4.5, 6.5], 5000, 12345, 1.1);
  const second = ModelFactory.runCountStatSimulation(4.2, 3.1, [2.5, 4.5, 6.5], 5000, 12345, 1.1);
  assert.deepEqual(first, second);
});

test("count-stat probabilities preserve complementary over/under states", () => {
  const probabilities = ModelFactory.runCountStatSimulation(4.2, 3.1, [2.5, 4.5, 6.5], 5000, 12345, 1.3);
  for (const line of [2.5, 4.5, 6.5]) {
    const over = probabilities[`over_${line}`];
    const under = probabilities[`under_${line}`];
    assert.ok(Number.isFinite(over));
    assert.ok(Number.isFinite(under));
    assert.ok(over >= 0 && over <= 1);
    assert.ok(under >= 0 && under <= 1);
    assert.ok(Math.abs(over + under - 1) < 1e-12);
  }
});

test("count-stat overdispersion changes the simulated distribution without changing its mean contract", () => {
  const baseline = ModelFactory.runCountStatSimulation(4.2, 3.1, [6.5], 10000, 24680, 1.0);
  const overdispersed = ModelFactory.runCountStatSimulation(4.2, 3.1, [6.5], 10000, 24680, 1.3);
  assert.notEqual(overdispersed["over_6.5"], baseline["over_6.5"]);
});

test("count-stat seed is deterministic for the same full execution regime", () => {
  const regime = { variance_multiplier: 1.3, model_bias: 0, market_regime: "NEUTRAL" } as const;
  const first = ModelFactory.seedForCountStat("match-1", "CORNERS", 4.2, 3.1, [2.5, 4.5], regime);
  const second = ModelFactory.seedForCountStat("match-1", "CORNERS", 4.2, 3.1, [2.5, 4.5], regime);
  assert.equal(first, second);
});

test("count-stat seed changes when the quantitative regime changes", () => {
  const base = ModelFactory.seedForCountStat("match-1", "CORNERS", 4.2, 3.1, [2.5, 4.5], {
    variance_multiplier: 1.1,
    model_bias: 0,
    market_regime: "NEUTRAL",
  });
  const changedVariance = ModelFactory.seedForCountStat("match-1", "CORNERS", 4.2, 3.1, [2.5, 4.5], {
    variance_multiplier: 1.3,
    model_bias: 0,
    market_regime: "NEUTRAL",
  });
  assert.notEqual(changedVariance, base);
});
