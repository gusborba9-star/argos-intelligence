import axios from "axios";
import { getSupabaseClient } from "@/lib/core/SupabaseClient";
import { BatchQueueService } from "@/lib/core/BatchQueueService";
import { MarketVertical } from "@/lib/core/ArgosUnifiedEngine";

// ============================================================
// ARGOS PROPLINE INGESTION WORKER v2.0
// AUDITORIA CTO — 2026-07-02
//
// PROBLEMA IDENTIFICADO E CORRIGIDO:
//   ANTES: GET /sports/{sport}/events?markets=all
//          → bookmakers=null em TODOS os eventos
//          → ZERO odds chegavam ao MarketNormalizer
//          → Pipeline inteiro sem dados reais
//
//   DEPOIS: GET /sports/{sport}/odds?markets=h2h,spreads,totals,...
//           → bookmakers preenchidos com odds reais
//           → Todos os mercados disponíveis para soccer
//
// REGRA: Apenas o Worker foi alterado.
//        Nenhuma Engine, threshold ou regra de Edge foi modificada.
// ============================================================

// Market keys oficiais da PropLine para soccer (validados em 2026-07-02)
// Fonte: https://prop-line.com/docs#markets
const SOCCER_MARKETS = [
  "h2h",                  // Winner / 1X2
  "spreads",              // Handicap / Asian Handicap
  "totals",               // Over/Under Gols (múltiplas linhas)
  "both_teams_to_score",  // BTTS
  "total_corners",        // Escanteios
  "total_cards",          // Cartões
].join(",");

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
    console.log("[PropLineWorker v2.0] 🚀 Ingestion started — endpoint corrigido para /odds");

    const sports = await this.getSports();
    console.log(`[PropLineWorker] Esportes de futebol encontrados: ${sports.length}`);

    for (const sport of sports) {
      if (this.isQuotaExceeded()) break;

      // CORRIGIDO: usa /odds em vez de /events?markets=all
      const events = await this.getOdds(sport.key);
      console.log(`[PropLineWorker] ${sport.key}: ${events.length} eventos com odds`);

      await this.persistEvents(events, sport.key);
    }

    console.log(
      `[PropLineWorker v2.0] ✅ Done. Requests used: ${this.requestCount}`
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
  // ANTES: /sports/{sport}/events?markets=all
  //        → bookmakers=null, ZERO odds
  //
  // DEPOIS: /sports/{sport}/odds?markets=h2h,spreads,totals,...
  //         → bookmakers preenchidos com odds reais de múltiplas casas
  // ============================================================
  async getOdds(sportKey: string): Promise<PropLineOddsEvent[]> {
    try {
      const res = await this.request(
        `/sports/${sportKey}/odds?markets=${SOCCER_MARKETS}`
      );

      const now = Date.now();

      // Filtra apenas eventos futuros dentro da janela de 96h
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
  // ============================================================
  private async persistEvents(events: PropLineOddsEvent[], sportKey: string) {
    for (const event of events) {
      const matchId = String(event.id);

      // Anti-duplicação: verifica se já existe
      const { data: existing } = await this.supabase
        .from("argos_matches")
        .select("match_id, updated_at")
        .eq("match_id", matchId)
        .maybeSingle();

      const bookmakerCount = (event.bookmakers || []).length;
      const marketCount = (event.bookmakers || []).reduce(
        (sum, bk) => sum + (bk.markets?.length || 0), 0
      );

      if (!existing) {
        const payload = {
          match_id: matchId,
          external_provider: "PROPLINE",
          league_id: null,
          sport_key: sportKey,
          home_team: event.home_team,
          away_team: event.away_team,
          kickoff_at: event.commence_time,
          start_time: event.commence_time,
          status: "SCHEDULED",
          raw_data: event,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        const { error } = await this.supabase
          .from("argos_matches")
          .insert(payload);

        if (error) {
          console.error("[PropLineWorker] insert error:", error.message);
        } else {
          console.log(
            `[PropLineWorker] ✅ Inserted match ${matchId} | ${event.home_team} vs ${event.away_team} | bookmakers=${bookmakerCount} | mercados=${marketCount}`
          );
        }
      } else {
        // Atualiza raw_data com odds mais recentes
        await this.supabase
          .from("argos_matches")
          .update({ raw_data: event, updated_at: new Date().toISOString() })
          .eq("match_id", matchId);

        console.log(
          `[PropLineWorker] 🔄 Updated match ${matchId} | bookmakers=${bookmakerCount} | mercados=${marketCount}`
        );
      }

      // ============================================================
      // ENFILEIRAMENTO AUTOMÁTICO (Syndicate Master Pipeline)
      // Enfileira com payload completo (Single-Pass) — zero re-fetch
      // ============================================================
      try {
        const queueService = new BatchQueueService();
        await queueService.enqueue(
          matchId,
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
        console.log(`[PropLineWorker] 📥 Enqueued match ${matchId} for engine processing`);
      } catch (queueErr: any) {
        console.error(`[PropLineWorker] ❌ Queue error for ${matchId}:`, queueErr.message);
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

    // Suporta tanto apiKey como X-API-Key (ambos funcionam na PropLine)
    const separator = path.includes("?") ? "&" : "?";
    const url = `${this.baseUrl}${path}${separator}apiKey=${this.apiKey}`;

    const res = await axios.get(url, {
      timeout: 30000,
    });

    return res.data;
  }

  private isQuotaExceeded() {
    return this.requestCount >= this.maxRequestsPerDay;
  }
}
