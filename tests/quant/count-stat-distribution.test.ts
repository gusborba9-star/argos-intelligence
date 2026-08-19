import assert from "node:assert/strict";
import test from "node:test";
import { ModelFactory } from "../../lib/core/ModelFactory";

test("count-stat simulation is deterministic for the same seed and regime", () => {
  const a = ModelFactory.runCountStatSimulation(4.8, 3.9, [2.5, 3.5, 4.5], 3000, 12345, 1.3);
  const b = ModelFactory.runCountStatSimulation(4.8, 3.9, [2.5, 3.5, 4.5], 3000, 12345, 1.3);
  assert.deepEqual(a, b);
});

test("count-stat probabilities remain complementary and bounded", () => {
  const result = ModelFactory.runCountStatSimulation(5.2, 4.1, [3.5, 5.5, 7.5], 3000, 9876, 1.3);
  for (const line of [3.5, 5.5, 7.5]) {
    const over = result[`over_${line}`];
    const under = result[`under_${line}`];
    assert.ok(over >= 0 && over <= 1);
    assert.ok(under >= 0 && under <= 1);
    assert.ok(Math.abs(over + under - 1) < 1e-12);
  }
});

test("regime overdispersion changes the simulated distribution without changing its mean contract", () => {
  const poisson = ModelFactory.runCountStatSimulation(5.0, 4.0, [4.5, 6.5], 8000, 2222, 1.0);
  const overdispersed = ModelFactory.runCountStatSimulation(5.0, 4.0, [4.5, 6.5], 8000, 2222, 1.3);
  assert.notDeepEqual(poisson, overdispersed);
});

test("invalid count-stat inputs are rejected", () => {
  assert.throws(() => ModelFactory.runCountStatSimulation(Number.NaN, 4, [2.5]));
  assert.throws(() => ModelFactory.runCountStatSimulation(4, -1, [2.5]));
  assert.throws(() => ModelFactory.runCountStatSimulation(4, 4, [2.5], 999));
});
