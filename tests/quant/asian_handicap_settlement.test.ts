import test from "node:test";
import assert from "node:assert/strict";
import { OddsValueEngine } from "../../lib/core/market-intelligence/OddsValueEngine";

test("Asian handicap integer line: PUSH does not count as a loss", () => {
  const value = OddsValueEngine.calculateAsianHandicapValue(0.45, 0.20, 2.0);
  // EV = 0.45 * 1 - 0.35 = +0.10
  assert.ok(Math.abs(value.expectedValue - 0.10) < 1e-9);
  assert.equal(value.pushProbability, 0.20);
  assert.equal(value.lossProbability, 0.35);
});

test("Asian handicap half line behaves as ordinary binary settlement", () => {
  const value = OddsValueEngine.calculateAsianHandicapValue(0.60, 0, 1.8);
  // EV = 0.60 * 0.8 - 0.40 = +0.08
  assert.ok(Math.abs(value.expectedValue - 0.08) < 1e-9);
  assert.equal(value.pushProbability, 0);
  assert.equal(value.lossProbability, 0.40);
});

test("Asian handicap settlement rejects probabilities that do not conserve", () => {
  assert.throws(
    () => OddsValueEngine.calculateAsianHandicapValue(0.80, 0.30, 2.0),
    /Invalid handicap settlement probabilities/
  );
});
