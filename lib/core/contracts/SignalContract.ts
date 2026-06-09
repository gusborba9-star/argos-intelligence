// ============================================================
// SIGNAL CONTRACT v4.0
// ============================================================

export interface ArgosSignal {
  vertical: string;
  market: string;
  probability: number;
  adjustedProbability?: number;
  impliedOdds?: number;
  expectedValue: number;
  units?: number;
  model?: string;
  modelConsensusSize?: number;
  unitSize?: number;
  status: "OPTIMIZED" | "HEDGED";
}
