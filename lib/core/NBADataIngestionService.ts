// ============================================================
// NBA DATA INGESTION SERVICE v1.0 — STANDBY MODE
// Módulo de ingestão de dados NBA, ativado apenas quando
// a demanda de futebol cai abaixo do threshold crítico
// ============================================================

import axios, { AxiosResponse } from "axios";
import { getRedisCacheInstance } from "@/lib/core/RedisCache";
import { circuitBreakerPool } from "@/lib/core/CircuitBreaker";

export interface NBATeamStats {
  teamId: number;
  teamName: string;
  wins: number;
  losses: number;
  pointsPerGame: number;
  pointsAllowedPerGame: number;
  fieldGoalPercentage: number;
  threePointPercentage: number;
  reboundsPerGame: number;
  assistsPerGame: number;
  turnoversPerGame: number;
}

export interface NBAGameData {
  gameId: string;
  date: string;
  homeTeam: NBATeamStats;
  awayTeam: NBATeamStats;
  homeOdds: number;
  awayOdds: number;
  overUnder: number;
  predictedScore: {
    home: number;
    away: number;
  };
}

export class NBADataIngestionService {
  private apiKey: string;
  private baseUrl: string = "https://api.balldontlie.io/v1";
  private isStandbyActive: boolean = false;

  constructor() {
    this.apiKey = process.env.NBA_API_KEY || "";
    if (!this.apiKey) {
      console.warn("[NBADataIngestionService] NBA_API_KEY não configurada. Módulo em Standby.");
    }

    // Registrar Circuit Breaker para a API NBA
    circuitBreakerPool.register({
      name: "NBAAPI",
      failureThreshold: 3,
      successThreshold: 2,
      timeout: 30000,
      resetTimeout: 300000,
    });
  }

  /**
   * Ativa o módulo NBA quando a demanda de futebol cai
   */
  public activateStandby(): void {
    this.isStandbyActive = true;
    console.log("[NBADataIngestionService] 🏀 NBA Standby ATIVADO. Preparando para ingestão de dados.");
  }

  /**
   * Desativa o módulo NBA quando a demanda de futebol se recupera
   */
  public deactivateStandby(): void {
    this.isStandbyActive = false;
    console.log("[NBADataIngestionService] ⚽ NBA Standby DESATIVADO. Retornando ao foco em Futebol.");
  }

  /**
   * Verifica se o módulo está ativo
   */
  public isActive(): boolean {
    return this.isStandbyActive;
  }

  /**
   * Busca dados de um jogo NBA específico
   */
  async ingestGameData(gameId: string): Promise<NBAGameData | null> {
    if (!this.isStandbyActive) {
      console.warn("[NBADataIngestionService] NBA Standby não ativado. Operação bloqueada.");
      return null;
    }

    const cacheKey = `nba:game:${gameId}`;
    const cachedData = await getRedisCacheInstance().get<NBAGameData>(cacheKey);
    if (cachedData) {
      console.log(`[NBADataIngestionService] Dados de jogo NBA ${gameId} recuperados do cache.`);
      return cachedData;
    }

    try {
      // Simular busca de dados NBA (em produção, seria integrado com API real)
      const gameData: NBAGameData = {
        gameId,
        date: new Date().toISOString(),
        homeTeam: {
          teamId: 1,
          teamName: "Boston Celtics",
          wins: 45,
          losses: 20,
          pointsPerGame: 115.2,
          pointsAllowedPerGame: 108.5,
          fieldGoalPercentage: 0.475,
          threePointPercentage: 0.375,
          reboundsPerGame: 45.3,
          assistsPerGame: 27.1,
          turnoversPerGame: 14.2,
        },
        awayTeam: {
          teamId: 2,
          teamName: "Los Angeles Lakers",
          wins: 42,
          losses: 23,
          pointsPerGame: 112.8,
          pointsAllowedPerGame: 110.2,
          fieldGoalPercentage: 0.468,
          threePointPercentage: 0.368,
          reboundsPerGame: 44.8,
          assistsPerGame: 26.5,
          turnoversPerGame: 15.1,
        },
        homeOdds: 1.85,
        awayOdds: 2.05,
        overUnder: 225.5,
        predictedScore: {
          home: 115,
          away: 108,
        },
      };

      await getRedisCacheInstance().set(cacheKey, gameData, 3600);
      console.log(`[NBADataIngestionService] Dados de jogo NBA ${gameId} ingeridos com sucesso.`);

      return gameData;
    } catch (error: any) {
      console.error("[NBADataIngestionService] Erro ao ingerir dados NBA:", error.message);
      return null;
    }
  }

  /**
   * Busca jogos NBA para uma data específica
   */
  async getGamesByDate(date: string): Promise<NBAGameData[]> {
    if (!this.isStandbyActive) {
      console.warn("[NBADataIngestionService] NBA Standby não ativado. Operação bloqueada.");
      return [];
    }

    const cacheKey = `nba:games:${date}`;
    const cachedGames = await getRedisCacheInstance().get<NBAGameData[]>(cacheKey);
    if (cachedGames) {
      console.log(`[NBADataIngestionService] Jogos NBA para ${date} recuperados do cache.`);
      return cachedGames;
    }

    try {
      // Simular busca de jogos NBA
      const games: NBAGameData[] = [
        {
          gameId: `nba-${date}-1`,
          date,
          homeTeam: {
            teamId: 1,
            teamName: "Boston Celtics",
            wins: 45,
            losses: 20,
            pointsPerGame: 115.2,
            pointsAllowedPerGame: 108.5,
            fieldGoalPercentage: 0.475,
            threePointPercentage: 0.375,
            reboundsPerGame: 45.3,
            assistsPerGame: 27.1,
            turnoversPerGame: 14.2,
          },
          awayTeam: {
            teamId: 2,
            teamName: "Los Angeles Lakers",
            wins: 42,
            losses: 23,
            pointsPerGame: 112.8,
            pointsAllowedPerGame: 110.2,
            fieldGoalPercentage: 0.468,
            threePointPercentage: 0.368,
            reboundsPerGame: 44.8,
            assistsPerGame: 26.5,
            turnoversPerGame: 15.1,
          },
          homeOdds: 1.85,
          awayOdds: 2.05,
          overUnder: 225.5,
          predictedScore: {
            home: 115,
            away: 108,
          },
        },
      ];

      await getRedisCacheInstance().set(cacheKey, games, 3600);
      console.log(`[NBADataIngestionService] ${games.length} jogos NBA para ${date} ingeridos com sucesso.`);

      return games;
    } catch (error: any) {
      console.error("[NBADataIngestionService] Erro ao buscar jogos NBA:", error.message);
      return [];
    }
  }

  /**
   * Calcula probabilidades de vitória usando modelo Elo adaptado para NBA
   */
  public calculateWinProbability(homeTeam: NBATeamStats, awayTeam: NBATeamStats): { home: number; away: number } {
    // Fórmula simplificada de Elo para NBA
    const homeElo = 1500 + homeTeam.wins * 10 - homeTeam.losses * 5;
    const awayElo = 1500 + awayTeam.wins * 10 - awayTeam.losses * 5;

    const diff = homeElo - awayElo;
    const homeWinProb = 1 / (1 + Math.pow(10, -diff / 400));
    const awayWinProb = 1 - homeWinProb;

    return { home: homeWinProb, away: awayWinProb };
  }

  /**
   * Retorna status do módulo NBA
   */
  public getStatus(): {
    isActive: boolean;
    moduleName: string;
    mode: string;
    description: string;
  } {
    return {
      isActive: this.isStandbyActive,
      moduleName: "NBA Data Ingestion Service",
      mode: this.isStandbyActive ? "ACTIVE" : "STANDBY",
      description: this.isStandbyActive
        ? "NBA module is active and processing games"
        : "NBA module is in standby. Waiting for football demand to drop below threshold.",
    };
  }
}

// Singleton global
export const nbaDataIngestionService = new NBADataIngestionService();
