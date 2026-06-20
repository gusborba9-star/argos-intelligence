import { FixtureResponse, AdjustedMetrics } from "./DataIngestionService";

/**
 * FEATURE ENGINE v5.1
 * Responsável exclusiva por transformar dados RAW em features estatísticas.
 * Isola a inteligência da camada de transporte/ingestão.
 */
export interface FeatureVector {
  homeMetrics: AdjustedMetrics;
  awayMetrics: AdjustedMetrics;
  externalFactors: any;
  leagueProfile: any;
}

export class FeatureEngine {
  /**
   * CONTRATO FORMAL: RawData -> FeatureVector
   * Transforma dados brutos de ingestão em um vetor de features normalizado.
   */
  public static generateFeatureVector(rawData: any): FeatureVector {
    const homeMetrics = this.calculateExponentialAverages(rawData.homeHistory);
    const awayMetrics = this.calculateExponentialAverages(rawData.awayHistory);
    
    return {
      homeMetrics,
      awayMetrics,
      externalFactors: rawData.externalFactors,
      leagueProfile: this.normalizeLeagueProfile(rawData.fixture.league)
    };
  }

  /**
   * Aplica Fator de Decaimento Exponencial: Jogos recentes têm peso maior
   * Fórmula: Peso = alpha * (1 - alpha)^n, onde n é a distância do jogo atual
   */
  private static calculateExponentialAverages(history: FixtureResponse[]): AdjustedMetrics {
    const alpha = 0.3; // Fator de decaimento (30% de peso para o mais recente)
    let totalWeight = 0;

    const sums = { goals: 0, goalsHT: 0, corners: 0, cards: 0, shots: 0, shotsOnTarget: 0 };

    if (!history || history.length === 0) {
      return { goals: 1.5, goalsHT: 0.5, corners: 5, cards: 2, shots: 12, shotsOnTarget: 5 };
    }

    history.forEach((match, index) => {
      const weight = Math.pow(1 - alpha, index);
      totalWeight += weight;

      const homeGoals = typeof match.goals.home === 'number' ? match.goals.home : 0;
      const awayGoals = typeof match.goals.away === 'number' ? match.goals.away : 0;
      sums.goals += (homeGoals + awayGoals) * weight;

      const homeGoalsHT = typeof match.score.halftime.home === 'number' ? match.score.halftime.home : 0;
      const awayGoalsHT = typeof match.score.halftime.away === 'number' ? match.score.halftime.away : 0;
      sums.goalsHT += (homeGoalsHT + awayGoalsHT) * weight;

      // Argos v5.0: Integração de estatísticas reais (se disponíveis no objeto da API-Football)
      // Nota: FixtureResponse precisa ser estendido se a API retornar statistics embutido no histórico
      const stats = (match as any).statistics;
      if (stats && Array.isArray(stats)) {
        const getVal = (type: string) => {
          const s = stats.find(i => i.type === type);
          return typeof s?.value === 'number' ? s.value : parseInt(s?.value || '0');
        };
        sums.corners += getVal("Corner Kicks") * weight;
        sums.cards += (getVal("Yellow Cards") + getVal("Red Cards")) * weight;
        sums.shots += getVal("Total Shots") * weight;
        sums.shotsOnTarget += getVal("Shots on Goal") * weight;
      } else {
        // Fallback conservador se não houver estatísticas no histórico
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

  /**
   * Normalização de contrato de liga para garantir consistência do pipeline
   */
  private static normalizeLeagueProfile(league: any) {
    const rawTier = league?.tier || league?.level || league?.rank;

    const normalizedTier =
      rawTier === 1 || rawTier === "1" || rawTier === "Tier 1"
        ? "Tier 1"
        : rawTier === 2 || rawTier === "2" || rawTier === "Tier 2"
        ? "Tier 2"
        : "Tier 3";

    return {
      tier: normalizedTier,
      country: league?.country ?? null,
      name: league?.name ?? null
    };
  }
}
