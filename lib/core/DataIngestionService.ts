import axios, { AxiosResponse } from "axios";
import { getRedisCacheInstance } from "@/lib/core/RedisCache";
import { circuitBreakerPool } from "@/lib/core/CircuitBreaker";

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
}

export interface IngestedData {
  matchId: string;
  leagueId: string;
  home: AdjustedMetrics;
  away: AdjustedMetrics;
  externalFactors: ExternalFactors;
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

interface FixtureResponse {
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

  private async incrementRequestCount(): Promise<void> {
    this.loadRequestCount();
    if (this.dailyRequestCount >= this.MAX_DAILY_REQUESTS) {
      throw new Error("Limite diário de requisições da API Football atingido (100/dia).");
    }
    this.dailyRequestCount++;
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
        // Incrementa o contador APENAS se a requisição for realmente para a API externa
        await this.incrementRequestCount();
        return await axios.get(
          `${this.baseUrl}/fixtures?id=${matchId}`,
          { headers: { "x-apisports-key": this.apiKey } }
        );
      });

      const fixture = fixtureResponse.data.response[0];
      if (!fixture) {
        throw new Error(`Fixture ${matchId} not found`);
      }

      const leagueId = fixture.league.id.toString();
      const homeTeamId = fixture.teams.home.id;
      const awayTeamId = fixture.teams.away.id;

      // 2. Buscar histórico dos últimos 10 jogos para cada time (Janela Temporal Móvel)
      const [homeHistory, awayHistory] = await Promise.all([
        this.getTeamHistory(homeTeamId, 10, refresh),
        this.getTeamHistory(awayTeamId, 10, refresh),
      ]);

      // 3. Calcular Médias Ajustadas com Decaimento Exponencial
      const homeMetrics = this.calculateExponentialAverages(homeHistory);
      const awayMetrics = this.calculateExponentialAverages(awayHistory);

      // 4. Extrair Fatores Externos
      const externalFactors: ExternalFactors = {
        refereeStrictness: this.parseRefereeStrictness(fixture.fixture.referee || ""),
        weatherCondition: "CLEAR", // TODO: Implementar lógica real de clima
        motivationLevel: "NORMAL", // TODO: Implementar lógica real de motivação
        isDerby: false, // TODO: Implementar lógica real de derby
      };

      const result: IngestedData = {
        matchId,
        leagueId,
        home: homeMetrics,
        away: awayMetrics,
        externalFactors,
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
   * Retorna a lista de ligas prioritárias (Elite)
   */
  public getPriorityLeagues(): { id: number; name: string }[] {
    // Lista de ligas prioritárias expandida para incluir mais opções
    return [
      { id: 71, name: "Brasileirão Série A" },
      { id: 72, name: "Brasileirão Série B" },
      { id: 2, name: "Champions League" },
      { id: 39, name: "Premier League" },
      { id: 78, name: "Bundesliga" },
      { id: 140, name: "La Liga" },
      { id: 135, name: "Serie A" },
      { id: 61, name: "Ligue 1" },
      { id: 307, name: "Saudi Pro League" },
      { id: 128, name: "Liga Argentina" },
      { id: 4, name: "Copa Libertadores" },
      { id: 11, name: "Copa Sudamericana" },
      { id: 1, name: "World Cup" },
      { id: 3, name: "Euro Championship" },
      { id: 5, name: "Copa America" },
      { id: 848, name: "USL League Two" },
      { id: 849, name: "Division di Honor" }
    ];
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

  /**
   * Aplica Fator de Decaimento Exponencial: Jogos recentes têm peso maior
   * Fórmula: Peso = alpha * (1 - alpha)^n, onde n é a distância do jogo atual
   */
  private calculateExponentialAverages(history: FixtureResponse[]): AdjustedMetrics {
    const alpha = 0.3; // Fator de decaimento (30% de peso para o mais recente)
    let totalWeight = 0;

    const sums = { goals: 0, goalsHT: 0, corners: 0, cards: 0, shots: 0, shotsOnTarget: 0 };

    if (!history || history.length === 0) {
      console.warn("[DataIngestionService] Histórico vazio para cálculo de médias. Retornando valores padrão.");
      return { goals: 1.5, goalsHT: 0.5, corners: 5, cards: 2, shots: 12, shotsOnTarget: 5 };
    }

    history.forEach((match, index) => {
      const weight = Math.pow(1 - alpha, index);
      totalWeight += weight;

      // Usar os gols reais do jogo, se disponíveis
      const homeGoals = typeof match.goals.home === 'number' ? match.goals.home : 0;
      const awayGoals = typeof match.goals.away === 'number' ? match.goals.away : 0;
      sums.goals += (homeGoals + awayGoals) * weight;

      const homeGoalsHT = typeof match.score.halftime.home === 'number' ? match.score.halftime.home : 0;
      const awayGoalsHT = typeof match.score.halftime.away === 'number' ? match.score.halftime.away : 0;
      sums.goalsHT += (homeGoalsHT + awayGoalsHT) * weight;

      // TODO: Substituir simulações por dados reais de estatísticas (corners, cards, shots, shotsOnTarget)
      sums.corners += 5 * weight; 
      sums.cards += 2 * weight; 
      sums.shots += 12 * weight; 
      sums.shotsOnTarget += 5 * weight; 
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

  private parseRefereeStrictness(refereeName: string): number {
    if (!refereeName) return 1.0;
    // Lógica simples: nomes conhecidos por rigor podem ser mapeados aqui
    // Exemplo: if (refereeName.includes("Lahoz")) return 1.5; // Árbitro rigoroso
    return 1.0; // Valor padrão
  }
}
