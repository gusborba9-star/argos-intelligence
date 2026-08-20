import axios from "axios";
import { getRedisCacheInstance } from "@/lib/core/RedisCache";
import { circuitBreakerPool } from "@/lib/core/CircuitBreaker";
import { LeagueProfile } from "@/lib/argos/ingestion/LeagueValueScoreEngine";
import { getSupabaseClient } from "@/lib/core/SupabaseClient";
import { normalizeTeamName } from "@/lib/core/normalizeTeamName";

// ============================================================
// DATA INGESTION SERVICE v5.6.1 — SINGLE-PASS ARCHITECTURE
// ============================================================

export interface AdjustedMetrics { goals: number; goalsHT: number; corners: number; cards: number; shots: number; shotsOnTarget: number; }
export interface ExternalFactors { refereeStrictness: number; weatherCondition: "CLEAR" | "RAIN" | "EXTREME_HEAT"; motivationLevel: "NORMAL" | "HIGH" | "LOW"; isDerby: boolean; expectedEdge: number; }
export interface FixtureResponse {
  fixture: { id: number; referee: string | null; timezone: string; date: string; timestamp: number; status: { long: string; short: string; elapsed: number | null } };
  league: { id: number; name: string; country: string; logo: string; flag: string; season: number; round: string };
  teams: { home: { id: number; name: string; logo: string; winner: boolean | null }; away: { id: number; name: string; logo: string; winner: boolean | null } };
  goals: { home: number | null; away: number | null };
  score: { halftime: { home: number | null; away: number | null }; fulltime: { home: number | null; away: number | null }; extratime: { home: number | null; away: number | null }; penalty: { home: number | null; away: number | null } };
  odds?: any; fairLine?: any; commence_time?: string; sport_key?: string; home_team?: string; away_team?: string;
}
export interface IngestedData { matchId: string; leagueId: string; homeHistory: FixtureResponse[]; awayHistory: FixtureResponse[]; externalFactors: ExternalFactors; fixture: FixtureResponse; }
export interface FreshnessResult { changed: boolean; known: boolean; checkedAt: string; reason: "CHANGED" | "UNCHANGED" | "UNKNOWN" | "ERROR"; }

export class DataIngestionService {
  private apiKey: string;
  private baseUrl = "https://api.prop-line.com/v1";
  private supabase = getSupabaseClient();
  private requestsSpent = 0;
  public static readonly ANALYSIS_HORIZON_MS = 48 * 60 * 60 * 1000;
  public static readonly MAX_CACHED_PAYLOAD_AGE_MS = 15 * 60 * 1000;

  constructor() {
    this.apiKey = process.env.PROPLINE_API_KEY || "";
    console.log("Versão do Argos: 5.6.1 - SINGLE-PASS / 48H EVIDENCE WINDOW / FRESHNESS GATE");
  }

  public async getActiveSports(): Promise<any[]> {
    try {
      const url = `${this.baseUrl}/sports?apiKey=${this.apiKey}`;
      const response = await axios.get(url, { timeout: 8000 });
      this.trackRequest();
      return (response.data || []).filter((s: any) => s.active && s.key.toLowerCase().includes("soccer"));
    } catch (error: any) {
      console.error("[Argos-Discovery] Erro ao buscar esportes:", error.message);
      return [];
    }
  }

  public async getFreshness(sportKey: string): Promise<FreshnessResult> {
    const checkedAt = new Date().toISOString();
    try {
      const url = `${this.baseUrl}/freshness?sport=${sportKey}&apiKey=${this.apiKey}`;
      const response = await axios.get(url, { timeout: 6000 });
      this.trackRequest();
      const changed = response.data?.changed;
      if (typeof changed !== "boolean") return { changed: false, known: false, checkedAt, reason: "UNKNOWN" };
      return { changed, known: true, checkedAt, reason: changed ? "CHANGED" : "UNCHANGED" };
    } catch (error: any) {
      console.warn(`[Argos-Freshness] ${sportKey}: provider freshness unavailable: ${error?.message || "unknown error"}`);
      return { changed: false, known: false, checkedAt, reason: "ERROR" };
    }
  }

  public async checkFreshness(sportKey: string): Promise<boolean> {
    const result = await this.getFreshness(sportKey);
    return result.known && result.changed;
  }

  private readonly SOCCER_MARKETS = ["h2h", "spreads", "totals", "both_teams_to_score", "total_corners", "total_cards"].join(",");

  public async getMegaCallOdds(sportKey: string): Promise<any[]> {
    try {
      const url = `${this.baseUrl}/sports/${sportKey}/odds?markets=${this.SOCCER_MARKETS}&apiKey=${this.apiKey}`;
      const response = await axios.get(url, { timeout: 12000 });
      this.trackRequest();
      const events = Array.isArray(response.data) ? response.data : [];
      const now = Date.now();
      const horizon = now + DataIngestionService.ANALYSIS_HORIZON_MS;
      const filtered = events.filter((e: any) => {
        const kickoff = new Date(e.commence_time).getTime();
        const hasOdds = Array.isArray(e.bookmakers) && e.bookmakers.length > 0;
        return Number.isFinite(kickoff) && kickoff > now && kickoff <= horizon && hasOdds;
      });
      console.log(`[Argos-Budget] ${sportKey}: ${events.length} total → ${filtered.length} com odds na janela canônica de 48h`);
      return filtered;
    } catch (error: any) {
      console.error(`[Argos-Budget] Erro na Mega Call All-In para ${sportKey}:`, error.message);
      return [];
    }
  }

  public calculateFairLine(event: any): any {
    if (!event.bookmakers || event.bookmakers.length === 0) return null;
    const pinnacle = event.bookmakers.find((b: any) => b.key.toLowerCase() === "pinnacle");
    if (pinnacle) return { source: "Pinnacle", odds: pinnacle.markets };
    const betfair = event.bookmakers.find((b: any) => b.key.toLowerCase() === "betfair");
    if (betfair) return { source: "Betfair", odds: betfair.markets };
    return { source: event.bookmakers[0].title || "Generic", odds: event.bookmakers[0].markets };
  }

  private trackRequest() { this.requestsSpent++; console.log(`[Argos-Budget] Req Gastas: ${this.requestsSpent} | Restantes: ${1000 - this.requestsSpent}`); }

  public async saveMatchToDatabase(fixture: any): Promise<void> {
    const matchId = (fixture.id || fixture.fixture?.id || fixture.match_id)?.toString();
    if (!matchId) throw new Error("INVALID_MATCH_ID - Payload sem identificador de partida.");
    const externalFixtureId = Number.parseInt(matchId, 10);
    if (!Number.isFinite(externalFixtureId)) throw new Error(`INVALID_MATCH_ID - ${matchId}`);
    const startTime = fixture.commence_time || fixture.fixture?.date;
    const kickoffMs = new Date(startTime).getTime();
    if (!Number.isFinite(kickoffMs)) throw new Error(`INVALID_KICKOFF - ${matchId}`);
    const matchPayload = {
      external_fixture_id: externalFixtureId,
      external_provider: "PROPLINE",
      match_id: matchId,
      league_id: Number.parseInt(fixture.league?.id || "0", 10),
      home_team: fixture.home_team || fixture.teams?.home?.name || "Unknown",
      away_team: fixture.away_team || fixture.teams?.away?.name || "Unknown",
      kickoff_at: startTime,
      status: fixture.status?.short || fixture.fixture?.status?.short || "NS",
      raw_data: fixture,
      updated_at: new Date().toISOString(),
    };
    const { error } = await this.supabase.from("argos_matches").upsert(matchPayload, { onConflict: "external_fixture_id" });
    if (error) throw error;
    console.log(`[Argos-Persistence] Match ${matchId} persistido com payload fresco.`);
  }

  async ingestObject(fixture: any): Promise<IngestedData> {
    const matchId = (fixture.id || fixture.fixture?.id || fixture.match_id)?.toString();
    if (!matchId) throw new Error("INVALID_MATCH_ID - Payload sem identificador de partida.");
    const commenceTime = new Date(fixture.commence_time || fixture.fixture?.date).getTime();
    const now = Date.now();
    if (!Number.isFinite(commenceTime)) throw new Error("INVALID_KICKOFF - Evento sem horário válido.");
    if (commenceTime <= now) throw new Error("EXPIRED - Evento já iniciado.");
    if (commenceTime > now + DataIngestionService.ANALYSIS_HORIZON_MS) throw new Error("OUTSIDE_ANALYSIS_HORIZON - Evento fora da janela canônica de 48h.");
    await this.saveMatchToDatabase(fixture);
    return { matchId, leagueId: (fixture.league?.id || "0").toString(), homeHistory: [], awayHistory: [], externalFactors: { refereeStrictness: 0.5, weatherCondition: "CLEAR", motivationLevel: "NORMAL", isDerby: false, expectedEdge: 0 }, fixture };
  }

  public async getCachedMatchData(matchId: string): Promise<{ rawData: any } | null> {
    try {
      const { data, error } = await this.supabase.from("argos_matches").select("raw_data, kickoff_at, updated_at").eq("match_id", matchId).order("updated_at", { ascending: false }).limit(1).single();
      if (error || !data?.raw_data) return null;
      const kickoffMs = new Date(data.kickoff_at).getTime();
      const updatedMs = new Date(data.updated_at).getTime();
      const now = Date.now();
      const freshEnough = Number.isFinite(updatedMs) && now - updatedMs <= DataIngestionService.MAX_CACHED_PAYLOAD_AGE_MS;
      const withinHorizon = Number.isFinite(kickoffMs) && kickoffMs > now && kickoffMs <= now + DataIngestionService.ANALYSIS_HORIZON_MS;
      if (!freshEnough || !withinHorizon) {
        console.warn(`[Argos-Cache] Payload ${matchId} rejeitado: ${!freshEnough ? "STALE_PAYLOAD" : "OUTSIDE_ANALYSIS_HORIZON"}.`);
        return null;
      }
      return { rawData: data.raw_data };
    } catch (error: any) {
      console.error(`[Argos-Cache] Erro ao buscar cache para ${matchId}:`, error.message);
      return null;
    }
  }

  async ingest(matchId: string): Promise<IngestedData> {
    console.warn(`[Argos-Legacy] Chamada de ingest individual detectada para ${matchId}. Use ingestObject para Single-Pass.`);
    const url = `${this.baseUrl}/sports/soccer/events/${matchId}/odds?markets=h2h,spreads,totals,both_teams_to_score,total_corners,total_cards&apiKey=${this.apiKey}`;
    const response = await axios.get(url, { timeout: 30000 });
    this.trackRequest();
    return this.ingestObject(response.data);
  }

  public getLeagueProfile(leagueId: number, leagueName?: string): LeagueProfile { return { id: leagueId, name: leagueName || "Unknown", tier: "Tier 1", historicalLiquidity: 1000000, oddsDispersion: 0.5, avgGoals: 2.5, avgCorners: 9.5, avgCards: 4.5, historicalEVPlus: 0.05, confidenceScore: 0.8 }; }

  public async updateTeamFormFromScores(sportKey: string, daysFrom: number = 3): Promise<number> {
    try {
      const url = `${this.baseUrl}/sports/${sportKey}/scores?daysFrom=${daysFrom}&apiKey=${this.apiKey}`;
      const response = await axios.get(url, { timeout: 10000 }); this.trackRequest(); const events = response.data || [];
      let updated = 0;
      for (const ev of events) {
        if (ev.status !== "final" || ev.home_score === null || ev.home_score === undefined || ev.away_score === null || ev.away_score === undefined) continue;
        const homeGoals = parseInt(ev.home_score, 10), awayGoals = parseInt(ev.away_score, 10);
        if (isNaN(homeGoals) || isNaN(awayGoals)) continue;
        const eventId = String(ev.id ?? `${ev.home_team}_${ev.away_team}_${ev.commence_time}`);
        const { error: insertError } = await this.supabase.from("argos_processed_score_events").insert({ sport_key: sportKey, event_id: eventId });
        if (insertError) continue;
        await this.pushTeamResult(sportKey, ev.home_team, homeGoals, awayGoals); await this.pushTeamResult(sportKey, ev.away_team, awayGoals, homeGoals); updated++;
      }
      return updated;
    } catch (error: any) { console.error(`[Argos-TeamForm] Erro ao buscar scores de ${sportKey}:`, error.message); return 0; }
  }

  public async pushTeamResult(sportKey: string, teamName: string, goalsFor: number, goalsAgainst: number): Promise<void> {
    const canonicalName = normalizeTeamName(teamName); if (!canonicalName) return;
    const { data: existing } = await this.supabase.from("argos_team_form").select("recent_goals_for, recent_goals_against, sample_size").eq("sport_key", sportKey).eq("team_name", canonicalName).maybeSingle();
    const MAX_HISTORY = 10;
    const forArr = [goalsFor, ...(existing?.recent_goals_for || [])].slice(0, MAX_HISTORY); const againstArr = [goalsAgainst, ...(existing?.recent_goals_against || [])].slice(0, MAX_HISTORY);
    await this.supabase.from("argos_team_form").upsert({ sport_key: sportKey, team_name: canonicalName, recent_goals_for: forArr, recent_goals_against: againstArr, sample_size: forArr.length, updated_at: new Date().toISOString() }, { onConflict: "sport_key,team_name" });
  }

  public async getRealTeamHistory(sportKey: string, teamName: string): Promise<{ goals: { home: number; away: number } }[]> {
    const canonicalName = normalizeTeamName(teamName); const { data } = await this.supabase.from("argos_team_form").select("recent_goals_for, recent_goals_against").eq("sport_key", sportKey).eq("team_name", canonicalName).maybeSingle();
    if (!data || !data.recent_goals_for?.length) return [];
    return data.recent_goals_for.map((gf: number, i: number) => ({ goals: { home: gf, away: data.recent_goals_against[i] ?? 0 } }));
  }

  public async getTeamExtraStats(sportKey: string, teamName: string): Promise<{ cornersFor: number; cornersAgainst: number; cardsFor: number; cardsAgainst: number; shotsFor: number; shotsAgainst: number; sampleSize: number } | null> {
    const canonicalName = normalizeTeamName(teamName); const { data } = await this.supabase.from("argos_team_form").select("recent_corners_for, recent_corners_against, recent_cards_for, recent_cards_against, recent_shots_for, recent_shots_against").eq("sport_key", sportKey).eq("team_name", canonicalName).maybeSingle();
    if (!data || !data.recent_corners_for?.length) return null;
    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    return { cornersFor: avg(data.recent_corners_for), cornersAgainst: avg(data.recent_corners_against), cardsFor: avg(data.recent_cards_for), cardsAgainst: avg(data.recent_cards_against), shotsFor: avg(data.recent_shots_for), shotsAgainst: avg(data.recent_shots_against), sampleSize: data.recent_corners_for.length };
  }
}
