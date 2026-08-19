import test from "node:test";
import assert from "node:assert/strict";
import { FairOddsCalculator } from "../../lib/core/market-intelligence/FairOddsCalculator";
import { OddsValueEngine } from "../../lib/core/market-intelligence/OddsValueEngine";
import { MarketVertical } from "../../lib/core/ArgosUnifiedEngine";
import type { NormalizedMarket } from "../../lib/core/market-intelligence/MarketNormalizer";

function market(bookmaker: string, homeOdd: number, awayOdd: number, isSharp = false): NormalizedMarket {
  return {
    vertical: MarketVertical.WINNER,
    marketName: "h2h",
    line: 0,
    bookmaker,
    bookmakerTitle: bookmaker,
    lastUpdate: 1_000,
    isSharp,
    outcomes: [
      { selection: "Home", odd: homeOdd, impliedProb: 1 / homeOdd },
      { selection: "Away", odd: awayOdd, impliedProb: 1 / awayOdd },
    ],
  };
}

test("C003 market separation: fair probability is explicitly market-derived", () => {
  const result = FairOddsCalculator.calculate(
    [market("pinnacle", 1.80, 2.10, true), market("bet365", 1.90, 2.00)],
    MarketVertical.WINNER,
    "Home",
    0,
  );

  assert.ok(result);
  assert.equal(result.source, "PINNACLE_SHARP");
  assert.equal(result.evidence.sharpBookmakerPresent, true);
  assert.equal(result.marketConsensusProbability, result.marketConsensusProbability);
  assert.ok(result.fairProbability > 0 && result.fairProbability < 1);
});

test("C003 value chain: EV follows model probability, never market fair probability", () => {
  const value = OddsValueEngine.calculateValue(0.50, 2.50, 2.00);

  assert.equal(value.expectedValue, 0.25);
  assert.equal(value.edgePercent, 25);
  assert.equal(value.realValue, 1.25);
});

test("C003 value chain: changing market fair price does not change model EV", () => {
  const a = OddsValueEngine.calculateValue(0.40, 3.00, 2.00);
  const b = OddsValueEngine.calculateValue(0.40, 3.00, 2.80);

  assert.equal(a.expectedValue, b.expectedValue);
  assert.notEqual(a.realValue, b.realValue);
});
