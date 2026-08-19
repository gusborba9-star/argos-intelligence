import { FixtureResponse } from "./DataIngestionService";
import { MarketVertical } from "./contracts/MarketVertical";

export interface MarketStatProfile {
  homeFor: number;
  homeAgainst: number;
  awayFor: number;
  awayAgainst: number;
  homeSample: number;
  awaySample: number;
  sourceSamples: number;
}

const STAT_TYPES: Record<string, string[]> = {
  [MarketVertical.CORNERS]: ["Corner Kicks", "Corners"],
  [MarketVertical.CARDS]: ["Yellow Cards", "Red Cards", "Cards"],
  [MarketVertical.SHOTS]: ["Total Shots", "Shots"],
  [MarketVertical.SHOTS_ON_TARGET]: ["Shots on Goal", "Shots on Target", "On Target"],
  [MarketVertical.FOULS]: ["Fouls", "Fouls Committed"],
  [MarketVertical.TACKLES]: ["Tackles"],
  [MarketVertical.SAVES]: ["Goalkeeper Saves", "Saves"],
};

/**
 * Evidence-backed features for non-scoring count markets.
 * Missing statistics are represented as missing evidence, never synthetic league averages.
 */
export class MarketStatFeatureEngine {
  static build(vertical: MarketVertical, homeHistory: FixtureResponse[], awayHistory: FixtureResponse[]): MarketStatProfile | null {
    const types = STAT_TYPES[vertical];
    if (!types) return null;

    const home = this.teamProfile(vertical, types, homeHistory);
    const away = this.teamProfile(vertical, types, awayHistory);
    if (home.sample === 0 || away.sample === 0) return null;

    return {
      homeFor: home.forMean,
      homeAgainst: home.againstMean,
      awayFor: away.forMean,
      awayAgainst: away.againstMean,
      homeSample: home.sample,
      awaySample: away.sample,
      sourceSamples: home.sample + away.sample,
    };
  }

  private static teamProfile(vertical: MarketVertical, types: string[], history: FixtureResponse[]) {
    const observations: Array<{ own: number; opponent: number }> = [];
    for (const match of history ?? []) {
      const side = this.resolveSide(match, history, match);
      if (!side) continue;
      const blocks = this.getTeamBlocks((match as any).statistics);
      if (!blocks) continue;
      const ownBlock = blocks[side === "home" ? 0 : 1];
      const opponentBlock = blocks[side === "home" ? 1 : 0];
      const own = this.readStat(vertical, types, ownBlock);
      const opponent = this.readStat(vertical, types, opponentBlock);
      if (own === null || opponent === null) continue;
      observations.push({ own, opponent });
    }

    if (observations.length === 0) return { forMean: 0, againstMean: 0, sample: 0 };
    const alpha = 0.25;
    let weightSum = 0;
    let ownSum = 0;
    let opponentSum = 0;
    for (const [index, observation] of observations.entries()) {
      const weight = Math.pow(1 - alpha, index);
      weightSum += weight;
      ownSum += observation.own * weight;
      opponentSum += observation.opponent * weight;
    }
    return {
      forMean: ownSum / weightSum,
      againstMean: opponentSum / weightSum,
      sample: observations.length,
    };
  }

  private static resolveSide(match: FixtureResponse, _history: FixtureResponse[], _current: FixtureResponse): "home" | "away" | null {
    // Team histories are team-specific in the current ingestion contract. Infer the side
    // from the first team name because the same history contains one target team per call.
    const home = match.teams?.home?.name ?? (match as any).home_team;
    const away = match.teams?.away?.name ?? (match as any).away_team;
    if (home && away) return "home";
    return null;
  }

  private static getTeamBlocks(statistics: any): any[] | null {
    if (!Array.isArray(statistics)) return null;
    const blocks = statistics.filter((entry: any) => Array.isArray(entry?.statistics));
    if (blocks.length >= 2) return blocks;
    if (statistics.length >= 2 && statistics.every((entry: any) => entry && typeof entry === "object")) {
      return [{ statistics: statistics }, { statistics: statistics }];
    }
    return null;
  }

  private static readStat(vertical: MarketVertical, types: string[], block: any): number | null {
    const source = Array.isArray(block?.statistics) ? block.statistics : [];
    if (vertical === MarketVertical.CARDS) {
      const yellow = this.findNumber(source, ["Yellow Cards"]);
      const red = this.findNumber(source, ["Red Cards"]);
      const combined = this.findNumber(source, ["Cards"]);
      if (combined !== null) return combined;
      if (yellow !== null || red !== null) return (yellow ?? 0) + (red ?? 0);
      return null;
    }
    return this.findNumber(source, types);
  }

  private static findNumber(source: any[], types: string[]): number | null {
    for (const type of types) {
      const item = source.find((entry: any) => String(entry?.type ?? "").toLowerCase() === type.toLowerCase());
      if (!item) continue;
      const value = typeof item.value === "string" ? Number(item.value.replace("%", "")) : Number(item.value);
      if (Number.isFinite(value)) return value;
    }
    return null;
  }
}
