import assert from "node:assert/strict";
import test from "node:test";
import { OddsValueEngine } from "../../lib/core/market-intelligence/OddsValueEngine";

test("EV is exactly derived from model probability and executable market odd", () => {
  const result = OddsValueEngine.calculateValue(0.60, 2.00, 1.90);

  assert.equal(result.expectedValue, 0.2);
  assert.equal(result.edge, 0.2);
  assert.equal(result.edgePercent, 20);
  assert.equal(result.isPositive, true);
});

test("reference-price value ratio is market/fair, not fair/market", () => {
  const result = OddsValueEngine.calculateValue(0.50, 2.20, 2.00);

  assert.equal(result.realValue, 1.1);
});

test("Kelly is quarter-Kelly and capped at 5%", () => {
  const result = OddsValueEngine.calculateValue(0.80, 2.00);

  // Full Kelly = 60%; quarter Kelly = 15%; operational cap = 5%.
  assert.equal(result.fullKelly, 0.6);
  assert.equal(result.kellyCriterion, 0.05);
});

test("invalid quantitative inputs are rejected instead of silently clamped", () => {
  assert.throws(() => OddsValueEngine.calculateValue(Number.NaN, 2.0));
  assert.throws(() => OddsValueEngine.calculateValue(0.55, 1.0));
  assert.throws(() => OddsValueEngine.calculateValue(0.55, 2.0, 1.0));
});

test("negative EV cannot be classified as a positive value signal", () => {
  const result = OddsValueEngine.calculateValue(0.40, 2.00);

  assert.equal(result.expectedValue, -0.2);
  assert.equal(result.isPositive, false);
  assert.equal(result.ratingLabel, "NEGATIVE");
  assert.equal(result.kellyCriterion, 0);
});
