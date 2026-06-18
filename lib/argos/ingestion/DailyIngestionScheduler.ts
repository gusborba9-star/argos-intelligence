import { DataIngestionService } from "@/lib/core/DataIngestionService";
import { BatchQueueService } from "@/lib/core/BatchQueueService";
import { MarketVertical } from "../../core/ArgosUnifiedEngine";

/**
 * DAILY INGESTION SCHEDULER v5.0
 * Gerencia a cota diária de 100 jogos, priorizando ligas de elite.
 */
export class DailyIngestionScheduler {
  private dataIngestionService: DataIngestionService;
  private batchQueueService: BatchQueueService;
  private readonly MAX_DAILY_GAMES = 500; // Aumentado para prospecção ativa mundial

  constructor() {
    this.dataIngestionService = new DataIngestionService();
    this.batchQueueService = new BatchQueueService();
  }

  /**
   * Executa a curadoria diária de jogos
   */
  async scheduleDailyIngestion(): Promise<{ date: string; totalIngested: number; processedMatchIds: string[]; status: string; enqueuedMatchDetails: { id: string; home: string; away: string; league: string; date: string }[] }> {
    const today = new Date();
    const datesToFetch = [];
    for (let i = 0; i < 2; i++) { // Foco em hoje e amanhã para maior precisão
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        datesToFetch.push(d.toISOString().split("T")[0]);
    }
    let ingestedCount = 0;
    const processedMatchIds = new Set<string>();
    const enqueuedMatchDetails: { id: string; home: string; away: string; league: string; date: string }[] = [];

    console.log(`[Argos v5.0] Iniciando curadoria diária para as datas: ${datesToFetch.join(", ")}...`);

    // 1. PRIORIDADE ELITE: Buscar jogos das ligas de maior liquidez
    const priorityLeagues = this.dataIngestionService.getPriorityLeagues();
    
    // Execução paralela para buscar fixtures das ligas prioritárias
    const fixturePromises: Promise<any[]>[] = [];
    for (const date of datesToFetch) {
        for (const league of priorityLeagues) {
            fixturePromises.push(
                this.dataIngestionService.getFixturesByLeague(league.id, date)
                    .catch(err => {
                        console.error(`[Argos v5.0] Erro ao buscar liga ${league.name} para ${date}:`, err.message);
                        return [];
                    })
            );
        }
    }

    const allFixtures = (await Promise.allSettled(fixturePromises))
        .filter(result => result.status === 'fulfilled')
        .map(result => (result as PromiseFulfilledResult<any[]>).value);

    for (const fixtures of allFixtures) {
      for (const fixture of fixtures) {
        if (ingestedCount >= this.MAX_DAILY_GAMES) break;

        if (!fixture || !fixture.fixture || !fixture.teams || !fixture.league) {
            console.warn(`[Argos v5.0] Fixture incompleta ou inválida encontrada, pulando: ${JSON.stringify(fixture)}`);
            continue;
        }

        const matchId = fixture.fixture.id.toString();
        if (!processedMatchIds.has(matchId)) {
          // Verificar se já está no Supabase para evitar duplicatas industriais
          const alreadyQueued = await this.batchQueueService.isAlreadyEnqueued(matchId);
          if (alreadyQueued) {
            console.log(`[Argos v5.0] Jogo ${matchId} já está na fila. Pulando.`);
            continue;
          }

          await this.batchQueueService.enqueue(matchId, Object.values(MarketVertical)); // Todas as verticais
          processedMatchIds.add(matchId);
          enqueuedMatchDetails.push({
              id: matchId,
              home: fixture.teams.home.name,
              away: fixture.teams.away.name,
              league: fixture.league.name,
              date: fixture.fixture.date
          });
          ingestedCount++;
        }
      }
      if (ingestedCount >= this.MAX_DAILY_GAMES) break;
    }

    console.log(`[Argos v5.0] Curadoria Elite concluída: ${ingestedCount} jogos.`);

    // 2. PREENCHIMENTO: Se a cota não foi atingida, buscar em ligas menores/qualquer liga
    if (ingestedCount < this.MAX_DAILY_GAMES) {
      console.log(`[Argos v5.0] Cota não atingida (${ingestedCount}/${this.MAX_DAILY_GAMES}). Buscando preenchimento em ligas diversas...`);
      for (const date of datesToFetch) {
        if (ingestedCount >= this.MAX_DAILY_GAMES) break;
        let anyFixtures: any[] = [];
        try {
            anyFixtures = await this.dataIngestionService.getFixturesAnyLeague(date);
        } catch (err: any) {
            console.error(`[Argos v5.0] Erro ao buscar jogos de qualquer liga para ${date}:`, err.message);
        }
        for (const fixture of anyFixtures) {
          if (ingestedCount >= this.MAX_DAILY_GAMES) break;

          if (!fixture || !fixture.fixture || !fixture.teams || !fixture.league) {
              console.warn(`[Argos v5.0] Fixture incompleta ou inválida encontrada no preenchimento, pulando: ${JSON.stringify(fixture)}`);
              continue;
          }

          const matchId = fixture.fixture.id.toString();
          if (!processedMatchIds.has(matchId)) {
            try {
              // Verificar se já está no Supabase
              const alreadyQueued = await this.batchQueueService.isAlreadyEnqueued(matchId);
              if (alreadyQueued) {
                console.log(`[Argos v5.0] Jogo ${matchId} já está na fila (preenchimento). Pulando.`);
                continue;
              }

              await this.batchQueueService.enqueue(matchId, Object.values(MarketVertical));
            } catch (enqueueError: any) {
              console.error(`[Argos v5.0] Erro ao enfileirar jogo ${matchId}:`, enqueueError.message);
              continue; // Pular para o próximo jogo se o enfileiramento falhar
            }
            processedMatchIds.add(matchId);
            enqueuedMatchDetails.push({
                id: matchId,
                home: fixture.teams.home.name,
                away: fixture.teams.away.name,
                league: fixture.league.name,
                date: fixture.fixture.date
            });
            ingestedCount++;
          }
        }
      }
    }

    return {
      date: datesToFetch.join(", "),
      totalIngested: ingestedCount,
      processedMatchIds: Array.from(processedMatchIds),
      status: ingestedCount >= this.MAX_DAILY_GAMES ? "QUOTA_FULL" : "QUOTA_PARTIAL",
      enqueuedMatchDetails: enqueuedMatchDetails
    };
  }
}
