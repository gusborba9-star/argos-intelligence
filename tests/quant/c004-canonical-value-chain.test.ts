import test from "node:test";
import assert from "node:assert/strict";
import { buildCanonicalValueChain, assertCanonicalValueChain } from "../../lib/core/quant/QuantitativeIntegrity";
import { OddsValueEngine } from "../../lib/core/market-intelligence/OddsValueEngine";

test("C004: model fair odd is exactly reciprocal of model probability", () => {
  const chain = buildCanonicalValueChain(0.384, 3.98);
  assert.equal(chain.modelFairOdd, 1 / 0.384);
  assertCanonicalValueChain(chain);
});

test("C004: EV and Kelly use the same model probability", () => {
  const p = 0.384;
  const odd = 3.98;
  const chain = buildCanonicalValueChain(p, odd);
  const value = OddsValueEngine.calculateValue(p, odd, 4.22);
  assert.ok(Math.abs(value.expectedValue - chain.expectedValue) < 1e-4);
  assert.ok(Math.abs(value.fullKelly - chain.fullKelly) < 1e-4);
});

test("C004: market reference cannot replace model fair odd", () => {
  const value = OddsValueEngine.calculateValue(0.384, 3.98, 4.22);
  assert.ok(Math.abs(1 / 0.384 - 4.22) > 1);
  assert.equal(value.expectedValue, Number((0.384 * 3.98 - 1).toFixed(4)));
});

test("C004: canonical chain rejects invalid probabilities", () => {
  assert.throws(() => buildCanonicalValueChain(1, 2));
  assert.throws(() => buildCanonicalValueChain(0, 2));
});
