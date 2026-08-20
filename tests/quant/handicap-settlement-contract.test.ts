import test from "node:test";
import assert from "node:assert/strict";
import { AsianHandicapSettlementEngine } from "../../lib/core/market-intelligence/AsianHandicapSettlementEngine";

const regime: any = { variance_multiplier: 1, model_bias: 0, market_regime: "NEUTRAL" };

test("quarter handicap is not collapsed into a false 100% loss", () => {
  const result = AsianHandicapSettlementEngine.simulate(1.4, 1.1, regime, [0.25], 10000).home_0.25;
  assert.ok(result);
  assert.ok(result.halfWin > 0 || result.halfLoss > 0);
  assert.equal(result.win + result.halfWin + result.push + result.halfLoss + result.loss, 1);
  assert.ok(result.loss < 1);
});

test("integer handicap conserves WIN/PUSH/LOSS mass", () => {
  const result = AsianHandicapSettlementEngine.simulate(1.4, 1.1, regime, [0], 10000).home_0;
  assert.equal(result.halfWin, 0);
  assert.equal(result.halfLoss, 0);
  assert.ok(Math.abs(result.win + result.push + result.loss - 1) < 1e-12);
});
