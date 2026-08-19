// ============================================================
// ARGOS MARKET VERTICAL CONTRACT — CANONICAL
// ============================================================
// Pure domain contract only. No prediction, ranking, EV, exposure,
// learning or execution logic belongs in this module.

export enum MarketVertical {
  WINNER = "WINNER",
  DOUBLE_CHANCE = "DOUBLE_CHANCE",
  DRAW_NO_BET = "DRAW_NO_BET",
  WINNER_HT = "WINNER_HT",
  GOALS = "GOALS",
  GOALS_HT = "GOALS_HT",
  GOALS_2H = "GOALS_2H",
  TEAM_TOTALS = "TEAM_TOTALS",
  BTTS = "BTTS",
  BTTS_HT = "BTTS_HT",
  HANDICAP = "HANDICAP",
  CORNERS = "CORNERS",
  CORNERS_HANDICAP = "CORNERS_HANDICAP",
  TEAM_CORNERS = "TEAM_CORNERS",
  CARDS = "CARDS",
  TEAM_CARDS = "TEAM_CARDS",
  SHOTS = "SHOTS",
  SHOTS_ON_TARGET = "SHOTS_ON_TARGET",
  FOULS = "FOULS",
  TACKLES = "TACKLES",
  SAVES = "SAVES",
  UNKNOWN = "UNKNOWN",
}
