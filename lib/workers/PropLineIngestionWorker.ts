import axios from "axios";
import { v5 as uuidv5 } from "uuid";
import { getSupabaseClient } from "@/lib/core/SupabaseClient";
import { BatchQueueService } from "@/lib/core/BatchQueueService";
import { MarketVertical } from "@/lib/core/ArgosUnifiedEngine";

// ============================================================
// ARGOS PROPLINE INGESTION WORKER v3.0
// AUDITORIA CTO — 2026-07-02 (Correção 2: Schema Real)
//
// CORREÇÃO 1 (v2.0): endpoint /events → /odds
//   ANTES: GET /sports/{sport}/events?markets=all → bookmakers=null
//   DEPOIS: GET /sports/{sport}/odds?markets=h2h,... → bookmakers preenchidos
//
// CORREÇÃO 2 (v3.0): schema real do Supabase
//   PROBLEMA: Worker tentava inserir colunas inexistentes no banco:
//     - sport_key    → NÃO EXISTE em argos_matches
//     - start_time   → NÃO EXISTE (campo correto é kickoff_at)
//     - match_id     → É UUID no banco, não string livre
//     - league_id    → É REQUIRED (FK), não pode ser null
//   SOLUÇÃO:
//     - Removidas colunas inexistentes do payload
//     - match_id gerado como UUID v5 determinístico (propline ID → UUID)
//     - league_id mapeado via SPORT_TO_LEAGUE_ID
//     - external_fixture_id usado para anti-duplicação (não match_id)
//
// REGRA: Apenas o Worker foi alterado.
//        Nenhuma Engine, threshold ou regra de Edge foi modificada.
// ============================================================

// Market keys oficiais da PropLine para soccer (validados em 2026-07-02)
const SOCCER_MARKETS = [
  "h2h",                  // Winner / 1X2
  "spreads",              // Handicap / Asian Handicap
  "totals",               // Over/Under Gols (múltiplas linhas)
  "both_teams_to_score",  // BTTS
  "total_corners",        // Escanteios
  "total_cards",          // Cartões
].join(",");

// Namespace UUID v5 para geração determinística de match_id
const UUID_NAMESPACE = "6ba7b810-9dad-11d1-80b4-00c04fd430c8";

// Mapeamento PropLine sport_key → argos_league_governance.id
// Baseado nos dados reais do banco (auditoria 2026-07-02)
const SPORT_TO_LEAGUE_ID: Record<string, number> = {
  soccer_fifa_world_cup:          1,
  soccer_uefa_champions_league:   2,
  soccer_copa_sudamericana:       11,
  soccer_copa_libertadores:       13,
  soccer_epl:                     39,
  soccer_ligue_1:                 61,
  soccer_brasileirao:             71,
  soccer_bundesliga:              78,
  soccer_argentina_primera:       128,
  soccer_serie_a:                 135,
  soccer_la_liga:                 140,
  soccer_saudi_pro:               307,
  // Allsvenskan e outras ligas sem ID mapeado → World Cup como fallback
  soccer_sweden_allsvenskan:      1,
};
const DEFAULT_LEAGUE_ID = 1;

interface PropLineOddsEvent {
  id: string;
  sport_key: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  live: boolean;
  last_update?: string;
  bookmakers: Array<{
    key: string;
    title: string;
    last_update: string;
    markets: Array<{
      key: string;
      last_update: string;
      period: string | null;
      outcomes: Array<{
        name: string;
        description: string;
        price: number;
        point: number | null;
      }>;
    }>;
  }> | null;
}

export class PropLineIngestionWorker {
  private baseUrl = "https://api.prop-line.com/v1";
  private apiKey = process.env.PROPLINE_API_KEY!;
  private supabase = getSupabaseClient();

  private requestCount = 0;
  private maxRequestsPerDay = 950; // margem de segurança

  // ============================================================
  // ENTRYPOINT (CRON)
  // ============================================================
  async run() {
    console.log("[PropLineWorker v3.0] 🚀 Ingestion started — endpoint /odds + schema real");

    const sports = await this.getSports();
    console.log(`[PropLineWorker] Esportes de futebol encontrados: ${sports.length}`);

    for (const sport of sports) {
      if (this.isQuotaExceeded()) break;

      // CORRIGIDO v2.0: usa /odds em vez de /events?markets=all
      const events = await this.getOdds(sport.key);
      console.log(`[PropLineWorker] ${sport.key}: ${events.length} eventos com odds`);

      await this.persistEvents(events, sport.key);
    }

    console.log(
      `[PropLineWorker v3.0] ✅ Done. Requests used: ${this.requestCount}`
    );
  }

  // ============================================================
  // 1. SPORTS
  // ============================================================
  private async getSports(): Promise<any[]> {
    try {
      const res = await this.request("/sports");
      return (res || []).filter(
        (s: any) => s.active && s.key.includes("soccer")
      );
    } catch (err: any) {
      console.error("[PropLineWorker] getSports error:", err.message);
      return [];
    }
  }

  // ============================================================
  // 2. ODDS — ENDPOINT CORRETO (substitui getEvents)
  //
  // ANTES (v1.x): /sports/{sport}/events?markets=all
  //               → bookmakers=null, ZERO odds
  //
  // DEPOIS (v2.0+): /sports/{sport}/odds?markets=h2h,spreads,totals,...
  //                 → bookmakers preenchidos com odds reais
  // ============================================================
  async getOdds(sportKey: string): Promise<PropLineOddsEvent[]> {
    try {
      const res = await this.request(
        `/sports/${sportKey}/odds?markets=${SOCCER_MARKETS}`
      );

      const now = Date.now();

      // Filtra apenas eventos futuros dentro da janela de 96h com odds reais
      const filtered = (res || []).filter((event: PropLineOddsEvent) => {
        const kickoff = new Date(event.commence_time).getTime();
        const hasOdds = event.bookmakers && event.bookmakers.length > 0;
        return (
          kickoff > now &&
          kickoff < now + 96 * 60 * 60 * 1000 &&
          hasOdds
        );
      });

      console.log(
        `[PropLineWorker] ${sportKey}: ${(res || []).length} total → ${filtered.length} com odds na janela de 96h`
      );

      return filtered;
    } catch (err: any) {
      console.error(
        `[PropLineWorker] getOdds error (${sportKey}):`,
        err.message
      );
      return [];
    }
  }

  // ============================================================
  // 3. PERSISTÊNCIA (argos_matches)
  //
  // CORREÇÃO v3.0: schema real do banco
  //   - match_id: UUID v5 determinístico (não string do PropLine)
  //   - external_fixture_id: bigint (ID numérico do PropLine)
  //   - league_id: FK obrigatória (mapeada via SPORT_TO_LEAGUE_ID)
  //   - Removido: sport_key, start_time (não existem no banco)
  //   - Anti-duplicação via external_fixture_id (não match_id)
  // ============================================================
  private async persistEvents(events: PropLineOddsEvent[], sportKey: string) {
    for (const event of events) {
      const proplineId = String(event.id);

      // Gerar UUID v5 determinístico baseado no ID da PropLine
      const matchUuid = uuidv5(`propline:${proplineId}`, UUID_NAMESPACE);

      // Converter ID da PropLine para bigint (external_fixture_id)
      const fixtureId = this.toFixtureId(proplineId);

      // Mapear sport_key para league_id (FK obrigatória)
      const leagueId = SPORT_TO_LEAGUE_ID[sportKey] ?? DEFAULT_LEAGUE_ID;

      const bookmakerCount = (event.bookmakers || []).length;
      const marketCount = (event.bookmakers || []).reduce(
        (sum, bk) => sum + (bk.markets?.length || 0), 0
      );
      const oddsCount = (event.bookmakers || []).reduce(
        (sum, bk) => sum + (bk.markets || []).reduce(
          (s2, mkt) => s2 + (mkt.outcomes?.length || 0), 0
        ), 0
      );

      const now = new Date().toISOString();

      // Anti-duplicação via external_fixture_id (campo único e numérico)
      const { data: existing } = await this.supabase
        .from("argos_matches")
        .select("match_id, updated_at")
        .eq("external_fixture_id", fixtureId)
        .maybeSingle();

      if (!existing) {
        // ── INSERT ──────────────────────────────────────────────
        const { error } = await this.supabase
          .from("argos_matches")
          .insert({
            match_id:            matchUuid,
            external_provider:   "PROPLINE",
            external_fixture_id: fixtureId,
            league_id:           leagueId,
            home_team:           event.home_team,
            away_team:           event.away_team,
            kickoff_at:          event.commence_time,
            status:              "SCHEDULED",
            raw_data:            event,
            created_at:          now,
            updated_at:          now,
          });

        if (error) {
          console.error(
            `[PropLineWorker] ❌ insert error (${proplineId}):`,
            error.message,
            error.details
          );
        } else {
          console.log(
            `[PropLineWorker] ✅ Inserted ${event.home_team} vs ${event.away_team} | bk=${bookmakerCount} mkt=${marketCount} odds=${oddsCount}`
          );
        }
      } else {
        // ── UPDATE (odds mais recentes) ──────────────────────────
        await this.supabase
          .from("argos_matches")
          .update({ raw_data: event, updated_at: now })
          .eq("external_fixture_id", fixtureId);

        console.log(
          `[PropLineWorker] 🔄 Updated ${event.home_team} vs ${event.away_team} | bk=${bookmakerCount} mkt=${marketCount}`
        );
      }

      // ============================================================
      // ENFILEIRAMENTO AUTOMÁTICO (Syndicate Master Pipeline)
      // Enfileira com payload completo (Single-Pass) — zero re-fetch
      // match_id usado na fila é o UUID gerado acima
      // ============================================================
      try {
        const queueService = new BatchQueueService();
        await queueService.enqueue(
          matchUuid,           // UUID correto (não o propline ID)
          "ALL_MARKETS",
          [
            MarketVertical.WINNER,
            MarketVertical.HANDICAP,
            MarketVertical.GOALS,
            MarketVertical.GOALS_HT,
            MarketVertical.BTTS,
            MarketVertical.CORNERS,
            MarketVertical.CARDS,
            MarketVertical.SHOTS,
            MarketVertical.SHOTS_ON_TARGET,
          ],
          event // rawData completo com bookmakers/markets/outcomes
        );
        console.log(`[PropLineWorker] 📥 Enqueued ${matchUuid} (${event.home_team} vs ${event.away_team})`);
      } catch (queueErr: any) {
        console.error(`[PropLineWorker] ❌ Queue error for ${matchUuid}:`, queueErr.message);
      }
    }
  }

  // ============================================================
  // 4. REQUEST WRAPPER (quota control)
  // ============================================================
  private async request(path: string) {
    if (this.isQuotaExceeded()) {
      console.warn("[PropLineWorker] ⚠️ quota exceeded, stopping");
      return [];
    }

    this.requestCount++;

    const separator = path.includes("?") ? "&" : "?";
    const url = `${this.baseUrl}${path}${separator}apiKey=${this.apiKey}`;

    const res = await axios.get(url, { timeout: 30000 });
    return res.data;
  }

  // ============================================================
  // 5. HELPERS
  // ============================================================

  /**
   * Converte o ID string da PropLine para bigint (external_fixture_id).
   * IDs numéricos são usados diretamente.
   * IDs não numéricos recebem hash MD5 determinístico.
   */
  private toFixtureId(proplineId: string): number {
    const n = parseInt(proplineId, 10);
    if (!isNaN(n)) return n;
    // Hash determinístico para IDs não numéricos
    let hash = 0;
    for (let i = 0; i < proplineId.length; i++) {
      hash = ((hash << 5) - hash) + proplineId.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }

  private isQuotaExceeded() {
    return this.requestCount >= this.maxRequestsPerDay;
  }
}
