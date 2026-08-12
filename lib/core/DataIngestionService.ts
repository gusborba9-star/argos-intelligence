import axios from "axios";
import { getRedisCacheInstance } from "@/lib/core/RedisCache";
import { circuitBreakerPool } from "@/lib/core/CircuitBreaker";
import { LeagueProfile } from "@/lib/argos/ingestion/LeagueValueScoreEngine";
import { getSupabaseClient } from "@/lib/core/SupabaseClient";
import { normalizeTeamName } from "@/lib/core/normalizeTeamName";

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
      const url = `${this.baseUrl}/sports?apiKey=${this.apiKey}`;
      console.log(`[Argos-Discovery] Buscando esportes ativos: ${url.replace(this.apiKey, '***')}`);
      const response = await axios.get(url, { timeout: 8000 });
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
      const url = `${this.baseUrl}/freshness?sport=${sportKey}&apiKey=${this.apiKey}`;
      const response = await axios.get(url, { timeout: 6000 });
      this.trackRequest();
      return response.data?.changed || true; 
    } catch { return true; }
  }

  // Market keys oficiais da PropLine para soccer (validados em 2026-07-02)
  // Fonte: https://prop-line.com/docs#markets
  private readonly SOCCER_MARKETS = [
    "h2h",                  // Winner / 1X2
    "spreads",              // Handicap / Asian Handicap
    "totals",               // Over/Under Gols (múltiplas linhas)
    "both_teams_to_score",  // BTTS
    "total_corners",        // Escanteios
    "total_cards",          // Cartões
  ].join(",");

  /**
   * Mega Call 'All-In' v5.5.1 — ENDPOINT CORRIGIDO (auditoria CTO 2026-07-02).
   *
   * PROBLEMA ANTERIOR: /sports/{sport}/events?markets=all
   *   → bookmakers=null em TODOS os eventos
   *   → ZERO odds chegavam ao MarketNormalizer
   *
   * CORREÇÃO: /sports/{sport}/odds?markets=h2h,spreads,totals,...
   *   → bookmakers preenchidos com odds reais de múltiplas casas
   *   → Todos os mercados de futebol disponíveis
   *
   * Nenhuma Engine, threshold ou regra de Edge foi alterada.
   */
  public async getMegaCallOdds(sportKey: string): Promise<any[]> {
    try {
      // CORRIGIDO: usa /odds em vez de /events?markets=all
      const url = `${this.baseUrl}/sports/${sportKey}/odds?markets=${this.SOCCER_MARKETS}&apiKey=${this.apiKey}`;
      console.log(`[Argos-URL] Mega Call All-In v5.5.1 (endpoint corrigido): ${url.replace(this.apiKey, '***')}`);
      const response = await axios.get(url, { timeout: 12000 });
      this.trackRequest();
      const events = response.data || [];
      const now = Date.now();

      // Filtra apenas eventos futuros com odds reais (bookmakers preenchidos)
      const filtered = events.filter((e: any) => {
        const kickoff = new Date(e.commence_time).getTime();
        const hasOdds = e.bookmakers && e.bookmakers.length > 0;
        return kickoff > now && kickoff < now + 96 * 60 * 60 * 1000 && hasOdds;
      });

      console.log(`[Argos-Budget] ${sportKey}: ${events.length} total → ${filtered.length} com odds na janela 96h`);
      return filtered;
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
        home_team: fixture.home_team || fixture.teams?.home?.name || "Unknown",
        away_team: fixture.away_team || fixture.teams?.away?.name || "Unknown",
        kickoff_at: startTime,
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
    // CORRIGIDO: endpoint por evento usa /events/{id}/odds (não /events/{id}?markets=all)
    const url = `${this.baseUrl}/sports/soccer/events/${matchId}/odds?markets=h2h,spreads,totals,both_teams_to_score,total_corners,total_cards&apiKey=${this.apiKey}`;
    const response = await axios.get(url, { timeout: 30000 });
    this.trackRequest();
    return this.ingestObject(response.data);
  }

  public getLeagueProfile(leagueId: number, leagueName?: string): LeagueProfile {
    return { id: leagueId, name: leagueName || "Unknown", tier: "Tier 1", historicalLiquidity: 1000000, oddsDispersion: 0.5, avgGoals: 2.5, avgCorners: 9.5, avgCards: 4.5, historicalEVPlus: 0.05, confidenceScore: 0.8 };
  }

  /**
   * Busca resultados reais (completed) via endpoint /scores da PropLine
   * (compatível com the-odds-api) e atualiza o histórico rolling de cada
   * time em `argos_team_form`. Isso substitui aos poucos os defaults
   * genéricos do FeatureEngine por médias reais — não é instantâneo
   * (a janela do /scores só cobre os últimos dias), mas acumula com o
   * tempo a cada execução do ingest.
   */
  public async updateTeamFormFromScores(sportKey: string, daysFrom: number = 3): Promise<number> {
    try {
      const url = `${this.baseUrl}/sports/${sportKey}/scores?daysFrom=${daysFrom}&apiKey=${this.apiKey}`;
      const response = await axios.get(url, { timeout: 10000 });
      this.trackRequest();
      const events = response.data || [];

      let updated = 0;
      for (const ev of events) {
        // Formato real da PropLine: {status, home_score, away_score} — não
        // {completed, scores:[{name,score}]} (formato the-odds-api que eu
        // tinha assumido errado). Confirmado via log de produção.
        if (ev.status !== "final") continue;
        if (ev.home_score === null || ev.home_score === undefined) continue;
        if (ev.away_score === null || ev.away_score === undefined) continue;

        const homeGoals = parseInt(ev.home_score, 10);
        const awayGoals = parseInt(ev.away_score, 10);
        if (isNaN(homeGoals) || isNaN(awayGoals)) continue;

        // TRAVA CRÍTICA: a janela `daysFrom` reexpõe o mesmo jogo já
        // concluído por até 3 dias seguidos, em toda coleta (4x/dia). Sem
        // isso, um único resultado era regravado repetidamente até encher
        // as 10 posições do histórico com a MESMA partida, criando uma
        // "forma" falsa e artificialmente confiante. Cada evento só entra
        // uma vez, pra sempre.
        const eventId = String(ev.id ?? `${ev.home_team}_${ev.away_team}_${ev.commence_time}`);
        const { error: insertError } = await this.supabase
          .from("argos_processed_score_events")
          .insert({ sport_key: sportKey, event_id: eventId });
        if (insertError) continue; // já processado (violação de PK) — pula

        await this.pushTeamResult(sportKey, ev.home_team, homeGoals, awayGoals);
        await this.pushTeamResult(sportKey, ev.away_team, awayGoals, homeGoals);
        updated++;
      }
      console.log(`[Argos-TeamForm] ${sportKey}: ${updated} resultados reais NOVOS processados.`);
      return updated;
    } catch (error: any) {
      console.error(`[Argos-TeamForm] Erro ao buscar scores de ${sportKey}:`, error.message);
      return 0;
    }
  }

  public async pushTeamResult(sportKey: string, teamName: string, goalsFor: number, goalsAgainst: number): Promise<void> {
    const canonicalName = normalizeTeamName(teamName);
    if (!canonicalName) return;

    const { data: existing } = await this.supabase
      .from("argos_team_form")
      .select("recent_goals_for, recent_goals_against, sample_size")
      .eq("sport_key", sportKey)
      .eq("team_name", canonicalName)
      .maybeSingle();

    const MAX_HISTORY = 10;
    const forArr = [goalsFor, ...(existing?.recent_goals_for || [])].slice(0, MAX_HISTORY);
    const againstArr = [goalsAgainst, ...(existing?.recent_goals_against || [])].slice(0, MAX_HISTORY);

    await this.supabase.from("argos_team_form").upsert({
      sport_key: sportKey,
      team_name: canonicalName,
      recent_goals_for: forArr,
      recent_goals_against: againstArr,
      sample_size: forArr.length,
      updated_at: new Date().toISOString()
    }, { onConflict: "sport_key,team_name" });
  }

  /**
   * Lê o histórico real acumulado de um time (se existir) no formato que
   * o FeatureEngine já espera (`{ goals: { home, away } }[]`).
   */
  public async getRealTeamHistory(sportKey: string, teamName: string): Promise<{ goals: { home: number; away: number } }[]> {
    const canonicalName = normalizeTeamName(teamName);
    const { data } = await this.supabase
      .from("argos_team_form")
      .select("recent_goals_for, recent_goals_against")
      .eq("sport_key", sportKey)
      .eq("team_name", canonicalName)
      .maybeSingle();

    if (!data || !data.recent_goals_for?.length) return [];

    // FeatureEngine só soma home+away, então basta preencher os dois campos
    // com gols-a-favor/gols-contra desse time — o resultado da soma é o
    // mesmo e mantém o peso exponencial por posição (mais recente primeiro).
    return data.recent_goals_for.map((gf: number, i: number) => ({
      goals: { home: gf, away: data.recent_goals_against[i] ?? 0 }
    }));
  }

  /**
   * Médias de escanteios/cartões/chutes reais do time (quando existirem).
   * Usado pra calibrar os mercados de CORNERS/CARDS — sem isso, o Argos só
   * conseguia gerar sinal de Gols/Vencedor/BTTS/Handicap.
   */
  public async getTeamExtraStats(sportKey: string, teamName: string): Promise<{
    cornersFor: number; cornersAgainst: number; cardsFor: number; cardsAgainst: number;
    shotsFor: number; shotsAgainst: number; sampleSize: number;
  } | null> {
    const canonicalName = normalizeTeamName(teamName);
    const { data } = await this.supabase
      .from("argos_team_form")
      .select("recent_corners_for, recent_corners_against, recent_cards_for, recent_cards_against, recent_shots_for, recent_shots_against")
      .eq("sport_key", sportKey)
      .eq("team_name", canonicalName)
      .maybeSingle();

    if (!data || !data.recent_corners_for?.length) return null;

    const avg = (arr: number[]) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    return {
      cornersFor: avg(data.recent_corners_for),
      cornersAgainst: avg(data.recent_corners_against),
      cardsFor: avg(data.recent_cards_for),
      cardsAgainst: avg(data.recent_cards_against),
      shotsFor: avg(data.recent_shots_for),
      shotsAgainst: avg(data.recent_shots_against),
      sampleSize: data.recent_corners_for.length,
    };
  }
}
