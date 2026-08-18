import assert from "node:assert/strict";
import test from "node:test";
import { AsianHandicapSettlementEngine } from "../../lib/core/market-intelligence/AsianHandicapSettlementEngine";
import { MarketRegime, RegimeProfile } from "../../lib/argos/regime/RegimeSchema";

const regime: RegimeProfile = {
  regime: MarketRegime.NORMAL,
  confidence: 1,
  model_bias: 0,
  variance_multiplier: 1.1,
  reasoning_tags: [],
};

test("signed handicap settlement probabilities close to one", () => {
  const result = AsianHandicapSettlementEngine.simulate(1.45, 1.05, regime, [-1, -0.5, 0.5, 1], 10000);
  for (const value of Object.values(result)) {
    assert.ok(Math.abs(value.win + value.push + value.loss - 1) < 1e-9);
    assert.ok(value.win >= 0 && value.push >= 0 && value.loss >= 0);
  }
});

test("half-goal handicap has no push state", () => {
  const result = AsianHandicapSettlementEngine.simulate(1.45, 1.05, regime, [-0.5, 0.5], 10000);
  for (const point of [-0.5, 0.5]) {
    assert.equal(result[`home_${point}`].push, 0);
    assert.equal(result[`away_${point}`].push, 0);
  }
});
