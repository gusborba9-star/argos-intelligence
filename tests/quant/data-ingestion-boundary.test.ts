import assert from "node:assert/strict";
import test from "node:test";
import { DataIngestionService } from "../../lib/core/DataIngestionService";

const fixture = (kickoff: string) => ({
  id: 990001,
  commence_time: kickoff,
  league: { id: 1 },
  home_team: "Home",
  away_team: "Away",
  bookmakers: [{ key: "pinnacle", markets: [] }],
});

test("ingestion boundary is exactly 48 hours", () => {
  assert.equal(DataIngestionService.ANALYSIS_HORIZON_MS, 48 * 60 * 60 * 1000);
});

test("ingestObject accepts a future fixture inside the 48h boundary", async () => {
  const service = new DataIngestionService();
  service.saveMatchToDatabase = async () => undefined;
  const result = await service.ingestObject(fixture(new Date(Date.now() + 60 * 60 * 1000).toISOString()));
  assert.equal(result.matchId, "990001");
});

test("ingestObject rejects fixtures beyond the 48h boundary", async () => {
  const service = new DataIngestionService();
  service.saveMatchToDatabase = async () => undefined;
  await assert.rejects(
    service.ingestObject(fixture(new Date(Date.now() + DataIngestionService.ANALYSIS_HORIZON_MS + 1).toISOString())),
    /OUTSIDE_ANALYSIS_HORIZON/
  );
});

test("ingestObject rejects already-started fixtures", async () => {
  const service = new DataIngestionService();
  service.saveMatchToDatabase = async () => undefined;
  await assert.rejects(service.ingestObject(fixture(new Date(Date.now() - 1).toISOString())), /EXPIRED/);
});

test("cache freshness contract is bounded to 15 minutes", () => {
  assert.equal(DataIngestionService.MAX_CACHED_PAYLOAD_AGE_MS, 15 * 60 * 1000);
});
