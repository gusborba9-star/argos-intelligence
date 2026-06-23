import { DataIngestionService } from "@/lib/core/DataIngestionService";
import { BatchQueueService, QueueStatus } from "@/lib/core/BatchQueueService";

/**
 * DAILY INGESTION SCHEDULER v5.3 — SYNDICATE BUDGET MANAGER
 * 1. Sentinel Loop (Freshness Check)
 * 2. Priority Score (Score >= 2)
 * 3. Mega Call Processing
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
    console.log(`[Argos v5.3] Iniciando Ciclo de Ingestão com Sentinel Loop...`);

    // 1. DISCOVERY LAYER
    const activeSports = await this.dataIngestionService.getActiveSports();
    const soccerKeys = activeSports
      .filter((s: any) => s.key.includes("soccer"))
      .map((s: any) => s.key);

    let totalProcessed = 0;

    for (const sportKey of soccerKeys) {
      // 2. SENTINEL LOOP: Só gasta budget se o dado for fresco
      const isFresh = await this.dataIngestionService.checkFreshness(sportKey);
      if (!isFresh) {
        console.log(`[Argos-Budget] Skipping ${sportKey}: Dados ainda estão frescos no cache da API.`);
        continue;
      }

      // 3. MEGA CALL: Puxa tudo de uma vez
      const events = await this.dataIngestionService.getMegaCallOdds(sportKey);
      
      for (const event of events) {
        // 4. PRIORITY SCORE
        const score = this.calculatePriorityScore(event);
        if (score < 2) continue; // Descarta jogos irrelevantes/distantes

        const matchId = (event.id || event.fixture?.id).toString();
        
        // 5. FAIR LINE & ENFILEIRAMENTO
        const fairLine = this.dataIngestionService.calculateFairLine(event);
        
        await this.batchQueueService.enqueue(
          matchId, 
          "MEGA_CALL", 
          [], 
          undefined, 
          QueueStatus.VALIDATED,
          score
        );

        totalProcessed++;
        if (totalProcessed >= this.MAX_DAILY_GAMES) break;
      }

      if (totalProcessed >= this.MAX_DAILY_GAMES) break;
    }

    console.log(`[Argos-Budget] Ciclo concluído. Jogos Processados: ${totalProcessed}`);

    return {
      totalProcessed,
      status: "SUCCESS"
    };
  }

  /**
   * Priority Score: Peso para jogos de alta liquidez ou próximos
   */
  private calculatePriorityScore(event: any): number {
    let score = 0;
    const now = new Date();
    const commenceTime = new Date(event.commence_time);
    const hoursToStart = (commenceTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // Jogos nas próximas 24h ganham +2
    if (hoursToStart <= 24) score += 2;
    // Jogos entre 24h e 48h ganham +1
    else if (hoursToStart <= 48) score += 1;

    // Ligas de Elite ganham +1
    const name = (event.league?.name || event.sport_title || "").toLowerCase();
    if (name.includes("world cup") || name.includes("premier league") || name.includes("champions")) {
      score += 1;
    }

    return score;
  }
}
