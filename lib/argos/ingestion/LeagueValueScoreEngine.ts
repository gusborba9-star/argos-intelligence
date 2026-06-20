export interface LeagueValueInput {
  fixture: any;
  leagueStats: LeagueProfile;
  marketContext: {
    saturation: number;
    calendarPressure: number;
  };
  timeToKickoffMinutes: number;
}

export interface LeagueProfile {
  id: number;
  name: string;
  tier: "Tier 1" | "Tier 2" | "Tier 3" | "Tier 4";
  historicalLiquidity: number; 
  oddsDispersion: number; 
  avgGoals: number;
  avgCorners: number;
  avgCards: number;
  historicalEVPlus: number; 
  confidenceScore?: number; // Argos v5.0: Regra de não fingir informação
}

export interface LeagueValueScore {
  matchId: string;
  leagueId: number;
  
  // Argos v5.0: Foco em Densidade de Oportunidade (CPU Worthiness)
  operationalDensity: number; // 0-100 (Vale gastar processamento?)
  liquidityScore: number;    // 0-100
  dataQualityScore: number;  // 0-100
  
  priorityTier: "HIGH" | "MEDIUM" | "LOW" | "DROP";
  recommendedAction: "QUEUE_FULL" | "QUEUE_REDUCED" | "SKIP" | "IGNORE";
}

/**
 * LEAGUE VALUE SCORE ENGINE v5.0 — DETERMINISTIC OPERATIONAL FILTER
 * 
 * Responsabilidade: Decidir se um jogo merece CPU/Análise.
 * NÃO prevê EV. NÃO prevê resultados.
 */
export class LeagueValueScoreEngine {
  private static readonly MIN_DENSITY_TO_QUEUE = 45; 
  private static readonly MIN_KICKOFF_MINUTES = 45; // Evitar jogos em cima da hora

  public static evaluate(input: LeagueValueInput): LeagueValueScore {
    const { fixture, leagueStats, timeToKickoffMinutes } = input;

    // 1. HARD FILTERS (Pre-Filter Barato)
    if (!fixture?.fixture?.id || !fixture?.teams?.home?.name || !fixture?.league?.name) {
      return this.createDropScore(fixture?.fixture?.id, fixture?.league?.id, "Fixture incompleto");
    }

    if (timeToKickoffMinutes < this.MIN_KICKOFF_MINUTES) {
      return this.createDropScore(fixture.fixture.id, fixture.league.id, "Kickoff muito próximo ou já iniciado");
    }

    // 2. CÁLCULO DE DENSIDADE OPERACIONAL
    
    // A. Peso da Competição (Importância Estrutural — Argos v5.0 Elite Adaptation)
    let competitionWeight = 0.2;
    
    // Lista de Ligas de Elite (Sempre Prioridade Máxima)
    const eliteLeagues = [
      13, 61, 78, 94, 140, // Premier League, Ligue 1, Bundesliga, Primeira Liga, La Liga
      71, 72, 73, // Brasileirão A, B, Copa do Brasil
      2, 3, 11, 15, // Champions, Europa League, Libertadores, Sul-Americana
      1 // World Cup (Copa do Mundo)
    ];

    if (eliteLeagues.includes(fixture.league.id)) {
      competitionWeight = 1.2; // Bônus de Elite
    } else if (leagueStats.tier === "Tier 1") {
      competitionWeight = 1.0;
    } else if (leagueStats.tier === "Tier 2") {
      competitionWeight = 0.7;
    } else if (leagueStats.tier === "Tier 3") {
      competitionWeight = 0.4;
    }

    // Argos v5.0 Syndicate-Level: Consciência de Cenário Dinâmica
    // Se for Copa do Mundo (1), Champions (2), ou Libertadores (11), a prioridade é absoluta.
    // O sistema se adapta ao "Cenário Atual" priorizando esses eventos de magnitude máxima.
    if ([1, 2, 11].includes(fixture.league.id)) {
      competitionWeight = 2.5; // Peso extremo para garantir que esses jogos nunca sejam ignorados
    }

    // B. Liquidez Estimada (Proxy de disponibilidade de mercados e limites)
    const liquidityScore = Math.min(100, (leagueStats.historicalLiquidity / 1000000) * 100);

    // C. Qualidade de Dados (Baseado no Tier e histórico)
    const dataQualityScore = leagueStats.tier === "Tier 4" ? 30 : 90;

    // D. Janela de Tempo (Opportunity Window)
    let timingScore = 0;
    if (timeToKickoffMinutes >= 60 && timeToKickoffMinutes <= 480) timingScore = 100; // 1h a 8h: Janela Ideal
    else if (timeToKickoffMinutes > 480 && timeToKickoffMinutes <= 1440) timingScore = 70; // 8h a 24h: Bom
    else if (timeToKickoffMinutes > 1440) timingScore = 40; // > 24h: Cedo demais
    else timingScore = 20; // < 60min: Tarde demais

    // 3. SCORE FINAL (Determinístico) — Argos v5.0 Final Architecture
    // Pesos exatos do documento:
    // League Quality: 20%
    // Data Confidence: 25%
    // Market Availability: 20%
    // Fixture Importance: 15%
    // Time Window: 10%
    // Historical Stability: 10%
    
    const leagueQuality = competitionWeight * 100;
    const dataConfidence = dataQualityScore;
    const marketAvailability = liquidityScore; // Proxy
    const fixtureImportance = competitionWeight * 100; // Proxy
    const timeWindow = timingScore;
    const historicalStability = leagueStats.tier === "Tier 1" ? 100 : 50; // Proxy

    const operationalDensity = (
      (leagueQuality * 0.20) +
      (dataConfidence * 0.25) +
      (marketAvailability * 0.20) +
      (fixtureImportance * 0.15) +
      (timeWindow * 0.10) +
      (historicalStability * 0.10)
    );

    let priorityTier: LeagueValueScore["priorityTier"] = "DROP";
    let recommendedAction: LeagueValueScore["recommendedAction"] = "IGNORE";

    if (operationalDensity >= 75) {
      priorityTier = "HIGH";
      recommendedAction = "QUEUE_FULL";
    } else if (operationalDensity >= 55) {
      priorityTier = "MEDIUM";
      recommendedAction = "QUEUE_REDUCED";
    } else if (operationalDensity >= this.MIN_DENSITY_TO_QUEUE) {
      priorityTier = "LOW";
      recommendedAction = "SKIP";
    }

    return {
      matchId: fixture.fixture.id.toString(),
      leagueId: fixture.league.id,
      operationalDensity: parseFloat(operationalDensity.toFixed(2)),
      liquidityScore: parseFloat(liquidityScore.toFixed(2)),
      dataQualityScore: parseFloat(dataQualityScore.toFixed(2)),
      priorityTier,
      recommendedAction,
    };
  }

  private static createDropScore(matchId: any, leagueId: any, reason: string): LeagueValueScore {
    console.log(`[Argos v5.0] DROP Fixture ${matchId}: ${reason}`);
    return {
      matchId: matchId?.toString() || "0",
      leagueId: leagueId || 0,
      operationalDensity: 0,
      liquidityScore: 0,
      dataQualityScore: 0,
      priorityTier: "DROP",
      recommendedAction: "IGNORE",
    };
  }
}
