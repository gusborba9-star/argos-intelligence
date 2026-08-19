import crypto from "crypto";

export const PROVENANCE_SCHEMA_VERSION = "ARGOS_PROVENANCE_V1" as const;

export interface SignalProvenanceSnapshot {
  schemaVersion: typeof PROVENANCE_SCHEMA_VERSION;
  matchId: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  kickoff: string;
  vertical: string;
  selection: string;
  line: number;
  modelProbability: number;
  marketImpliedProbability: number | null;
  fairOdd: number;
  executableOdd: number;
  expectedValue: number;
  edge: number;
  modelProbabilitySource: string;
  analysisTimestamp: string;
}

function canonicalize(snapshot: SignalProvenanceSnapshot): string {
  const orderedKeys = Object.keys(snapshot).sort() as Array<keyof SignalProvenanceSnapshot>;
  return JSON.stringify(snapshot, orderedKeys);
}

export function hashSignalProvenance(snapshot: SignalProvenanceSnapshot): string {
  return crypto.createHash("sha256").update(canonicalize(snapshot)).digest("hex");
}

export function verifySignalProvenance(snapshot: SignalProvenanceSnapshot, expectedHash: string): boolean {
  if (!expectedHash || expectedHash.length !== 64) return false;
  const actualHash = hashSignalProvenance(snapshot);
  return crypto.timingSafeEqual(Buffer.from(actualHash, "hex"), Buffer.from(expectedHash, "hex"));
}
