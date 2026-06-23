import axios from "axios";
import { getRedisCacheInstance } from "@/lib/core/RedisCache";
import { circuitBreakerPool } from "@/lib/core/CircuitBreaker";
import { LeagueProfile } from "@/lib/argos/ingestion/LeagueValueScoreEngine";
import { getSupabaseClient } from "@/lib/core/SupabaseClient";

// ============================================================
// DATA INGESTION SERVICE v5.2.1 — SYNDICATE HUNTER (FIXED)
// LOG DE VERSÃO: console.log('Versão do Argos: 5.2.1 - SYNDICATE HUNTER')
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
    periods: { first: number | null; second: number | null };
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
    console.log('Versão do Argos: 5.2.1 - SYNDICATE HUNTER');
    
    circuitBreakerPool.register({
      name: "PropLineAPI",
      failureThreshold: 5,
      successThreshold: 3,
      timeout: 60000,
      resetTimeout: 300000,
    });
  }

  public async getActiveSports(): Promise<any[]> {
    const cacheKey = "propline-active-sports";
    const cached = await getRedisCacheInstance().get<any[]>(cacheKey);
    if (cached) return cached;

    try {
      const url = `${this.baseUrl}/sports`;
      console.log(`[PropLine-URL] EXECUTANDO DISCOVERY EM: ${url}`);
      const response = await axios.get(url, {
        headers: { "X-API-Key": this.apiKey }
      });
      const sports = response.data || [];
      await getRedisCacheInstance().set(cacheKey, sports, 3600);
      return sports;
    } catch (error: any) {
      console.error("[PropLine] Discovery Error:", error.message);
      return [];
    }
  }

  public async getEventsBySport(sportKey: string): Promise<any[]> {
    const cacheKey = `events-${sportKey}`;
    const cached = await getRedisCacheInstance().get<any[]>(cacheKey);
    if (cached) return cached;

    try {
      const url = `${this.baseUrl}/sports/${sportKey}/events`;
      console.log(`[PropLine-URL] EXECUTANDO FETCH EM: ${url}`);
      
      const response = await axios.get(url, {
        headers: { "X-API-Key": this.apiKey },
        timeout: 20000
      });
      
      const events = response.data || [];
      await getRedisCacheInstance().set(cacheKey, events, 600);
      return events;
    } catch (error: any) {
      console.error(`[PropLine] Events Fetch Error (${sportKey}):`, error.message);
      return [];
    }
  }

  async ingest(matchId: string, refresh: boolean = false): Promise<IngestedData> {
    try {
      const url = `${this.baseUrl}/events/${matchId}`;
      console.log(`[PropLine-URL] EXECUTANDO INGEST EM: ${url}`);
      
      const fixtureResponse = await circuitBreakerPool.get("PropLineAPI")!.execute(async () => {
        return await axios.get(url, { 
          headers: { "X-API-Key": this.apiKey },
          timeout: 15000
        });
      });

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
        externalFactors: { refereeStrictness: 0.5, weatherCondition: "CLEAR", motivationLevel: "NORMAL", isDerby: false, expectedEdge: 0 },
        fixture
      };

      await this.supabase.from("argos_context_facts").upsert({ match_id: matchId, content: JSON.stringify(result), fact_type: "ingested_data" });
      return result;
    } catch (error: any) {
      console.error("[DataIngestionService] Ingest Error:", error.message);
      throw error;
    }
  }

  protected async getTeamHistory(teamId: number, limit: number, refresh: boolean = false): Promise<FixtureResponse[]> {
    try {
      const url = `${this.baseUrl}/events/${teamId}/history`;
      const response = await axios.get(url, { headers: { "X-API-Key": this.apiKey } });
      return response.data || [];
    } catch { return []; }
  }

  public getLeagueProfile(leagueId: number, leagueName?: string): LeagueProfile {
    let tier: "Tier 1" | "Tier 2" | "Tier 3" | "Tier 4" = "Tier 3";
    if (leagueName) {
      const name = leagueName.toLowerCase();
      if (name.includes("champions league") || name.includes("premier league") || name.includes("world cup") || name.includes("brasileirão") || name.includes("libertadores") || name.includes("euro") || name.includes("bundesliga") || name.includes("la liga")) tier = "Tier 1";
      else if (name.includes("serie b") || name.includes("paulista") || name.includes("carioca")) tier = "Tier 2";
    }
    return { id: leagueId, name: leagueName || "Unknown", tier, historicalLiquidity: tier === "Tier 1" ? 1000000 : 100000, oddsDispersion: 0.5, avgGoals: 2.5, avgCorners: 9.5, avgCards: 4.5, historicalEVPlus: 0.05, confidenceScore: 0.8 };
  }
}
