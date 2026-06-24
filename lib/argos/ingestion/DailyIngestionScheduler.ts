import { DataIngestionService } from "@/lib/core/DataIngestionService";
import { BatchQueueService, QueueStatus } from "@/lib/core/BatchQueueService";

/**
 * DAILY INGESTION SCHEDULER v5.4.0 — DYNAMIC DISCOVERY SCHEDULER
 * 1. Dynamic Sport Discovery (Agnóstico a Ligas)
 * 2. Sentinel Loop (Freshness Check)
 * 3. Priority Score (Score >= 2)
 * 4. Mega Call Processing (Multi-Bookmaker)
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
    console.log(`[Argos v5.4.0] Iniciando Ciclo de Discovery Dinâmico...`);

    // 1. DYNAMIC DISCOVERY LAYER: Busca esportes ativos sem hardcoding
    const activeSports = await this.dataIngestionService.getActiveSports();
    
    // Filtramos esportes de futebol de forma dinâmica
    const soccerKeys = activeSports
      .filter((s: any) => s.key.includes("soccer") || s.group.toLowerCase().includes("soccer"))
      .map((s: any) => s.key);

    console.log(`[Argos-Discovery] ${soccerKeys.length} chaves de futebol identificadas para varredura.`);

    let totalProcessed = 0;

    for (const sportKey of soccerKeys) {
      // 2. SENTINEL LOOP: Só gasta budget se o dado for fresco
      const isFresh = await this.dataIngestionService.checkFreshness(sportKey);
      if (!isFresh) {
        console.log(`[Argos-Budget] Skipping ${sportKey}: Dados ainda estão frescos no cache da API.`);
        continue;
      }

      // 3. MEGA CALL: Puxa todos os eventos e bookmakers da chave
      const events = await this.dataIngestionService.getMegaCallOdds(sportKey);
      
      for (const event of events) {
        // 4. PRIORITY SCORE: Prioriza o que realmente importa
        const score = this.calculatePriorityScore(event);
        if (score < 2) continue; // Descarta jogos irrelevantes ou muito distantes

        const matchId = (event.id || event.fixture?.id || event.match_id).toString();
        
        // 5. FAIR LINE & ENFILEIRAMENTO DINÂMICO
        // O calculateFairLine agora é resiliente a múltiplos bookmakers
        const fairLine = this.dataIngestionService.calculateFairLine(event);
        
        await this.batchQueueService.enqueue(
          matchId, 
          "DYNAMIC_DISCOVERY", 
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

    console.log(`[Argos-Budget] Ciclo Discovery concluído. Jogos Enfileirados: ${totalProcessed}`);

    return {
      totalProcessed,
      status: "SUCCESS"
    };
  }

  /**
   * Priority Score: Peso para jogos de alta liquidez ou próximos.
   * Adaptado para ser agnóstico a nomes de ligas fixas.
   */
  private calculatePriorityScore(event: any): number {
    let score = 0;
    const now = new Date();
    const commenceTime = new Date(event.commence_time);
    const hoursToStart = (commenceTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    // 1. Proximidade Temporal (Máximo +2)
    if (hoursToStart <= 24) score += 2;
    else if (hoursToStart <= 48) score += 1;

    // 2. Relevância da Competição (Dinâmico)
    const title = (event.sport_title || event.league?.name || "").toLowerCase();
    const eliteKeywords = ["world cup", "premier league", "champions", "libertadores", "serie a", "bundesliga", "la liga"];
    
    if (eliteKeywords.some(kw => title.includes(kw))) {
      score += 1;
    }

    // 3. Liquidez de Bookmakers (Se tiver Pinnacle, Betfair ou +5 bookies, +1)
    const bookies = event.bookmakers || [];
    const hasSharp = bookies.some((b: any) => ["pinnacle", "betfair"].includes(b.key.toLowerCase()));
    if (hasSharp || bookies.length >= 5) {
      score += 1;
    }

    return score;
  }
}
