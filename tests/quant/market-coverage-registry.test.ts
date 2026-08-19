import assert from "node:assert/strict";
import { test } from "node:test";
import { MarketVertical } from "../../lib/core/contracts/MarketVertical";
import { MarketCoverageRegistry, SOCCER_MARKET_COVERAGE } from "../../lib/core/market-intelligence/MarketCoverageRegistry";
import { MarketNormalizer } from "../../lib/core/market-intelligence/MarketNormalizer";

test("canonical registry contains distinct full-time and team/stat verticals", () => {
  const verticals = new Set(SOCCER_MARKET_COVERAGE.map((entry) => entry.vertical));
  assert.ok(verticals.has(MarketVertical.GOALS));
  assert.ok(verticals.has(MarketVertical.GOALS_HT));
  assert.ok(verticals.has(MarketVertical.GOALS_2H));
  assert.ok(verticals.has(MarketVertical.TEAM_TOTALS));
  assert.ok(verticals.has(MarketVertical.CORNERS));
  assert.ok(verticals.has(MarketVertical.TEAM_CORNERS));
  assert.ok(verticals.has(MarketVertical.CARDS));
  assert.ok(verticals.has(MarketVertical.TEAM_CARDS));
  assert.ok(verticals.has(MarketVertical.SHOTS));
  assert.ok(verticals.has(MarketVertical.SHOTS_ON_TARGET));
});

test("registry resolves canonical keys and aliases without collapsing verticals", () => {
  assert.equal(MarketCoverageRegistry.resolve("h2h")?.vertical, MarketVertical.WINNER);
  assert.equal(MarketCoverageRegistry.resolve("totals_first_half")?.vertical, MarketVertical.GOALS_HT);
  assert.equal(MarketCoverageRegistry.resolve("totals_second_half")?.vertical, MarketVertical.GOALS_2H);
  assert.equal(MarketCoverageRegistry.resolve("team_corners")?.vertical, MarketVertical.TEAM_CORNERS);
  assert.equal(MarketCoverageRegistry.resolve("team_cards")?.vertical, MarketVertical.TEAM_CARDS);
  assert.equal(MarketCoverageRegistry.resolve("never_seen_market"), undefined);
});

test("normalizer delegates vertical resolution to the canonical registry", () => {
  assert.equal(MarketNormalizer.mapToVertical("h2h"), MarketVertical.WINNER);
  assert.equal(MarketNormalizer.mapToVertical("totals_first_half"), MarketVertical.GOALS_HT);
  assert.equal(MarketNormalizer.mapToVertical("total_corners"), MarketVertical.CORNERS);
  assert.equal(MarketNormalizer.mapToVertical("team_cards"), MarketVertical.TEAM_CARDS);
  assert.equal(MarketNormalizer.mapToVertical("future_provider_market"), MarketVertical.UNKNOWN);
});

test("audit keeps unknown provider markets observable instead of fabricating coverage", () => {
  const report = MarketCoverageRegistry.audit(["h2h", "total_corners", "future_provider_market", "future_provider_market"]);
  assert.equal(report.discovered.length, 3);
  assert.equal(report.covered.length, 2);
  assert.deepEqual(report.unknown, ["future_provider_market"]);
  assert.equal(report.byVertical[MarketVertical.WINNER], 1);
  assert.equal(report.byVertical[MarketVertical.CORNERS], 1);
});
