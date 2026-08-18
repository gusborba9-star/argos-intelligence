import assert from "node:assert/strict";
import { MarketDiscoveryEngine } from "../../lib/core/market-intelligence/MarketDiscoveryEngine";

const markets: any[] = [
  {
    vertical: "WINNER",
    line: 0,
    marketName: "Match Winner",
    bookmaker: "pinnacle",
    bookmakerTitle: "Pinnacle",
    isSharp: true,
    outcomes: [
      { selection: "Home", odd: 2.00, impliedProb: 0.50 },
      { selection: "Draw", odd: 3.50, impliedProb: 1 / 3.5 },
      { selection: "Away", odd: 4.00, impliedProb: 0.25 }
    ]
  }
];

// A market-derived fair probability must never impersonate the model.
const withoutModel = MarketDiscoveryEngine.discover(markets, {});
assert.equal(withoutModel.length, 0, "market fair probability must not become model probability");

const withModel = MarketDiscoveryEngine.discover(markets, {
  WINNER_Home_0: 0.60
});
assert.equal(withModel.length, 1);
assert.equal(withModel[0].probability, 0.60);
assert.equal(withModel[0].modelProbabilitySource, "EXPLICIT_MODEL_PREDICTION");
assert.ok(Number.isFinite(withModel[0].expectedValue));

console.log("Market integrity tests: PASS");
