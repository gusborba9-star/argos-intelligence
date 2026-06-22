// ============================================================
// SIGNAL CONTRACT v5.1 — SYNDICATE EDITION
// ============================================================

export interface ArgosSignal {
  id?: string;
  matchId?: string;
  vertical: string;
  market: string;
  probability: number;
  adjustedProbability?: number;
  impliedOdds?: number;
  expectedValue: number;
  ev?: number;
  units?: number;
  model?: string;
  modelConsensusSize?: number;
  unitSize?: number;
  status: "OPTIMIZED" | "HEDGED" | "PREMIUM";
  reasoning?: string;
  confidence?: "HIGH" | "MEDIUM" | "LOW" | number;
  tier?: "FREE" | "VIP" | "NONE"; // Unificado para aceitar NONE internamente
}
