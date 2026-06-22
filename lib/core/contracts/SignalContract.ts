// ============================================================
// SIGNAL CONTRACT v4.0 — ATUALIZADO
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
  ev?: number; // Adicionado para suportar o cálculo de estatísticas
  units?: number;
  model?: string;
  modelConsensusSize?: number;
  unitSize?: number;
  status: "OPTIMIZED" | "HEDGED";
  reasoning?: string;
  confidence?: "HIGH" | "MEDIUM" | "LOW"; // Adicionado para compatibilidade com getStats
  tier?: "FREE" | "VIP"; // Adicionado para o Dispatcher
}
