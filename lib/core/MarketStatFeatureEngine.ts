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

/** Evidence-backed count-market features. Missing statistics are never replaced by priors. */
export class MarketStatFeatureEngine {
  static build(
    vertical: MarketVertical,
    homeHistory: FixtureResponse[],
    awayHistory: FixtureResponse[],
    homeTeam: string,
    awayTeam: string,
  ): MarketStatProfile | null {
    const types = STAT_TYPES[vertical];
    if (!types) return null;
    const home = this.teamProfile(vertical, types, homeHistory, homeTeam);
    const away = this.teamProfile(vertical, types, awayHistory, awayTeam);
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

  private static teamProfile(vertical: MarketVertical, types: string[], history: FixtureResponse[], teamName: string) {
    const observations: Array<{ own: number; opponent: number }> = [];
    for (const match of history ?? []) {
      const side = this.resolveSide(match, teamName);
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
    return { forMean: ownSum / weightSum, againstMean: opponentSum / weightSum, sample: observations.length };
  }

  private static resolveSide(match: FixtureResponse, teamName: string): "home" | "away" | null {
    const home = match.teams?.home?.name ?? (match as any).home_team;
    const away = match.teams?.away?.name ?? (match as any).away_team;
    const target = this.normalize(teamName);
    if (home && this.normalize(home) === target) return "home";
    if (away && this.normalize(away) === target) return "away";
    return null;
  }

  private static normalize(value: string): string {
    return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  }

  private static getTeamBlocks(statistics: any): any[] | null {
    if (!Array.isArray(statistics)) return null;
    const blocks = statistics.filter((entry: any) => Array.isArray(entry?.statistics));
    return blocks.length >= 2 ? blocks : null;
  }

  private static readStat(vertical: MarketVertical, types: string[], block: any): number | null {
    const source = Array.isArray(block?.statistics) ? block.statistics : [];
    if (vertical === MarketVertical.CARDS) {
      const combined = this.findNumber(source, ["Cards"]);
      if (combined !== null) return combined;
      const yellow = this.findNumber(source, ["Yellow Cards"]);
      const red = this.findNumber(source, ["Red Cards"]);
      return yellow !== null || red !== null ? (yellow ?? 0) + (red ?? 0) : null;
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
