import { FixtureResponse, AdjustedMetrics } from "./DataIngestionService";

/**
 * FEATURE ENGINE v6.1.0 — SYNDICATE MASTER
 *
 * Converts historical raw fixtures into team-specific statistical features.
 * Critical invariant: a team's goals/x stats must represent that team, not
 * the aggregate statistics of the match.
 */
export interface FeatureVector {
  homeMetrics: AdjustedMetrics;
  awayMetrics: AdjustedMetrics;
  externalFactors: any;
  leagueProfile: any;
  historicalContext: {
    headToHead: any[];
    homeRecentForm: number;
    awayRecentForm: number;
  };
}

export class FeatureEngine {
  public static generateFeatureVector(rawData: any): FeatureVector {
    const homeHistory = Array.isArray(rawData.homeHistory) ? rawData.homeHistory : [];
    const awayHistory = Array.isArray(rawData.awayHistory) ? rawData.awayHistory : [];
    const homeTeam = rawData.home_team ?? rawData.teams?.home?.name ?? rawData.fixture?.teams?.home?.name;
    const awayTeam = rawData.away_team ?? rawData.teams?.away?.name ?? rawData.fixture?.teams?.away?.name;

    const homeMetrics = this.calculateExponentialAverages(homeHistory, homeTeam);
    const awayMetrics = this.calculateExponentialAverages(awayHistory, awayTeam);

    return {
      homeMetrics,
      awayMetrics,
      externalFactors: rawData.externalFactors,
      leagueProfile: this.normalizeLeagueProfile(
        rawData.fixture?.league ?? rawData.league ?? {
          name:
            rawData.sport_title ||
            rawData.league_name ||
            (rawData.sport_key
              ? rawData.sport_key
                  .replace(/^soccer_/, "")
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (c: string) => c.toUpperCase())
              : "Unknown League"),
          id: rawData.league_id ?? rawData.sport_key ?? null,
        }
      ),
      historicalContext: {
        headToHead: rawData.headToHead || [],
        homeRecentForm: this.calculateForm(homeHistory, homeTeam),
        awayRecentForm: this.calculateForm(awayHistory, awayTeam),
      },
    };
  }

  /**
   * Calculates points earned by the team represented by this history.
   * Never assumes that the team was the home side in every historical fixture.
   */
  private static calculateForm(history: FixtureResponse[], teamName?: string): number {
    if (!history || history.length === 0) return 0.5;

    const recent = history.slice(0, 5);
    let points = 0;
    let observed = 0;

    for (const match of recent) {
      const side = this.resolveTeamSide(match, teamName);
      const homeGoals = this.numeric(match.goals?.home);
      const awayGoals = this.numeric(match.goals?.away);
      if (side === null || homeGoals === null || awayGoals === null) continue;

      observed++;
      const teamGoals = side === "home" ? homeGoals : awayGoals;
      const opponentGoals = side === "home" ? awayGoals : homeGoals;

      if (teamGoals > opponentGoals) points += 3;
      else if (teamGoals === opponentGoals) points += 1;
    }

    return observed > 0 ? points / (observed * 3) : 0.5;
  }

  /**
   * Exponentially weighted team-specific averages.
   *
   * The previous implementation summed both teams' goals for every team
   * history. That doubled the conceptual goal environment and could inflate
   * Monte Carlo probabilities. This implementation extracts only the tracked
   * team's contribution from each historical fixture.
   */
  private static calculateExponentialAverages(
    history: FixtureResponse[],
    teamName?: string
  ): AdjustedMetrics {
    const alpha = 0.3;
    let totalWeight = 0;
    const sums = {
      goals: 0,
      goalsHT: 0,
      corners: 0,
      cards: 0,
      shots: 0,
      shotsOnTarget: 0,
    };

    if (!history || history.length === 0) {
      return {
        goals: 1.5,
        goalsHT: 0.5,
        corners: 5,
        cards: 2,
        shots: 12,
        shotsOnTarget: 5,
      };
    }

    for (const [index, match] of history.entries()) {
      const side = this.resolveTeamSide(match, teamName);
      if (side === null) continue;

      const weight = Math.pow(1 - alpha, index);
      const teamGoals = side === "home" ? this.numeric(match.goals?.home) : this.numeric(match.goals?.away);
      const teamGoalsHT = side === "home"
        ? this.numeric(match.score?.halftime?.home)
        : this.numeric(match.score?.halftime?.away);

      if (teamGoals === null) continue;

      totalWeight += weight;
      sums.goals += teamGoals * weight;
      if (teamGoalsHT !== null) sums.goalsHT += teamGoalsHT * weight;

      // Historical count-stat payloads are optional. Missing values are not
      // treated as real zeroes. A conservative neutral prior is used only for
      // these auxiliary features; goals remain entirely data-driven above.
      const stats = Array.isArray((match as any).statistics) ? (match as any).statistics : null;
      if (stats) {
        const sideStats = this.extractSideStatistics(stats, side);
        sums.corners += sideStats.corners * weight;
        sums.cards += sideStats.cards * weight;
        sums.shots += sideStats.shots * weight;
        sums.shotsOnTarget += sideStats.shotsOnTarget * weight;
      } else {
        sums.corners += 5 * weight;
        sums.cards += 2 * weight;
        sums.shots += 12 * weight;
        sums.shotsOnTarget += 5 * weight;
      }
    }

    if (totalWeight === 0) {
      return {
        goals: 1.5,
        goalsHT: 0.5,
        corners: 5,
        cards: 2,
        shots: 12,
        shotsOnTarget: 5,
      };
    }

    return {
      goals: sums.goals / totalWeight,
      goalsHT: sums.goalsHT / totalWeight,
      corners: sums.corners / totalWeight,
      cards: sums.cards / totalWeight,
      shots: sums.shots / totalWeight,
      shotsOnTarget: sums.shotsOnTarget / totalWeight,
    };
  }

  private static resolveTeamSide(
    match: FixtureResponse,
    teamName?: string
  ): "home" | "away" | null {
    const home = match.teams?.home?.name ?? (match as any).home_team;
    const away = match.teams?.away?.name ?? (match as any).away_team;

    if (!teamName) return null;

    const target = this.normalizeName(teamName);
    if (home && this.normalizeName(home) === target) return "home";
    if (away && this.normalizeName(away) === target) return "away";
    return null;
  }

  private static normalizeName(value: string): string {
    return value
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  private static numeric(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  private static extractSideStatistics(stats: any[], side: "home" | "away") {
    // Supports both common provider shapes:
    // [{team:{name/id}, statistics:[...]}] and a flat statistics array.
    const teamBlock = stats.find((entry: any) => {
      const name = entry?.team?.name;
      return name ? true : false;
    });

    const source = Array.isArray(teamBlock?.statistics)
      ? teamBlock.statistics
      : stats;

    const get = (types: string[]) => {
      for (const type of types) {
        const item = source.find((entry: any) => String(entry?.type ?? "").toLowerCase() === type.toLowerCase());
        if (item) {
          const value = this.numeric(item.value);
          if (value !== null) return value;
        }
      }
      return 0;
    };

    // If provider supplied two team blocks, select the block corresponding to
    // the requested side. Otherwise preserve the flat payload semantics.
    const blocks = stats.filter((entry: any) => Array.isArray(entry?.statistics));
    const selectedBlock = blocks.length >= 2 ? blocks[side === "home" ? 0 : 1] : teamBlock;
    const selectedSource = Array.isArray(selectedBlock?.statistics) ? selectedBlock.statistics : source;
    const getSelected = (types: string[]) => {
      for (const type of types) {
        const item = selectedSource.find((entry: any) => String(entry?.type ?? "").toLowerCase() === type.toLowerCase());
        if (item) {
          const value = this.numeric(item.value);
          if (value !== null) return value;
        }
      }
      return 0;
    };

    return {
      corners: getSelected(["Corner Kicks", "Corners"]),
      cards: getSelected(["Yellow Cards"]) + getSelected(["Red Cards"]),
      shots: getSelected(["Total Shots"]),
      shotsOnTarget: getSelected(["Shots on Goal", "Shots on Target"]),
    };
  }

  private static normalizeLeagueProfile(league: any) {
    const rawTier = league?.tier || league?.level || league?.rank;
    const normalizedTier =
      rawTier === 1 || rawTier === "1" || rawTier === "Tier 1" ? "Tier 1" : "Tier 2";
    return {
      tier: normalizedTier,
      country: league?.country ?? "Global",
      name: league?.name ?? "Unknown League",
    };
  }
}
