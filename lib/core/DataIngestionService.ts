import axios from "axios";
import { getRedisCacheInstance } from "@/lib/core/RedisCache";
import { circuitBreakerPool } from "@/lib/core/CircuitBreaker";
import { LeagueProfile } from "@/lib/argos/ingestion/LeagueValueScoreEngine";
import { getSupabaseClient } from "@/lib/core/SupabaseClient";

// ============================================================
// DATA INGESTION SERVICE v5.5.0 — SINGLE-PASS ARCHITECTURE
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
  commence_time?: string;
  sport_key?: string;
  home_team?: string;
  away_team?: string;
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
    console.log('Versão do Argos: 5.5.0 - SINGLE-PASS ARCHITECTURE');
  }

  public async getActiveSports(): Promise<any[]> {
    try {
      const url = `${this.baseUrl}/sports`;
      console.log(`[Argos-Discovery] Buscando esportes ativos: ${url}`);
      const response = await axios.get(url, { headers: { "X-API-Key": this.apiKey } });
      this.trackRequest();
      const rawSports = response.data || [];
      const activeSports = rawSports.filter((s: any) => s.active && s.key.toLowerCase().includes('soccer'));
      
      console.log(`[Argos-Discovery] Encontrados ${activeSports.length} esportes ativos.`);
      return activeSports;
    } catch (error: any) {
      console.error("[Argos-Discovery] Erro ao buscar esportes:", error.message);
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

  /**
   * Mega Call 'All-In' (v5.5.0): Busca todos os mercados (all) de uma vez.
   * Elimina a necessidade de chamadas individuais subsequentes.
   */
  public async getMegaCallOdds(sportKey: string): Promise<any[]> {
    try {
      // Usamos markets=all para trazer o payload completo do evento
      const url = `${this.baseUrl}/sports/${sportKey}/events?markets=all&include_bookmakers=true`;
      console.log(`[Argos-URL] Mega Call All-In: ${url}`);
      const response = await axios.get(url, { headers: { "X-API-Key": this.apiKey }, timeout: 45000 });
      this.trackRequest();
      const events = response.data || [];
      const now = Math.floor(Date.now() / 1000);
      
      // Filtramos apenas dados atualizados nos últimos 5 minutos
      return events.filter((e: any) => (now - (e.last_update || now)) <= 300);
    } catch (error: any) {
      console.error(`[Argos-Budget] Erro na Mega Call All-In para ${sportKey}:`, error.message);
      return [];
    }
  }

  public calculateFairLine(event: any): any {
    if (!event.bookmakers || event.bookmakers.length === 0) return null;
    const pinnacle = event.bookmakers.find((b: any) => b.key.toLowerCase() === 'pinnacle');
    if (pinnacle) return { source: 'Pinnacle', odds: pinnacle.markets };
    const betfair = event.bookmakers.find((b: any) => b.key.toLowerCase() === 'betfair');
    if (betfair) return { source: 'Betfair', odds: betfair.markets };
    return { source: event.bookmakers[0].title || 'Generic', odds: event.bookmakers[0].markets };
  }

  private trackRequest() {
    this.requestsSpent++;
    console.log(`[Argos-Budget] Req Gastas: ${this.requestsSpent} | Restantes: ${1000 - this.requestsSpent}`);
  }

  /**
   * Persistência Atômica no Supabase.
   */
  public async saveMatchToDatabase(fixture: any): Promise<void> {
    try {
      const matchId = (fixture.id || fixture.fixture?.id || fixture.match_id).toString();
      const externalFixtureId = parseInt(matchId); 
      const leagueId = parseInt(fixture.league?.id || "0");
      const startTime = fixture.commence_time || fixture.fixture?.date;
      
      const matchPayload = {
        external_fixture_id: externalFixtureId,
        external_provider: "PROPLINE", 
        match_id: matchId,
        league_id: leagueId,
        sport_key: fixture.sport_key || "soccer",
        home_team: fixture.home_team || fixture.teams?.home?.name || "Unknown",
        away_team: fixture.away_team || fixture.teams?.away?.name || "Unknown",
        start_time: startTime,
        status: fixture.status?.short || fixture.fixture?.status?.short || "NS",
        raw_data: fixture, 
        updated_at: new Date().toISOString()
      };

      const { error } = await this.supabase
        .from("argos_matches")
        .upsert(matchPayload, { onConflict: "external_fixture_id" });

      if (error) throw error;
      console.log(`[Argos-Persistence] ✅ Match ${matchId} persistido.`);
    } catch (error: any) {
      console.error(`[Argos-Persistence] Falha ao salvar match:`, error.message);
    }
  }

  /**
   * Novo método ingestObject (v5.5.0): Processa o objeto completo sem nova chamada de API.
   * Elimina erros 404 e latência.
   */
  async ingestObject(fixture: any): Promise<IngestedData> {
    const matchId = (fixture.id || fixture.fixture?.id || fixture.match_id).toString();
    console.log(`[Argos-Ingest] Processando objeto direto para match ${matchId} (Single-Pass)`);
    
    try {
      const commenceTime = new Date(fixture.commence_time || fixture.fixture?.date).getTime();
      const now = Date.now();
      
      // Validação temporal básica
      if (commenceTime < now - (10 * 60 * 1000)) { 
        throw new Error("EXPIRED - Evento já iniciado.");
      }

      // Persistência imediata
      await this.saveMatchToDatabase(fixture);

      return {
        matchId,
        leagueId: (fixture.league?.id || "0").toString(),
        homeHistory: [],
        awayHistory: [],
        externalFactors: { refereeStrictness: 0.5, weatherCondition: "CLEAR", motivationLevel: "NORMAL", isDerby: false, expectedEdge: 0 },
        fixture
      };
    } catch (error: any) {
      console.error(`[Argos-Ingest] Erro no processamento Single-Pass para ${matchId}:`, error.message);
      throw error;
    }
  }

  /**
   * getCachedMatchData (v6.0.0): Busca o payload completo de uma partida já persistida
   * no banco de dados (argos_matches.raw_data). Usado como fallback para chamadas legadas
   * que chegam apenas com matchId, sem o payload completo da Mega Call.
   */
  public async getCachedMatchData(matchId: string): Promise<{ rawData: any } | null> {
    try {
      const { data, error } = await this.supabase
        .from("argos_matches")
        .select("raw_data")
        .eq("match_id", matchId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .single();

      if (error || !data?.raw_data) {
        console.warn(`[Argos-Cache] Nenhum dado em cache para match ${matchId}.`);
        return null;
      }

      console.log(`[Argos-Cache] ✅ Payload recuperado do banco para match ${matchId}.`);
      return { rawData: data.raw_data };
    } catch (error: any) {
      console.error(`[Argos-Cache] Erro ao buscar cache para ${matchId}:`, error.message);
      return null;
    }
  }

  // Mantido para compatibilidade, mas marcado como legado
  async ingest(matchId: string): Promise<IngestedData> {
    console.warn(`[Argos-Legacy] Chamada de ingest individual detectada para ${matchId}. Use ingestObject para Single-Pass.`);
    const url = `${this.baseUrl}/events/${matchId}?markets=all&include_bookmakers=true`;
    const response = await axios.get(url, { headers: { "X-API-Key": this.apiKey } });
    this.trackRequest();
    return this.ingestObject(response.data);
  }

  public getLeagueProfile(leagueId: number, leagueName?: string): LeagueProfile {
    return { id: leagueId, name: leagueName || "Unknown", tier: "Tier 1", historicalLiquidity: 1000000, oddsDispersion: 0.5, avgGoals: 2.5, avgCorners: 9.5, avgCards: 4.5, historicalEVPlus: 0.05, confidenceScore: 0.8 };
  }
}
