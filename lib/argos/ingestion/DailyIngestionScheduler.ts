import { DataIngestionService } from "@/lib/core/DataIngestionService";
import { BatchQueueService, QueueStatus } from "@/lib/core/BatchQueueService";
import { MarketVertical } from "@/lib/core/ArgosUnifiedEngine";

/**
 * DAILY INGESTION SCHEDULER v6.0.0 — SYNDICATE MASTER
 * Discovery Dinâmico + Enfileiramento Single-Pass de Alta Prioridade.
 */
export class DailyIngestionScheduler {
  private dataIngestionService: DataIngestionService;
  private batchQueueService: BatchQueueService;
  private readonly MAX_DAILY_GAMES = 200;
  
  constructor() {
    this.dataIngestionService = new DataIngestionService();
    this.batchQueueService = new BatchQueueService();
  }

  async scheduleDailyIngestion(): Promise<{ totalProcessed: number; status: string }> {
    console.log(`[Argos-v6] 🛰️ Iniciando Discovery Dinâmico Master...`);

    try {
      const activeSports = await this.dataIngestionService.getActiveSports();
      const soccerKeys = activeSports
        .filter((s: any) => s.key.includes("soccer") || s.group.toLowerCase().includes("soccer"))
        .map((s: any) => s.key);

      let totalProcessed = 0;

      for (const sportKey of soccerKeys) {
        const isFresh = await this.dataIngestionService.checkFreshness(sportKey);
        if (!isFresh) continue;

        // MEGA CALL ALL-IN: Traz todo o payload (odds + mercados) em um hit
        const events = await this.dataIngestionService.getMegaCallOdds(sportKey);
        
        for (const event of events) {
          const score = this.calculatePriorityScore(event);
          if (score < 2) continue; 

          const matchId = (event.id || event.fixture?.id || event.match_id).toString();
          
          // Enfileiramento Master v6.0.0 com Payload Completo (rawData)
          await this.batchQueueService.enqueue(
            matchId, 
            "ALL_MARKETS", 
            [MarketVertical.WINNER, MarketVertical.GOALS, MarketVertical.CORNERS, MarketVertical.CARDS, MarketVertical.BTTS], 
            event,
            QueueStatus.QUEUED,
            score
          );

          totalProcessed++;
          if (totalProcessed >= this.MAX_DAILY_GAMES) break;
        }

        if (totalProcessed >= this.MAX_DAILY_GAMES) break;
      }

      console.log(`[Argos-v6] Discovery concluído. Eventos enfileirados: ${totalProcessed}`);

      return {
        totalProcessed,
        status: "SUCCESS"
      };
    } catch (error: any) {
      console.error("[Argos-v6] Erro crítico no Scheduler:", error.message);
      return { totalProcessed: 0, status: "FAILED" };
    }
  }

  private calculatePriorityScore(event: any): number {
    let score = 0;
    const now = new Date();
    const commenceTime = new Date(event.commence_time);
    const hoursToStart = (commenceTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Prioridade por Janela Temporal (Foco em 48h)
    if (hoursToStart <= 24) score += 3;
    else if (hoursToStart <= 48) score += 2;
    else if (hoursToStart <= 96) score += 1;

    // Prioridade por Relevância (Ligas de Elite)
    const title = (event.sport_title || event.league?.name || "").toLowerCase();
    const eliteKeywords = ["world cup", "premier league", "champions", "libertadores", "serie a", "bundesliga", "la liga", "brazil"];
    if (eliteKeywords.some(kw => title.includes(kw))) score += 2;

    // Prioridade por Liquidez (Sharp Bookmakers)
    const bookies = event.bookmakers || [];
    const hasSharp = bookies.some((b: any) => ["pinnacle", "betfair"].includes(b.key.toLowerCase()));
    if (hasSharp) score += 1;

    return score;
  }
}
