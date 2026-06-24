import { DataIngestionService } from "@/lib/core/DataIngestionService";
import { BatchQueueService, QueueStatus } from "@/lib/core/BatchQueueService";

/**
 * DAILY INGESTION SCHEDULER v5.5.0 — SINGLE-PASS ARCHITECTURE
 * 1. Mega Call All-In (Payload Completo)
 * 2. Enfileiramento de Objeto (Evita Single Ingest)
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
    console.log(`[Argos v5.5.0] Iniciando Ciclo Single-Pass...`);

    const activeSports = await this.dataIngestionService.getActiveSports();
    const soccerKeys = activeSports
      .filter((s: any) => s.key.includes("soccer") || s.group.toLowerCase().includes("soccer"))
      .map((s: any) => s.key);

    let totalProcessed = 0;

    for (const sportKey of soccerKeys) {
      const isFresh = await this.dataIngestionService.checkFreshness(sportKey);
      if (!isFresh) continue;

      // MEGA CALL ALL-IN: Traz tudo de uma vez
      const events = await this.dataIngestionService.getMegaCallOdds(sportKey);
      
      for (const event of events) {
        const score = this.calculatePriorityScore(event);
        if (score < 2) continue; 

        const matchId = (event.id || event.fixture?.id || event.match_id).toString();
        
        // No fluxo Single-Pass, enfileiramos o matchId mas o worker 
        // agora terá acesso ao payload completo se o orquestrador for chamado corretamente.
        // NOTA: Para Single-Pass real em tempo de execução, o orquestrador pode processar 
        // o 'event' diretamente aqui se quisermos pular a fila, mas manteremos a fila 
        // para resiliência, salvando o payload no 'raw_data' do enfileiramento.
        
        await this.batchQueueService.enqueue(
          matchId, 
          "SINGLE_PASS", 
          [], 
          event, // Passamos o objeto completo para a fila
          QueueStatus.VALIDATED,
          score
        );

        totalProcessed++;
        if (totalProcessed >= this.MAX_DAILY_GAMES) break;
      }

      if (totalProcessed >= this.MAX_DAILY_GAMES) break;
    }

    console.log(`[Argos-Budget] Ciclo Single-Pass concluído. Jogos: ${totalProcessed}`);

    return {
      totalProcessed,
      status: "SUCCESS"
    };
  }

  private calculatePriorityScore(event: any): number {
    let score = 0;
    const now = new Date();
    const commenceTime = new Date(event.commence_time);
    const hoursToStart = (commenceTime.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursToStart <= 24) score += 2;
    else if (hoursToStart <= 48) score += 1;

    const title = (event.sport_title || event.league?.name || "").toLowerCase();
    const eliteKeywords = ["world cup", "premier league", "champions", "libertadores", "serie a", "bundesliga", "la liga"];
    if (eliteKeywords.some(kw => title.includes(kw))) score += 1;

    const bookies = event.bookmakers || [];
    const hasSharp = bookies.some((b: any) => ["pinnacle", "betfair"].includes(b.key.toLowerCase()));
    if (hasSharp || bookies.length >= 5) score += 1;

    return score;
  }
}
