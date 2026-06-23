import { DataIngestionService } from "@/lib/core/DataIngestionService";
import { BatchQueueService, QueueStatus } from "@/lib/core/BatchQueueService";
import { FixtureValidator, ValidationStatus } from "@/lib/core/ArgosValidation";

/**
 * DAILY INGESTION SCHEDULER v5.2 — SYNDICATE DISCOVERY (DEBUG EDITION)
 */
export class DailyIngestionScheduler {
  private dataIngestionService: DataIngestionService;
  private batchQueueService: BatchQueueService;
  private readonly MAX_DAILY_GAMES = 150;
  private readonly WINDOW_HOURS = 96; 
  
  constructor() {
    this.dataIngestionService = new DataIngestionService();
    this.batchQueueService = new BatchQueueService();
  }

  async scheduleDailyIngestion(): Promise<{ totalIngested: number; status: string; enqueuedMatchDetails: any[] }> {
    const now = new Date();
    const windowLimit = new Date(now.getTime() + this.WINDOW_HOURS * 60 * 60 * 1000);

    console.log(`[Argos v5.2] Discovery Dinâmico iniciado. Agora: ${now.toISOString()} | Janela até: ${windowLimit.toISOString()}`);

    const activeSports = await this.dataIngestionService.getActiveSports();
    const soccerKeys = activeSports
      .filter((s: any) => s.key.includes("soccer") && s.active)
      .map((s: any) => s.key);

    if (soccerKeys.length === 0) {
      return { totalIngested: 0, status: "NO_ACTIVE_SPORTS", enqueuedMatchDetails: [] };
    }

    const allEvents: any[] = [];
    for (const key of soccerKeys) {
      const events = await this.dataIngestionService.getEventsBySport(key);
      
      // DEBUG DE PAYLOAD (Solicitado pelo Diretor)
      if (key === 'soccer_fifa_world_cup' || key.includes('world_cup')) {
        console.log(`[DEBUG-WC] Key: ${key} | Total de eventos recebidos: ${events.length}`);
        if (events.length > 0) {
          console.log(`[DEBUG-WC] Amostra (Top 3):`, events.slice(0, 3).map(e => ({
            id: e.id || e.fixture?.id,
            commence_time: e.commence_time || e.fixture?.date,
            status: e.status?.short || e.fixture?.status?.short,
            teams: `${e.home_team || e.teams?.home?.name} vs ${e.away_team || e.teams?.away?.name}`
          })));
        }
      }
      
      allEvents.push(...events);
    }

    // FILTRAGEM COM LOGS DE DESCARTE
    const filteredEvents = allEvents.filter((event: any) => {
      const eventTimeStr = event.commence_time || event.fixture?.date;
      const commenceTime = new Date(eventTimeStr);
      const status = event.status?.short || event.fixture?.status?.short || 'NS';
      const matchName = `${event.home_team || event.teams?.home?.name} vs ${event.away_team || event.teams?.away?.name}`;

      const isInWindow = commenceTime >= now && commenceTime <= windowLimit;
      const isActive = ['NS', 'LIVE', '1H', 'HT', '2H', 'TBD'].includes(status);

      if (!isInWindow || !isActive) {
        // Log de descarte apenas para ligas importantes (Copa do Mundo)
        if (event.sport_key?.includes('world_cup') || event.league?.name?.toLowerCase().includes('world cup')) {
          console.log(`[DEBUG-WC] Evento [${matchName}] DESCARTADO. Motivo: ${!isInWindow ? 'FORA DA JANELA (Time: ' + eventTimeStr + ')' : 'STATUS INVÁLIDO (' + status + ')'}`);
        }
        return false;
      }

      return true;
    });

    if (filteredEvents.length === 0) {
      console.warn("[Argos v5.2] ALERTA: Mercado Inativo na Janela de 96h.");
      return { totalIngested: 0, status: "MARKET_INACTIVE", enqueuedMatchDetails: [] };
    }

    const eliteLeagues = [1, 2, 3, 11, 13, 15, 61, 71, 72, 73, 78, 94, 140];
    const sortedEvents = filteredEvents.sort((a, b) => {
      const isAElite = eliteLeagues.includes(a.league?.id) ? 1 : 0;
      const isBElite = eliteLeagues.includes(b.league?.id) ? 1 : 0;
      if (isAElite !== isBElite) return isBElite - isAElite;
      return new Date(a.commence_time || a.fixture?.date).getTime() - new Date(b.commence_time || b.fixture?.date).getTime();
    });

    const finalSelection = sortedEvents.slice(0, this.MAX_DAILY_GAMES);
    const enqueuedMatchDetails: any[] = [];
    let ingestedCount = 0;

    for (const event of finalSelection) {
      const matchId = (event.id || event.fixture?.id).toString();
      const alreadyQueued = await this.batchQueueService.isAlreadyEnqueued(matchId);
      if (alreadyQueued) continue;

      await this.batchQueueService.enqueue(matchId, "ALL_MARKETS", [], undefined, QueueStatus.VALIDATED);
      
      enqueuedMatchDetails.push({
        id: matchId,
        home: event.home_team || event.teams?.home?.name,
        away: event.away_team || event.teams?.away?.name,
        league: event.league?.name || event.sport_title,
        date: event.commence_time || event.fixture?.date
      });
      ingestedCount++;
    }

    return {
      totalIngested: ingestedCount,
      status: ingestedCount >= this.MAX_DAILY_GAMES ? "QUOTA_FULL" : "QUOTA_PARTIAL",
      enqueuedMatchDetails
    };
  }
}
