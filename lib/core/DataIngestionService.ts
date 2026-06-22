import axios from "axios";
import { getRedisCacheInstance } from "@/lib/core/RedisCache";
import { circuitBreakerPool } from "@/lib/core/CircuitBreaker";
import { LeagueProfile } from "@/lib/argos/ingestion/LeagueValueScoreEngine";
import { getSupabaseClient } from "@/lib/core/SupabaseClient";

// ============================================================
// DATA INGESTION SERVICE v5.1 — SYNDICATE BRAIN (DATABASE-FIRST)
// Implementa a lógica de "Cérebro" do Argos: 
// 1. Consulta Banco de Dados (Supabase) 
// 2. Consulta Cache (Redis)
// 3. Consulta API (PropLine) apenas se necessário
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
    venue: { id: number; name: string; city: string };
    status: { long: string; short: string; elapsed: number | null };
  };
  league: { id: number; name: string; country: string; logo: string; flag: string; season: number; round: string };
  teams: {
    home: { id: number; name: string; logo: string; winner: boolean | null };
    away: { id: number; name: string; logo: string; winner: boolean | null };
  };
  goals: { home: number | null; away: number | null };
  score: {
    halftime: { home: number | null; away: number | null };
    fulltime: { home: number | null; away: number | null };
    extratime: { home: number | null; away: number | null };
    penalty: { home: number | null; away: number | null };
  };
  events: any[];
}

export interface IngestedData {
  matchId: string;
  leagueId: string;
  homeHistory: FixtureResponse[];
  awayHistory: FixtureResponse[];
  externalFactors: ExternalFactors;
  fixture: FixtureResponse;
}

export class DataIngestionService {
  private apiKey: string;
  private baseUrl: string = "https://api.prop-line.com/v1";
  private supabase = getSupabaseClient();

  constructor() {
    this.apiKey = process.env.PROPLINE_API_KEY || "";
    
    circuitBreakerPool.register({
      name: "PropLineAPI",
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 60000,
      resetTimeout: 300000,
    });
  }

  async ingest(matchId: string, refresh: boolean = false): Promise<IngestedData> {
    if (!refresh) {
      const { data: dbData } = await this.supabase
        .from("argos_context_facts")
        .select("content")
        .eq("match_id", matchId)
        .eq("fact_type", "ingested_data")
        .maybeSingle();

      if (dbData && dbData.content) {
        return JSON.parse(dbData.content);
      }
    }

    const cacheKey = getRedisCacheInstance().getMatchDataKey(matchId);
    if (!refresh) {
      const cachedData = await getRedisCacheInstance().get<IngestedData>(cacheKey);
      if (cachedData) return cachedData;
    }

    try {
      const fixtureResponse = await circuitBreakerPool.get("PropLineAPI")!.execute(async () => {
        return await axios.get(`${this.baseUrl}/events/${matchId}`, { 
          headers: { "X-API-Key": this.apiKey },
          timeout: 15000
        });
      });

      if (!fixtureResponse.data) throw new Error(`Fixture ${matchId} não encontrado.`);
      const fixture = fixtureResponse.data;

      const [homeHistory, awayHistory] = await Promise.all([
        this.getTeamHistory(fixture.teams.home.id, 10, refresh),
        this.getTeamHistory(fixture.teams.away.id, 10, refresh),
      ]);

      const result: IngestedData = {
        matchId,
        leagueId: fixture.league.id.toString(),
        homeHistory,
        awayHistory,
        externalFactors: {
          refereeStrictness: 0.5,
          weatherCondition: "CLEAR",
          motivationLevel: "NORMAL",
          isDerby: false,
          expectedEdge: 0,
        },
        fixture
      };

      await this.supabase.from("argos_context_facts").upsert({
        match_id: matchId,
        content: JSON.stringify(result),
        fact_type: "ingested_data"
      });

      await getRedisCacheInstance().cacheMatchData(matchId, result);
      return result;
    } catch (error: any) {
      console.error("[DataIngestionService] Erro na ingestão:", error.message);
      throw error;
    }
  }

  protected async getTeamHistory(teamId: number, limit: number, refresh: boolean = false): Promise<FixtureResponse[]> {
    const cacheKey = `teamHistory-${teamId}-${limit}`;
    if (!refresh) {
      const cached = await getRedisCacheInstance().get<FixtureResponse[]>(cacheKey);
      if (cached) return cached;
    }

    try {
      const response = await axios.get(`${this.baseUrl}/events/${teamId}/history`, {
        headers: { "X-API-Key": this.apiKey }
      });
      const history = response.data || [];
      await getRedisCacheInstance().set(cacheKey, history, 3600);
      return history;
    } catch {
      return [];
    }
  }

  public async getFixturesAnyLeague(sportKey: string, date: string, refresh: boolean = false): Promise<any[]> {
    const cacheKey = `fixtures-${sportKey}-${date}`;
    if (!refresh) {
      const cached = await getRedisCacheInstance().get<any[]>(cacheKey);
      if (cached) return cached;
    }
    
    try {
      const response = await axios.get(`${this.baseUrl}/sports/${sportKey}/events`, { 
        headers: { "X-API-Key": this.apiKey }
      });
      const allEvents = response.data || [];
      const filtered = allEvents.filter((event: any) => event.commence_time && event.commence_time.startsWith(date));
      await getRedisCacheInstance().set(cacheKey, filtered, 3600);
      return filtered;
    } catch {
      return [];
    }
  }

  public getLeagueProfile(leagueId: number, leagueName?: string): LeagueProfile {
    let tier: "Tier 1" | "Tier 2" | "Tier 3" | "Tier 4" = "Tier 3";
    if (leagueName) {
      const name = leagueName.toLowerCase();
      if (name.includes("champions league") || name.includes("premier league") || name.includes("world cup") || name.includes("brasileirão") || name.includes("libertadores") || name.includes("euro")) {
        tier = "Tier 1";
      } else if (name.includes("serie b") || name.includes("paulista") || name.includes("carioca")) {
        tier = "Tier 2";
      }
      if (name.includes("u19") || name.includes("u20") || name.includes("women") || name.includes("youth") || name.includes("friendly")) {
        tier = "Tier 4";
      }
    }
    
    return {
      id: leagueId,
      name: leagueName || "Unknown",
      tier,
      historicalLiquidity: tier === "Tier 1" ? 1000000 : 100000,
      oddsDispersion: 0.5,
      avgGoals: 2.5,
      avgCorners: 9.5,
      avgCards: 4.5,
      historicalEVPlus: 0.05,
      confidenceScore: 0.8
    };
  }
}
