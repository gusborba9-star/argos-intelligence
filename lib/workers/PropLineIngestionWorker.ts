import axios from "axios";
import { getSupabaseClient } from "@/lib/core/SupabaseClient";
import { BatchQueueService } from "@/lib/core/BatchQueueService";
import { MarketVertical } from "@/lib/core/ArgosUnifiedEngine";

// ============================================================
// ARGOS PROPLINE INGESTION WORKER v1.0
// Controlled API ingestion (1000 req/day safe mode)
// ============================================================

interface PropLineEvent {
  id: number;
  sport_key: string;
  commence_time: string;
  home_team: string;
  away_team: string;
  status?: string;
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
    console.log("[PropLineWorker] 🚀 Ingestion started");

    const sports = await this.getSports();

    for (const sport of sports) {
      if (this.isQuotaExceeded()) break;

      const events = await this.getEvents(sport.key);

      await this.persistEvents(events);
    }

    console.log(
      `[PropLineWorker] ✅ Done. Requests used: ${this.requestCount}`
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
  // 2. EVENTS
  // ============================================================
  private async getEvents(sportKey: string): Promise<PropLineEvent[]> {
    try {
      const res = await this.request(
        `/sports/${sportKey}/events?markets=all`
      );

      const now = Date.now();

      return (res || []).filter((event: any) => {
        const kickoff = new Date(event.commence_time).getTime();

        return (
          kickoff > now &&
          kickoff < now + 96 * 60 * 60 * 1000 // Janela expandida para 96h (Syndicate Master)
        );
      });
    } catch (err: any) {
      console.error(
        `[PropLineWorker] getEvents error (${sportKey}):`,
        err.message
      );
      return [];
    }
  }

  // ============================================================
  // 3. PERSISTÊNCIA (argos_matches)
  // ============================================================
  private async persistEvents(events: PropLineEvent[]) {
    for (const event of events) {
      const matchId = String(event.id);

      // 🔴 anti duplicação forte
      const { data: existing } = await this.supabase
        .from("argos_matches")
        .select("match_id")
        .eq("match_id", matchId)
        .maybeSingle();

      if (!existing) {
        const payload = {
          match_id: matchId,
          external_provider: "PROPLINE",
          league_id: null,
          home_team: event.home_team,
          away_team: event.away_team,
          kickoff_at: event.commence_time,
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
          console.log(`[PropLineWorker] ✅ Inserted match ${matchId}`);
        }
      }

      // ============================================================
      // ENFILEIRAMENTO AUTOMÁTICO (Syndicate Master Pipeline)
      // ============================================================
      // REGRA: Sempre enfileira para re-análise, mesmo que o jogo já exista.
      // O BatchQueueService lida com a prevenção de duplicatas na fila se necessário.
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
          event // rawData para Single-Pass
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

    const url = `${this.baseUrl}${path}`;

    const res = await axios.get(url, {
      headers: {
        "X-API-Key": this.apiKey,
      },
      timeout: 30000,
    });

    return res.data;
  }

  private isQuotaExceeded() {
    return this.requestCount >= this.maxRequestsPerDay;
  }
  }
