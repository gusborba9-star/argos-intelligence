import axios, { AxiosResponse } from "axios";
import { getRedisCacheInstance } from "@/lib/core/RedisCache";
import { circuitBreakerPool } from "@/lib/core/CircuitBreaker";
import { LeagueProfile } from "@/lib/argos/ingestion/LeagueValueScoreEngine";

// ============================================================
// DATA INGESTION SERVICE v4.5 — EXPONENTIAL INTELLIGENCE
// Automatiza a extração de dados e calcula médias ajustadas com decaimento temporal
// ============================================================

export interface AdjustedMetrics {
  goals: number;
  goalsHT: number;
  corners: number;
  cards: number;
  shots: number;
  shotsOnTarget: number;
}

export interface ExternalFactors {
  refereeStrictness: number;
  weatherCondition: "CLEAR" | "RAIN" | "EXTREME_HEAT";
  motivationLevel: "NORMAL" | "HIGH" | "LOW";
  isDerby: boolean;
  expectedEdge: number;
}

export interface EnrichedFixture extends FixtureResponse {
  teamStrengthIndex?: number;
  bookmakerSpread?: number;
  historicalVariance?: number;
  globalContextScore?: number;
}

export interface IngestedData {
  matchId: string;
  leagueId: string;
  homeHistory: FixtureResponse[];
  awayHistory: FixtureResponse[];
  externalFactors: ExternalFactors;
  fixture: FixtureResponse;
}

interface FixtureTeam {
  id: number;
  name: string;
  logo: string;
  winner: boolean | null;
}

interface FixtureLeague {
  id: number;
  name: string;
  country: string;
  logo: string;
  flag: string;
  season: number;
  round: string;
}

interface FixtureStatus {
  long: string;
  short: string;
  elapsed: number | null;
}

interface FixtureVenue {
  id: number;
  name: string;
  city: string;
}

interface FixtureReferee {
  id: number;
  name: string;
}

interface FixtureGoals {
  home: number | null;
  away: number | null;
}

export interface FixtureResponse {
  fixture: {
    id: number;
    referee: string | null;
    timezone: string;
    date: string;
    timestamp: number;
    periods: {
      first: number | null;
      second: number | null;
    };
    venue: FixtureVenue;
    status: FixtureStatus;
  };
  league: FixtureLeague;
  teams: {
    home: FixtureTeam;
    away: FixtureTeam;
  };
  goals: FixtureGoals;
  score: {
    halftime: FixtureGoals;
    fulltime: FixtureGoals;
    extratime: FixtureGoals;
    penalty: FixtureGoals;
  };
  events: any[]; // TODO: Definir tipo mais específico para eventos
  // statistics: any[]; // TODO: Definir tipo mais específico para estatísticas
  // players: any[]; // TODO: Definir tipo mais específico para jogadores
}

export class DataIngestionService {
  private apiKey: string;
  private baseUrl: string = "https://v3.football.api-sports.io";
  private MAX_DAILY_REQUESTS: number = 100;
  private dailyRequestCount: number = 0;
  private lastRequestDate: string = "";
  // Removendo cache local, usando RedisCache global
  // private cache: Map<string, { data: any; timestamp: number }> = new Map();
  // private CACHE_TTL_MS: number = 5 * 60 * 1000; // 5 minutos de cache

  constructor() {
    this.apiKey = process.env.API_SPORTS_KEY || "";
    if (!this.apiKey) {
      console.warn("API_SPORTS_KEY não configurada. O DataIngestionService pode não funcionar.");
    }
    this.loadRequestCount();
    // Registrar Circuit Breaker para a API Football
    circuitBreakerPool.register({
      name: "FootballAPI",
      failureThreshold: 5, // 5 falhas antes de abrir o circuito
      successThreshold: 3, // 3 sucessos para fechar o circuito
      timeout: 60000, // 60 segundos de espera antes de tentar novamente
      resetTimeout: 300000, // 5 minutos para resetar contadores
    });
  }

  private loadRequestCount(): void {
    const today = new Date().toISOString().split("T")[0];
    if (this.lastRequestDate !== today) {
      this.dailyRequestCount = 0;
      this.lastRequestDate = today;
    }
  }

  public async getRequestCount(): Promise<number> {
    const today = new Date().toISOString().split("T")[0];
    const cacheKey = `dailyRequestCount-${today}`;
    const count = await getRedisCacheInstance().get<number>(cacheKey);
    return count || 0;
  }

  private async incrementRequestCount(): Promise<void> {
    const today = new Date().toISOString().split("T")[0];
    const cacheKey = `dailyRequestCount-${today}`;
    const currentCount = await this.getRequestCount();
    
    if (currentCount >= this.MAX_DAILY_REQUESTS) {
      throw new Error(`Limite diário de 100 requisições atingido (${currentCount}).`);
    }
    
    await getRedisCacheInstance().set(cacheKey, currentCount + 1, 86400); // Expira em 24h
  }

  // Métodos de cache movidos para RedisCache
  // private getFromCache<T>(key: string): T | null { ... }
  // private setToCache<T>(key: string, data: T): void { ... }

  /**
   * Coleta dados de um jogo e calcula métricas ajustadas (xG/xGA) com decaimento exponencial
   * @param matchId ID do jogo
   * @param refresh Força a atualização dos dados, ignorando o cache.
   */
  async ingest(matchId: string, refresh: boolean = false): Promise<IngestedData> {
    const cacheKey = getRedisCacheInstance().getMatchDataKey(matchId);
    if (!refresh) {
      const cachedData = await getRedisCacheInstance().get<IngestedData>(cacheKey);
      if (cachedData) {
        console.log(`[DataIngestionService] Retornando dados de ingestão para ${matchId} do cache Redis.`);
        return cachedData;
      }
    }

    try {
      // 1. Buscar detalhes do jogo (Ligas, Times, Árbitro) com Circuit Breaker
      const fixtureResponse: AxiosResponse<{ response: FixtureResponse[] }> = await circuitBreakerPool.get("FootballAPI")!.execute(async () => {
        await this.incrementRequestCount();
        return await axios.get(
          `${this.baseUrl}/fixtures?id=${matchId}`,
          { 
            headers: { "x-apisports-key": this.apiKey },
            timeout: 15000 // Timeout de 15s para evitar travamento na Vercel
          }
        );
      });

      if (!fixtureResponse.data || !fixtureResponse.data.response || fixtureResponse.data.response.length === 0) {
        throw new Error(`Fixture ${matchId} not found in API-Football response`);
      }
      const fixture = fixtureResponse.data.response[0];

      const leagueId = fixture.league.id.toString();
      const homeTeamId = fixture.teams.home.id;
      const awayTeamId = fixture.teams.away.id;

      // 2. Buscar histórico dos últimos 10 jogos para cada time (Janela Temporal Móvel)
      const [homeHistory, awayHistory] = await Promise.all([
        this.getTeamHistory(homeTeamId, 10, refresh),
        this.getTeamHistory(awayTeamId, 10, refresh),
      ]);

      // 4. Extrair Fatores Externos
      const externalFactors: ExternalFactors = {
        refereeStrictness: this.parseRefereeStrictness(fixture.fixture.referee || ""),
        weatherCondition: "CLEAR", // TODO: Implementar lógica real de clima
        motivationLevel: "NORMAL", // TODO: Implementar lógica real de motivação
        isDerby: false, // TODO: Implementar lógica real de derby
        expectedEdge: 0,
      };

      const result: IngestedData = {
        matchId,
        leagueId,
        homeHistory,
        awayHistory,
        externalFactors,
        fixture
      };
      await getRedisCacheInstance().cacheMatchData(matchId, result);
      return result;
    } catch (error: unknown) {
      if (error instanceof Error) {
        console.error("[DataIngestionService] Ingestion Error:", error.message);
        throw error;
      } else {
        console.error("[DataIngestionService] Unknown Ingestion Error:", error);
        throw new Error("An unknown error occurred during data ingestion.");
      }
    }
  }

  protected async getTeamHistory(teamId: number, limit: number, refresh: boolean = false): Promise<FixtureResponse[]> {
    const cacheKey = `teamHistory-${teamId}-${limit}`;
    if (!refresh) {
      const cachedHistory = await getRedisCacheInstance().get<FixtureResponse[]>(cacheKey);
      if (cachedHistory) {
        console.log(`[DataIngestionService] Retornando histórico do time ${teamId} do cache Redis.`);
        return cachedHistory;
      }
    }

    const response: AxiosResponse<{ response: FixtureResponse[] }> = await circuitBreakerPool.get("FootballAPI")!.execute(async () => {
      // Incrementa o contador APENAS se a requisição for realmente para a API externa
      await this.incrementRequestCount();
      return await axios.get(
        `${this.baseUrl}/fixtures?team=${teamId}&last=${limit}`,
        { headers: { "x-apisports-key": this.apiKey } }
      );
    }).catch(err => {
        console.error(`[DataIngestionService] Erro ao buscar histórico do time ${teamId}:`, err.message);
        throw err; // Rejeitar novamente para ser pego pelo catch superior
    });
    const history = response.data.response || [];
    await getRedisCacheInstance().set(cacheKey, history, 3600); // Cache por 1 hora
    return history;
  }

  /**
   * Argos v5.0: REMOVIDO LISTA FIXA DE LIGAS.
   * Agora o sistema descobre competições ativas via API de fixtures futuros.
   */
  public getPriorityLeagues(): LeagueProfile[] {
    // Retornar vazio ou uma lista mínima de "Seed" se necessário, 
    // mas o scheduler agora usará getFixturesAnyLeague para descoberta.
    return [];
  }

  /**
   * Busca jogos de uma liga específica para uma data
   * @param leagueId ID da liga
   * @param date Data dos jogos (YYYY-MM-DD)
   * @param refresh Força a atualização dos dados, ignorando o cache.
   */
  public async getFixtureDetails(matchId: string, refresh: boolean = false): Promise<FixtureResponse | null> {
    const cacheKey = `fixtureDetails-${matchId}`;
    if (!refresh) {
      const cachedFixture = await getRedisCacheInstance().get<FixtureResponse>(cacheKey);
      if (cachedFixture) {
        console.log(`[DataIngestionService] Retornando detalhes do jogo ${matchId} do cache Redis.`);
        return cachedFixture;
      }
    }

    try {
      const fixtureResponse: AxiosResponse<{ response: FixtureResponse[] }> = await circuitBreakerPool.get("FootballAPI")!.execute(async () => {
        await this.incrementRequestCount();
        return await axios.get(
          `${this.baseUrl}/fixtures?id=${matchId}`,
          { headers: { "x-apisports-key": this.apiKey } }
        );
      });

      const fixture = fixtureResponse.data.response[0];
      if (fixture) {
        await getRedisCacheInstance().set(cacheKey, fixture, 3600); // Cache por 1 hora
        return fixture;
      }
      return null;
    } catch (error: any) {
      console.error(`[DataIngestionService] Erro ao buscar detalhes do jogo ${matchId}:`, error.message);
      throw error;
    }
  }

  public async getFixturesAnyLeague(date: string, refresh: boolean = false): Promise<any[]> {
    const cacheKey = `fixturesAnyLeague-${date}`;
    if (!refresh) {
      const cachedFixtures = await getRedisCacheInstance().get<any[]>(cacheKey);
      if (cachedFixtures) {
        console.log(`[DataIngestionService] Retornando jogos de qualquer liga para ${date} do cache Redis.`);
        return cachedFixtures;
      }
    }

    try {
      const response: AxiosResponse<{ response: any[] }> = await circuitBreakerPool.get("FootballAPI")!.execute(async () => {
        await this.incrementRequestCount();
        return await axios.get(
          `${this.baseUrl}/fixtures?date=${date}`,
          { headers: { "x-apisports-key": this.apiKey } }
        );
      });
      const fixtures = response.data.response || [];
      await getRedisCacheInstance().set(cacheKey, fixtures, 3600); // Cache por 1 hora
      return fixtures;
    } catch (error: any) {
      console.error(`[DataIngestionService] Erro ao buscar jogos de qualquer liga para ${date}:`, error);
      return [];
    }
  }

  /**
   * Argos v5.0: Perfil de Liga Dinâmico.
   * Estima a qualidade da liga com base em dados históricos reais e metadados da competição.
   */
  public getLeagueProfile(leagueId: number, leagueName?: string): LeagueProfile {
    // Mapeamento dinâmico de Tier baseado em palavras-chave do nome da liga (Descoberta Automática)
    let tier: "Tier 1" | "Tier 2" | "Tier 3" | "Tier 4" = "Tier 3";
    let liquidity = 100000;

    if (leagueName) {
      const name = leagueName.toLowerCase();
      // Ligas Prioritárias (Tier 1)
      if (
        name.includes("champions league") ||
        name.includes("premier league") ||
        name.includes("la liga") ||
        name.includes("brasileirão serie a") ||
        name.includes("brasileirão serie b") ||
        name.includes("copa do brasil") ||
        name.includes("bundesliga") ||
        name.includes("libertadores") ||
        name.includes("world cup") ||
        name.includes("serie a")
      ) {
        tier = "Tier 1";
        liquidity = 1000000;
      } else if (name.includes("ligue 1") || name.includes("argentina") || name.includes("portugal")) {
        tier = "Tier 1";
        liquidity = 800000;
      } else if (name.includes("championship") || name.includes("eredivisie") || name.includes("copa sudamericana")) {
        tier = "Tier 2";
        liquidity = 400000;
      }

      // Excluir competições obscuras ou sem dados (Tier 4)
      if (
        name.includes("u19") ||
        name.includes("u20") ||
        name.includes("u21") ||
        name.includes("u23") ||
        name.includes("women") ||
        name.includes("youth") ||
        name.includes("reserve") ||
        name.includes("friendly") ||
        name.includes("exhibition")
      ) {
        tier = "Tier 4";
        liquidity = 0;
      }
    }

    // Argos v5.0: Dynamic League Profiling
    // Quando não existe dado ou a liga é desconhecida, usamos confiança baixa (0.35)
    // conforme regra fundamental do documento.
    const isUnknown = tier === "Tier 3" && !leagueName;

    return {
      id: leagueId,
      name: leagueName || `League ${leagueId}`,
      tier: tier,
      historicalLiquidity: liquidity,
      oddsDispersion: tier === "Tier 1" ? 2 : 5,
      avgGoals: 2.5,
      avgCorners: 9,
      avgCards: 4.5,
      historicalEVPlus: 0,
      confidenceScore: isUnknown ? 0.35 : 0.85, // Regra: Não fingir informação
    };
  }

  public async getFixturesByLeague(leagueId: number, date: string, refresh: boolean = false): Promise<FixtureResponse[]> {
    const cacheKey = `fixturesByLeague-${leagueId}-${date}`;
    if (!refresh) {
      const cachedFixtures = await getRedisCacheInstance().get<FixtureResponse[]>(cacheKey);
      if (cachedFixtures) {
        console.log(`[DataIngestionService] Retornando jogos da liga ${leagueId} para ${date} do cache Redis.`);
        return cachedFixtures;
      }
    }

    const response: AxiosResponse<{ response: FixtureResponse[] }> = await circuitBreakerPool.get("FootballAPI")!.execute(async () => {
      // Incrementa o contador APENAS se a requisição for realmente para a API externa
      await this.incrementRequestCount();
      return await axios.get(
        `${this.baseUrl}/fixtures?league=${leagueId}&date=${date}`,
        { headers: { "x-apisports-key": this.apiKey } }
      );
    });
    const fixtures = response.data.response || [];
    await getRedisCacheInstance().set(cacheKey, fixtures, 3600); // Cache por 1 hora
    return fixtures;
  }



  private parseRefereeStrictness(refereeName: string): number {
    if (!refereeName) return 1.0;
    // Lógica simples: nomes conhecidos por rigor podem ser mapeados aqui
    // Exemplo: if (refereeName.includes("Lahoz")) return 1.5; // Árbitro rigoroso
    return 1.0; // Valor padrão
  }
}
