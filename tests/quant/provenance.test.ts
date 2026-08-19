import test from "node:test";
import assert from "node:assert/strict";
import {
  PROVENANCE_SCHEMA_VERSION,
  hashSignalProvenance,
  verifySignalProvenance,
  SignalProvenanceSnapshot,
} from "@/lib/argos/provenance/SignalProvenance";

const snapshot: SignalProvenanceSnapshot = {
  schemaVersion: PROVENANCE_SCHEMA_VERSION,
  matchId: "fixture-1",
  league: "test-league",
  homeTeam: "Home",
  awayTeam: "Away",
  kickoff: "2026-08-19T15:00:00.000Z",
  vertical: "GOALS",
  selection: "Over",
  line: 2.5,
  modelProbability: 0.61,
  marketImpliedProbability: 0.5,
  fairOdd: 1.64,
  executableOdd: 2,
  expectedValue: 0.22,
  edge: 0.22,
  modelProbabilitySource: "EXPLICIT_MODEL_PREDICTION",
  analysisTimestamp: "2026-08-19T11:00:00.000Z",
};

test("provenance hash is deterministic", () => {
  const first = hashSignalProvenance(snapshot);
  const second = hashSignalProvenance({ ...snapshot });
  assert.equal(first, second);
  assert.equal(first.length, 64);
});

test("provenance verifier accepts the original snapshot and rejects mutation", () => {
  const hash = hashSignalProvenance(snapshot);
  assert.equal(verifySignalProvenance(snapshot, hash), true);
  assert.equal(
    verifySignalProvenance({ ...snapshot, modelProbability: 0.62 }, hash),
    false
  );
});
