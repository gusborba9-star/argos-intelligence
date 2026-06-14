import { DataIngestionService } from "@/lib/core/DataIngestionService";
import { BatchQueueService } from "@/lib/core/BatchQueueService";

/**
 * DAILY INGESTION SCHEDULER v5.0
 * Gerencia a cota diária de 100 jogos, priorizando ligas de elite.
 */
export class DailyIngestionScheduler {
  private dataIngestionService: DataIngestionService;
  private batchQueueService: BatchQueueService;
  private readonly MAX_DAILY_GAMES = 100;

  constructor() {
    this.dataIngestionService = new DataIngestionService();
    this.batchQueueService = new BatchQueueService();
  }

  /**
   * Executa a curadoria diária de jogos
   */
  async scheduleDailyIngestion() {
    const today = new Date().toISOString().split('T')[0];
    let ingestedCount = 0;
    const processedMatchIds = new Set<string>();

    console.log(`[Argos v5.0] Iniciando curadoria diária para ${today}...`);

    // 1. PRIORIDADE ELITE: Buscar jogos das ligas de maior liquidez
    const priorityLeagues = this.dataIngestionService.getPriorityLeagues();
    
    // Execução paralela para buscar fixtures das ligas prioritárias
    const fixturePromises = priorityLeagues.map(league => 
      this.dataIngestionService.getFixturesByLeague(league.id, today)
        .catch(err => {
          console.error(`[Argos v5.0] Erro ao buscar liga ${league.name}:`, err.message);
          return [];
        })
    );

    const allFixtures = await Promise.all(fixturePromises);

    for (const fixtures of allFixtures) {
      for (const fixture of fixtures) {
        if (ingestedCount >= this.MAX_DAILY_GAMES) break;

        const matchId = fixture.fixture.id.toString();
        if (!processedMatchIds.has(matchId)) {
          await this.batchQueueService.enqueue(matchId, ["WINNER", "GOALS", "CORNERS", "CARDS", "BTTS", "SHOTS", "HANDICAP"]);
          processedMatchIds.add(matchId);
          ingestedCount++;
        }
      }
      if (ingestedCount >= this.MAX_DAILY_GAMES) break;
    }

    console.log(`[Argos v5.0] Curadoria Elite concluída: ${ingestedCount} jogos.`);

    // 2. PREENCHIMENTO: Se a cota não foi atingida, buscar em ligas menores (Simulação)
    if (ingestedCount < this.MAX_DAILY_GAMES) {
      console.log(`[Argos v5.0] Cota não atingida (${ingestedCount}/${this.MAX_DAILY_GAMES}). Buscando preenchimento...`);
      // Aqui poderíamos buscar ligas regionais ou de volume (ex: Liga 2 da França, Championship, etc.)
      // Para este MVP, focamos na lógica de exaustão da cota.
    }

    return {
      date: today,
      totalIngested: ingestedCount,
      status: ingestedCount >= this.MAX_DAILY_GAMES ? "QUOTA_FULL" : "QUOTA_PARTIAL"
    };
  }
}
