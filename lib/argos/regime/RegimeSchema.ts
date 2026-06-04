// ============================================================
// ARGOS v4.0 — REGIME CONTRACT LAYER
// Base de interpretação contextual do mercado
// ============================================================

// Estados de mercado detectados pelo Regime Engine
export enum MarketRegime {
  NORMAL = "NORMAL",
  VOLATILE = "VOLATILE",
  DECISION = "DECISION",
  COMPRESSED = "COMPRESSED",
  RELEGATION = "RELEGATION",
  DERBY = "DERBY"
}

// Contrato oficial de saída do Regime Engine
export interface RegimeProfile {
  regime: MarketRegime;

  // confiança do classificador (RAG + LLM + heurística)
  confidence: number; // 0.0 → 1.0

  // ajuste leve no modelo estatístico (NÃO é EV direto)
  model_bias: number; // ex: -0.05 → +0.05

  // ajuste de dispersão do Monte Carlo
  variance_multiplier: number; // ex: 0.8 → 1.5

  // evidências vindas do RAG
  reasoning_tags: string[];

  // explicação auditável (ledger / debug)
  explanation?: string;
}
