// ============================================================
// SIGNAL CONTRACT v4.0
// ============================================================

export interface ArgosSignal {
  id?: string; // ID do ledger após persistência
  matchId?: string; // Adicionado para AnomalyDetectionService
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
