export type MarketVertical = "WINNER" | "GOALS" | "CARDS" | "CORNERS";

export interface MarketProbability {
  label: string;
  probability: number;
  impliedOdds: number;
}

export interface MatchContextInput {
  matchId: string;
  leagueId?: string;
  winnerMatrix: Record<string, MarketProbability>;
  goalsMatrix: Record<string, MarketProbability>;
  cardsMatrix: Record<string, MarketProbability>;
  cornersMatrix: Record<string, MarketProbability>;
}
