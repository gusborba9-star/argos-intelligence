import { MarketVertical } from "../contracts/MarketVertical";

export interface MarketOutcomeContext {
  selectionNames?: readonly string[];
  homeTeam?: string;
  awayTeam?: string;
  period?: string;
}

export interface MarketCoverageDefinition {
  key: string;
  vertical: MarketVertical;
  aliases: string[];
  requiresTeamSplit?: boolean;
  requiresPeriod?: boolean;
  countBased?: boolean;
}

export interface MarketCoverageResult {
  discovered: string[];
  covered: string[];
  unknown: string[];
  byVertical: Record<string, number>;
}

export const SOCCER_MARKET_COVERAGE: readonly MarketCoverageDefinition[] = [
  { key: "h2h", vertical: MarketVertical.WINNER, aliases: ["match_winner", "1x2"] },
  { key: "double_chance", vertical: MarketVertical.DOUBLE_CHANCE, aliases: ["double-chance"] },
  { key: "draw_no_bet", vertical: MarketVertical.DRAW_NO_BET, aliases: ["dnb"] },
  { key: "spreads", vertical: MarketVertical.HANDICAP, aliases: ["handicap", "asian_handicap"] },
  { key: "totals", vertical: MarketVertical.GOALS, aliases: ["goals_ou", "over_under"], countBased: true },
  { key: "team_totals", vertical: MarketVertical.TEAM_TOTALS, aliases: ["team_total", "team_goals"], requiresTeamSplit: true, countBased: true },
  { key: "both_teams_to_score", vertical: MarketVertical.BTTS, aliases: ["btts"] },
  { key: "btts_first_half", vertical: MarketVertical.BTTS_HT, aliases: ["first_half_btts"], requiresPeriod: true },
  { key: "btts_second_half", vertical: MarketVertical.BTTS_HT, aliases: ["second_half_btts"], requiresPeriod: true },
  { key: "total_corners", vertical: MarketVertical.CORNERS, aliases: ["corners"], countBased: true },
  { key: "corners_spread", vertical: MarketVertical.CORNERS_HANDICAP, aliases: ["corner_spread", "corners_handicap"], countBased: true },
  { key: "team_corners", vertical: MarketVertical.TEAM_CORNERS, aliases: ["team_corner_total"], requiresTeamSplit: true, countBased: true },
  { key: "total_cards", vertical: MarketVertical.CARDS, aliases: ["cards", "bookings"], countBased: true },
  { key: "team_cards", vertical: MarketVertical.TEAM_CARDS, aliases: ["team_card_total", "team_bookings"], requiresTeamSplit: true, countBased: true },
  { key: "shots", vertical: MarketVertical.SHOTS, aliases: ["total_shots"], countBased: true },
  { key: "shots_on_target", vertical: MarketVertical.SHOTS_ON_TARGET, aliases: ["shots_on_goal", "sot"], countBased: true },
  { key: "fouls", vertical: MarketVertical.FOULS, aliases: ["total_fouls"], countBased: true },
  { key: "tackles", vertical: MarketVertical.TACKLES, aliases: ["total_tackles"], countBased: true },
  { key: "saves", vertical: MarketVertical.SAVES, aliases: ["goalkeeper_saves"], countBased: true },
  { key: "first_half_result", vertical: MarketVertical.WINNER_HT, aliases: ["ht_winner", "1h_result"], requiresPeriod: true },
  { key: "first_half_goals", vertical: MarketVertical.GOALS_HT, aliases: ["totals_first_half", "ht_goals", "half_time_goals"], requiresPeriod: true, countBased: true },
  { key: "second_half_goals", vertical: MarketVertical.GOALS_2H, aliases: ["totals_second_half", "2h_goals"], requiresPeriod: true, countBased: true },
];

const normalize = (value: string): string => value.toLowerCase().trim().replace(/[-\s]+/g, "_");
const same = (a?: string, b?: string): boolean => !!a && !!b && normalize(a) === normalize(b);

export class MarketCoverageRegistry {
  static resolve(key: string, context: MarketOutcomeContext = {}): MarketCoverageDefinition | undefined {
    const normalized = normalize(key);
    const genericCards = normalized === "cards" || normalized === "bookings" || normalized === "total_cards";
    const hasTeamOutcome = genericCards && (context.selectionNames || []).some((selection) => same(selection, context.homeTeam) || same(selection, context.awayTeam));
    if (hasTeamOutcome) return SOCCER_MARKET_COVERAGE.find((definition) => definition.key === "team_cards");

    const genericCorners = normalized === "corners" || normalized === "total_corners";
    const hasCornerTeamOutcome = genericCorners && (context.selectionNames || []).some((selection) => same(selection, context.homeTeam) || same(selection, context.awayTeam));
    if (hasCornerTeamOutcome) return SOCCER_MARKET_COVERAGE.find((definition) => definition.key === "team_corners");

    return SOCCER_MARKET_COVERAGE.find((definition) => definition.key === normalized || definition.aliases.includes(normalized));
  }

  static audit(discoveredKeys: string[]): MarketCoverageResult {
    const discovered = [...new Set(discoveredKeys.map(normalize))];
    const covered: string[] = [];
    const unknown: string[] = [];
    const byVertical: Record<string, number> = {};
    for (const key of discovered) {
      const definition = this.resolve(key);
      if (!definition) { unknown.push(key); continue; }
      covered.push(key);
      byVertical[definition.vertical] = (byVertical[definition.vertical] ?? 0) + 1;
    }
    return { discovered, covered, unknown, byVertical };
  }
}
