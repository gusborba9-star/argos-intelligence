import assert from "node:assert/strict";
import test from "node:test";
import { MarketStatFeatureEngine } from "../../lib/core/MarketStatFeatureEngine";
import { MarketVertical } from "../../lib/core/contracts/MarketVertical";

const history = [
  {
    teams: { home: { name: "Home FC" }, away: { name: "Opponent FC" } },
    statistics: [
      { team: { name: "Home FC" }, statistics: [{ type: "Total Shots", value: 14 }, { type: "Fouls", value: 10 }] },
      { team: { name: "Opponent FC" }, statistics: [{ type: "Total Shots", value: 8 }, { type: "Fouls", value: 13 }] },
    ],
  },
] as any;

test("extracts opponent-aware count-stat evidence", () => {
  const profile = MarketStatFeatureEngine.build(MarketVertical.SHOTS, history, history, "Home FC", "Home FC");
  assert.ok(profile);
  assert.equal(profile.homeFor, 14);
  assert.equal(profile.homeAgainst, 8);
  assert.equal(profile.homeSample, 1);
});

test("missing statistics never become synthetic observations", () => {
  const profile = MarketStatFeatureEngine.build(MarketVertical.SHOTS, history.map((m) => ({ ...m, statistics: undefined })) as any, history.map((m) => ({ ...m, statistics: undefined })) as any, "Home FC", "Home FC");
  assert.equal(profile, null);
});

test("unsupported verticals are not silently modeled as count stats", () => {
  const profile = MarketStatFeatureEngine.build(MarketVertical.WINNER, history, history, "Home FC", "Home FC");
  assert.equal(profile, null);
});
