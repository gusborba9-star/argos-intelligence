// ============================================================
// ARGOS MARKET CONTRACT — CANONICAL EXECUTION BOUNDARY
// ============================================================
// This path is intentionally NOT an execution engine.
//
// The quantitative production path is:
//   PredictionCore -> quantitative integrity -> value/delivery layers
//
// MarketVertical remains here temporarily as a compatibility contract because
// ingestion, normalization and queue boundaries still exchange this enum.
// Keeping the contract does not permit probability generation, EV calculation,
// portfolio construction or hidden model adjustments through a legacy bypass.
//
// Migration rule: callers may import MarketVertical from this module, but no
// production caller may invoke an analysis engine from it.

export enum MarketVertical {
  WINNER = "WINNER",
  GOALS = "GOALS",
  GOALS_HT = "GOALS_HT",
  CARDS = "CARDS",
  CORNERS = "CORNERS",
  SHOTS = "SHOTS",
  SHOTS_ON_TARGET = "SHOTS_ON_TARGET",
  FOULS = "FOULS",
  BTTS = "BTTS",
  TACKLES = "TACKLES",
  HANDICAP = "HANDICAP",
  SAVES = "SAVES",
  UNKNOWN = "UNKNOWN"
}
