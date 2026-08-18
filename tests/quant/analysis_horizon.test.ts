import assert from "node:assert/strict";
import { test } from "node:test";
import { DailyIngestionScheduler, MAX_ANALYSIS_HORIZON_HOURS } from "../../lib/argos/ingestion/DailyIngestionScheduler";

const NOW = Date.parse("2026-08-18T20:00:00Z");

function withFrozenNow<T>(fn: () => T): T {
  const originalNow = Date.now;
  Date.now = () => NOW;
  try { return fn(); } finally { Date.now = originalNow; }
}

test("analysis horizon is exactly 48 hours", () => {
  assert.equal(MAX_ANALYSIS_HORIZON_HOURS, 48);
});

test("match inside 48h is eligible", () => {
  withFrozenNow(() => {
    const scheduler = new DailyIngestionScheduler() as any;
    assert.equal(scheduler.isWithinAnalysisHorizon({ commence_time: "2026-08-20T19:59:59Z" }), true);
  });
});

test("match beyond 48h is never eligible regardless of league or liquidity", () => {
  withFrozenNow(() => {
    const scheduler = new DailyIngestionScheduler() as any;
    assert.equal(scheduler.isWithinAnalysisHorizon({ commence_time: "2026-08-22T11:00:00Z", bookmakers: [{ key: "pinnacle", markets: Array(30).fill({}) }], sport_title: "EPL" }), false);
  });
});

test("started match is not eligible", () => {
  withFrozenNow(() => {
    const scheduler = new DailyIngestionScheduler() as any;
    assert.equal(scheduler.isWithinAnalysisHorizon({ commence_time: "2026-08-18T19:59:59Z" }), false);
  });
});
