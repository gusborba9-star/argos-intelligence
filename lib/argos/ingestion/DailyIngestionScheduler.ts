import { DataIngestionService } from "@/lib/core/DataIngestionService";
import { BatchQueueService, QueueStatus } from "@/lib/core/BatchQueueService";
import { FixtureValidator, ValidationStatus } from "@/lib/core/ArgosValidation";

/**
 * DAILY INGESTION SCHEDULER v5.2 — SYNDICATE DISCOVERY
 * 1. Discovery de esportes ativos (soccer_*)
 * 2. Fetch de eventos sem data na URL (evita 404)
 * 3. Filtragem local em janela de 96 horas
 */
export class DailyIngestionScheduler {
  private dataIngestionService: DataIngestionService;
  private batchQueueService: BatchQueueService;
  private readonly MAX_DAILY_GAMES = 150;
  private readonly WINDOW_HOURS = 96; // Janela competitiva de 4 dias decidida pelo CTO
  
  constructor() {
    this.dataIngestionService = new DataIngestionService();
    this.batchQueueService = new BatchQueueService();
  }

  async scheduleDailyIngestion(): Promise<{ totalIngested: number; status: string; enqueuedMatchDetails: any[] }> {
    const now = new Date();
    const windowLimit = new Date(now.getTime() + this.WINDOW_HOURS * 60 * 60 * 1000);

    console.log(`[Argos v5.2] Iniciando Discovery Dinâmico (Janela: ${this.WINDOW_HOURS}h)`);

    // 1. DISCOVERY: Quais esportes de futebol estão ativos?
    const activeSports = await this.dataIngestionService.getActiveSports();
    const soccerKeys = activeSports
      .filter((s: any) => s.key.includes("soccer") && s.active)
      .map((s: any) => s.key);

    if (soccerKeys.length === 0) {
      console.warn("[Argos v5.2] Nenhum esporte 'soccer' ativo no Discovery.");
      return { totalIngested: 0, status: "NO_ACTIVE_SPORTS", enqueuedMatchDetails: [] };
    }

    console.log(`[Argos v5.2] Esportes detectados para caçada: ${soccerKeys.join(", ")}`);

    // 2. FETCH LIMPO E FILTRAGEM LOCAL
    const allEvents: any[] = [];
    for (const key of soccerKeys) {
      const events = await this.dataIngestionService.getEventsBySport(key);
      allEvents.push(...events);
    }

    // Filtro Local em Memória (Contrato PropLine respeitado)
    const filteredEvents = allEvents.filter((event: any) => {
      const commenceTime = new Date(event.commence_time || event.fixture?.date);
      const status = event.status?.short || event.fixture?.status?.short;

      // Regra 1: Dentro da janela de 96h
      const isInWindow = commenceTime >= now && commenceTime <= windowLimit;
      
      // Regra 2: Status ativo/agendado
      const isActive = ['NS', 'LIVE', '1H', 'HT', '2H'].includes(status);

      return isInWindow && isActive;
    });

    if (filteredEvents.length === 0) {
      console.warn("[Argos v5.2] ALERTA: Mercado Inativo na Janela de 96h.");
      return { totalIngested: 0, status: "MARKET_INACTIVE", enqueuedMatchDetails: [] };
    }

    console.log(`[Argos v5.2] ${filteredEvents.length} eventos filtrados localmente na janela de 96h.`);

    // 3. PRIORIZAÇÃO E ENFILEIRAMENTO
    const eliteLeagues = [1, 2, 3, 11, 13, 15, 61, 71, 72, 73, 78, 94, 140];
    const sortedEvents = filteredEvents.sort((a, b) => {
      const isAElite = eliteLeagues.includes(a.league?.id) ? 1 : 0;
      const isBElite = eliteLeagues.includes(b.league?.id) ? 1 : 0;
      if (isAElite !== isBElite) return isBElite - isAElite;
      return new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime();
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

    console.log(`[Argos v5.2] Caçada concluída: ${ingestedCount} jogos enfileirados.`);

    return {
      totalIngested: ingestedCount,
      status: ingestedCount >= this.MAX_DAILY_GAMES ? "QUOTA_FULL" : "QUOTA_PARTIAL",
      enqueuedMatchDetails
    };
  }
}
