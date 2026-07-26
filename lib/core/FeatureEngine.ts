import { FixtureResponse, AdjustedMetrics } from "./DataIngestionService";

/**
 * FEATURE ENGINE v6.0.0 — SYNDICATE MASTER
 * Responsável exclusiva por transformar dados RAW em features estatísticas.
 * Integração profunda com histórico real e perfis de liga.
 */
export interface FeatureVector {
  homeMetrics: AdjustedMetrics;
  awayMetrics: AdjustedMetrics;
  externalFactors: any;
  leagueProfile: any;
  historicalContext: {
    headToHead: any[];
    homeRecentForm: number; // 0 a 1
    awayRecentForm: number; // 0 a 1
  };
}

export class FeatureEngine {
  /**
   * Transforma dados brutos de ingestão em um vetor de features normalizado v6.0.0.
   */
  public static generateFeatureVector(rawData: any): FeatureVector {
    const homeMetrics = this.calculateExponentialAverages(rawData.homeHistory);
    const awayMetrics = this.calculateExponentialAverages(rawData.awayHistory);
    
    return {
      homeMetrics,
      awayMetrics,
      externalFactors: rawData.externalFactors,
      leagueProfile: this.normalizeLeagueProfile(
        rawData.fixture?.league ?? rawData.league ?? {
          // PropLine real só manda `sport_key` (ex: "soccer_copa_sudamericana"),
          // não `sport_title`. Deixa legível: "Copa Sudamericana".
          name:
            rawData.sport_title ||
            rawData.league_name ||
            (rawData.sport_key
              ? rawData.sport_key.replace(/^soccer_/, "").replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
              : "Unknown League"),
          id: rawData.league_id ?? rawData.sport_key ?? null,
        }
      ),
      historicalContext: {
        headToHead: rawData.headToHead || [],
        homeRecentForm: this.calculateForm(rawData.homeHistory),
        awayRecentForm: this.calculateForm(rawData.awayHistory)
      }
    };
  }

  private static calculateForm(history: FixtureResponse[]): number {
    if (!history || history.length === 0) return 0.5;
    const recent = history.slice(0, 5);
    let points = 0;
    recent.forEach(m => {
      if (m.teams.home.winner) points += 3;
      else if (m.teams.home.winner === null) points += 1;
    });
    return points / 15;
  }

  /**
   * Aplica Fator de Decaimento Exponencial: Jogos recentes têm peso maior
   */
  private static calculateExponentialAverages(history: FixtureResponse[]): AdjustedMetrics {
    const alpha = 0.3;
    let totalWeight = 0;
    const sums = { goals: 0, goalsHT: 0, corners: 0, cards: 0, shots: 0, shotsOnTarget: 0 };

    if (!history || history.length === 0) {
      return { goals: 1.5, goalsHT: 0.5, corners: 5, cards: 2, shots: 12, shotsOnTarget: 5 };
    }

    history.forEach((match, index) => {
      const weight = Math.pow(1 - alpha, index);
      totalWeight += weight;

      const homeGoals = typeof match.goals?.home === 'number' ? match.goals.home : 0;
      const awayGoals = typeof match.goals?.away === 'number' ? match.goals.away : 0;
      sums.goals += (homeGoals + awayGoals) * weight;

      const homeGoalsHT = typeof match.score?.halftime?.home === 'number' ? match.score.halftime.home : 0;
      const awayGoalsHT = typeof match.score?.halftime?.away === 'number' ? match.score.halftime.away : 0;
      sums.goalsHT += (homeGoalsHT + awayGoalsHT) * weight;

      const stats = (match as any).statistics;
      if (stats && Array.isArray(stats)) {
        const getVal = (type: string) => {
          const s = stats.find((i: any) => i.type === type);
          return typeof s?.value === 'number' ? s.value : parseInt(s?.value || '0');
        };
        sums.corners += getVal("Corner Kicks") * weight;
        sums.cards += (getVal("Yellow Cards") + getVal("Red Cards")) * weight;
        sums.shots += getVal("Total Shots") * weight;
        sums.shotsOnTarget += getVal("Shots on Goal") * weight;
      } else {
        sums.corners += 4.5 * weight; 
        sums.cards += 1.8 * weight; 
        sums.shots += 10 * weight; 
        sums.shotsOnTarget += 3.5 * weight; 
      }
    });

    return {
      goals: totalWeight > 0 ? sums.goals / totalWeight : 1.5,
      goalsHT: totalWeight > 0 ? sums.goalsHT / totalWeight : 0.5,
      corners: totalWeight > 0 ? sums.corners / totalWeight : 5,
      cards: totalWeight > 0 ? sums.cards / totalWeight : 2,
      shots: totalWeight > 0 ? sums.shots / totalWeight : 12,
      shotsOnTarget: totalWeight > 0 ? sums.shotsOnTarget / totalWeight : 5,
    };
  }

  private static normalizeLeagueProfile(league: any) {
    const rawTier = league?.tier || league?.level || league?.rank;
    const normalizedTier = (rawTier === 1 || rawTier === "1" || rawTier === "Tier 1") ? "Tier 1" : "Tier 2";
    return {
      tier: normalizedTier,
      country: league?.country ?? "Global",
      name: league?.name ?? "Unknown League"
    };
  }
}
