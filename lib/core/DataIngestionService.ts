import axios from "axios";
import { getRedisCacheInstance } from "@/lib/core/RedisCache";
import { circuitBreakerPool } from "@/lib/core/CircuitBreaker";
import { LeagueProfile } from "@/lib/argos/ingestion/LeagueValueScoreEngine";
import { getSupabaseClient } from "@/lib/core/SupabaseClient";

// ============================================================
// DATA INGESTION SERVICE v5.3.3 — STATE OF THE ART (MEGA CALL)
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
  odds?: any;
  fairLine?: any;
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
  private requestsSpent: number = 0;

  constructor() {
    this.apiKey = process.env.PROPLINE_API_KEY || "";
    console.log('Versão do Argos: 5.3.3 - STATE OF THE ART');
  }

  public async getActiveSports(): Promise<any[]> {
    try {
      const url = `${this.baseUrl}/sports`;
      console.log(`[Argos-URL] Discovery: ${url}`);
      const response = await axios.get(url, { headers: { "X-API-Key": this.apiKey } });
      this.trackRequest();
      
      const rawSports = response.data || [];
      const activeSports = rawSports.filter((s: any) => s.active);
      const soccerSports = activeSports.filter((s: any) => s.key.includes("soccer"));
      
      console.log(`[Argos-Discovery] Horizonte de Eventos: ${rawSports.length} esportes totais encontrados.`);
      console.log(`[Argos-Discovery] Filtro Ativo: ${activeSports.length} esportes operacionais.`);
      console.log(`[Argos-Discovery] Foco Soccer: ${soccerSports.length} ligas/mercados de futebol em monitoramento.`);
      
      return activeSports;
    } catch (error: any) {
      console.error("[Argos-Budget] Discovery Error:", error.message);
      return [];
    }
  }

  public async checkFreshness(sportKey: string): Promise<boolean> {
    try {
      const url = `${this.baseUrl}/freshness?sport=${sportKey}`;
      const response = await axios.get(url, { headers: { "X-API-Key": this.apiKey } });
      this.trackRequest();
      return response.data?.changed || true; 
    } catch { return true; }
  }

  public async getMegaCallOdds(sportKey: string): Promise<any[]> {
    try {
      const markets = "h2h,totals,btts,corners,cards";
      const url = `${this.baseUrl}/sports/${sportKey}/events?markets=${markets}&include_bookmakers=true`;
      console.log(`[Argos-URL] Mega Call: ${url}`);
      const response = await axios.get(url, { headers: { "X-API-Key": this.apiKey }, timeout: 30000 });
      this.trackRequest();
      const events = response.data || [];
      const now = Math.floor(Date.now() / 1000);
      return events.filter((e: any) => (now - (e.last_update || now)) <= 300);
    } catch { return []; }
  }

  public calculateFairLine(event: any): any {
    if (!event.bookmakers) return null;
    const pinnacle = event.bookmakers.find((b: any) => b.key.toLowerCase() === 'pinnacle');
    return pinnacle ? { source: 'Pinnacle', odds: pinnacle.markets } : { source: 'Average', odds: event.bookmakers[0]?.markets };
  }

  private trackRequest() {
    this.requestsSpent++;
    console.log(`[Argos-Budget] Req Gastas: ${this.requestsSpent} | Restantes: ${1000 - this.requestsSpent}`);
  }

  async ingest(matchId: string): Promise<IngestedData> {
    const url = `${this.baseUrl}/events/${matchId}?markets=all&include_bookmakers=true`;
    console.log(`[Argos-URL] Single Ingest: ${url}`);
    
    try {
      const response = await axios.get(url, { headers: { "X-API-Key": this.apiKey } });
      this.trackRequest();
      const fixture = response.data;

      // Pré-Validação Temporal: Se o jogo já passou do tempo de corte, nem processamos
      const commenceTime = new Date(fixture.commence_time || fixture.fixture?.date).getTime();
      const now = Date.now();
      
      if (commenceTime < now - (10 * 60 * 1000)) { // 10 min de tolerância
        throw new Error("404 - Evento já iniciado ou expirado temporalmente.");
      }

      return {
        matchId,
        leagueId: (fixture.league?.id || "0").toString(),
        homeHistory: [],
        awayHistory: [],
        externalFactors: { refereeStrictness: 0.5, weatherCondition: "CLEAR", motivationLevel: "NORMAL", isDerby: false, expectedEdge: 0 },
        fixture
      };
    } catch (error: any) {
      if (error.response?.status === 404) {
        throw new Error("404 - Evento não encontrado na PropLine.");
      }
      throw error;
    }
  }

  public getLeagueProfile(leagueId: number, leagueName?: string): LeagueProfile {
    return { id: leagueId, name: leagueName || "Unknown", tier: "Tier 1", historicalLiquidity: 1000000, oddsDispersion: 0.5, avgGoals: 2.5, avgCorners: 9.5, avgCards: 4.5, historicalEVPlus: 0.05, confidenceScore: 0.8 };
  }
}
