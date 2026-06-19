import { MarketMetrics, ModelFactory, SimulationResult } from "@/lib/core/ModelFactory";
import { RegimeProfile } from "@/lib/argos/regime/RegimeSchema";

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
  tier: "Tier 1" | "Tier 2" | "Tier 3" | "Tier 4"; // Adicionado Tier 4 para ligas não reconhecidas
  historicalLiquidity: number; // Volume histórico de apostas
  oddsDispersion: number; // Dispersão de odds
  avgGoals: number;
  avgCorners: number;
  avgCards: number;
  historicalEVPlus: number; // Histórico de EV+
}

export interface LeagueValueScore {
  matchId: string;
  leagueId: number;
  valueScore: number; // 0-100
  liquidityScore: number; // 0-100
  volatilityScore: number; // 0-100
  priorityTier: "HIGH" | "MEDIUM" | "LOW" | "DROP";
  recommendedAction: "QUEUE_FULL" | "QUEUE_REDUCED" | "SKIP" | "IGNORE";
  expectedEdgeDensity: number; // densidade esperada de EV+
}

export class LeagueValueScoreEngine {
  private static readonly MAX_VALUE_SCORE = 100;
  private static readonly MIN_SCORE_TO_QUEUE = 55; // Hard filter
  private static readonly MIN_KICKOFF_MINUTES = 30; // Hard filter

  /**
   * Avalia um fixture e retorna seu LeagueValueScore.
   * Este é um motor puramente matemático e determinístico.
   */
  public static evaluate(input: LeagueValueInput): LeagueValueScore {
    const { fixture, leagueStats, marketContext, timeToKickoffMinutes } = input;

    // 1. Regras de corte (hard filters) - Eliminação agressiva
    if (!fixture || !fixture.fixture || !fixture.teams || !fixture.league) {
      return this.createDropScore(fixture?.fixture?.id, fixture?.league?.id, "SKIP", "Fixture incompleto");
    }
    if (timeToKickoffMinutes < this.MIN_KICKOFF_MINUTES) {
      return this.createDropScore(fixture.fixture.id, fixture.league.id, "SKIP", "Kickoff muito próximo");
    }
    if (leagueStats.tier === "Tier 4" && leagueStats.historicalLiquidity < 10000) { // Exemplo de liquidez mínima
      return this.createDropScore(fixture.fixture.id, fixture.league.id, "SKIP", "Liga não reconhecida e baixa liquidez");
    }

    // A. Força da liga (peso estrutural)
    let leagueStrength = 0;
    switch (leagueStats.tier) {
      case "Tier 1":
        leagueStrength = 1.0;
        break;
      case "Tier 2":
        leagueStrength = 0.7;
        break;
      case "Tier 3":
        leagueStrength = 0.4;
        break;
      default:
        leagueStrength = 0.1; // Ligas não reconhecidas ou de baixo tier
    }

    // B. Liquidez de mercado (proxy de eficiência)
    const liquidityScore = Math.min(100, leagueStats.historicalLiquidity / 100000 * 100); // Normaliza para 0-100
    const marketEfficiency = 1 - (leagueStats.oddsDispersion / 100); // Quanto menor a dispersão, maior a eficiência

    // C. Tempo até início (CRÍTICO)
    let timingScore = 0;
    if (timeToKickoffMinutes >= 60 && timeToKickoffMinutes <= 360) { // 1h a 6h
      timingScore = 1.0;
    } else if (timeToKickoffMinutes > 360 && timeToKickoffMinutes <= 1440) { // 6h a 24h
      timingScore = 0.7;
    } else if (timeToKickoffMinutes > 1440) { // > 24h
      timingScore = 0.4;
    } else { // < 60 min (já filtrado acima, mas para segurança)
      timingScore = 0.1;
    }

    // D. Desbalanceamento estrutural (base para EV multi-vertical)
    // Simulação simplificada para fins de exemplo
    const teamStrengthIndex = fixture.teamStrengthIndex || 1.0; // Assumindo que vem do input
    const bookmakerSpread = fixture.bookmakerSpread || 0.0; // Assumindo que vem do input
    const historicalVariance = fixture.historicalVariance || 0.0; // Assumindo que vem do input

    const structuralImbalance = (teamStrengthIndex * 0.4) + (Math.abs(bookmakerSpread) * 0.3) + (historicalVariance * 0.3);

    // E. Contexto global de calendário (já tratado na LeagueProfile via globalContextScore)
    const globalContextScore = fixture.globalContextScore || 1.0; // Assumindo que vem do input

    // 3.3 Score final (determinístico)
    let valueScore = (
      (0.30 * leagueStrength) +
      (0.25 * (liquidityScore / 100)) + // Normalizado
      (0.20 * structuralImbalance) +
      (0.15 * timingScore) +
      (0.10 * marketEfficiency)
    ) * 100; // Multiplica por 100 para ter 0-100

    valueScore = Math.min(this.MAX_VALUE_SCORE, Math.max(0, valueScore)); // Garante que esteja entre 0 e 100

    // Volatility Score (simplificado para exemplo)
    const volatilityScore = Math.min(100, (historicalVariance * 10) + (leagueStats.oddsDispersion * 0.5));

    // Expected Edge Density (simplificado para exemplo, será mais preciso com EODM)
    // Por enquanto, uma função do valueScore e historicalEVPlus
    const expectedEdgeDensity = (valueScore / 100) * leagueStats.historicalEVPlus * globalContextScore;

    let priorityTier: LeagueValueScore["priorityTier"];
    let recommendedAction: LeagueValueScore["recommendedAction"];

    if (valueScore < this.MIN_SCORE_TO_QUEUE) {
      priorityTier = "DROP";
      recommendedAction = "IGNORE";
    } else if (valueScore >= 80) {
      priorityTier = "HIGH";
      recommendedAction = "QUEUE_FULL";
    } else if (valueScore >= 65) {
      priorityTier = "MEDIUM";
      recommendedAction = "QUEUE_REDUCED";
    } else {
      priorityTier = "LOW";
      recommendedAction = "SKIP";
    }

    return {
      matchId: fixture.fixture.id.toString(),
      leagueId: fixture.league.id,
      valueScore: parseFloat(valueScore.toFixed(2)),
      liquidityScore: parseFloat(liquidityScore.toFixed(2)),
      volatilityScore: parseFloat(volatilityScore.toFixed(2)),
      priorityTier,
      recommendedAction,
      expectedEdgeDensity: parseFloat(expectedEdgeDensity.toFixed(4)),
    };
  }

  private static createDropScore(matchId: string | undefined, leagueId: number | undefined, action: LeagueValueScore["recommendedAction"], reason: string): LeagueValueScore {
    console.log(`[LeagueValueScoreEngine] DROP Fixture ${matchId} (${leagueId}): ${reason}`);
    return {
      matchId: matchId ? matchId.toString() : "unknown",
      leagueId: leagueId || 0,
      valueScore: 0,
      liquidityScore: 0,
      volatilityScore: 100, // Alta volatilidade para itens descartados
      priorityTier: "DROP",
      recommendedAction: action,
      expectedEdgeDensity: 0,
    };
  }
}
