import test from "node:test";
import assert from "node:assert/strict";
import { FeatureEngine } from "../../lib/core/FeatureEngine";

let fixtureId = 1000;
const fixture = (home: string, away: string, hg: number, ag: number) => ({
  fixture: { id: fixtureId++, referee: null, timezone: "UTC", date: "2026-08-01T00:00:00Z", timestamp: 0, status: { long: "Match Finished", short: "FT", elapsed: 90 } },
  league: { id: 1, name: "Test", country: "Global", logo: "", flag: "", season: 2026, round: "1" },
  teams: { home: { id: 1, name: home, logo: "", winner: null }, away: { id: 2, name: away, logo: "", winner: null } },
  goals: { home: hg, away: ag },
  score: { halftime: { home: 0, away: 0 }, fulltime: { home: hg, away: ag }, extratime: { home: null, away: null }, penalty: { home: null, away: null } },
});

test("team scoring features preserve opponent concession separately", () => {
  const homeHistory = [fixture("Home FC", "Weak FC", 4, 0), fixture("Strong FC", "Home FC", 0, 1)];
  const awayHistory = [fixture("Away FC", "Weak FC", 2, 0), fixture("Strong FC", "Away FC", 3, 0)];
  const features = FeatureEngine.generateFeatureVector({
    home_team: "Home FC",
    away_team: "Away FC",
    homeHistory,
    awayHistory,
    league: { name: "Test", country: "Global" },
  });

  assert.ok(Number.isFinite(features.homeMetrics.goals));
  assert.ok(Number.isFinite(features.homeMetrics.goalsAgainst));
  assert.ok(Number.isFinite(features.awayMetrics.goals));
  assert.ok(Number.isFinite(features.awayMetrics.goalsAgainst));
  assert.notEqual(features.homeMetrics.goals, features.homeMetrics.goalsAgainst);
});

test("sparse samples remain anchored by the scoring prior", () => {
  const features = FeatureEngine.generateFeatureVector({
    home_team: "Home FC",
    away_team: "Away FC",
    homeHistory: [fixture("Home FC", "Weak FC", 8, 0)],
    awayHistory: [fixture("Weak FC", "Away FC", 0, 8)],
    league: { name: "Test", country: "Global" },
  });

  assert.ok(features.homeMetrics.goals < 3.0);
  assert.ok(features.awayMetrics.goals < 3.0);
});
