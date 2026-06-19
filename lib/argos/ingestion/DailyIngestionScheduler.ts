import { DataIngestionService } from "@/lib/core/DataIngestionService";
import { LeagueValueScoreEngine, LeagueValueInput, LeagueProfile } from "./LeagueValueScoreEngine";
import { BatchQueueService } from "@/lib/core/BatchQueueService";
import { MarketVertical } from "../../core/ArgosUnifiedEngine";

/**
 * DAILY INGESTION SCHEDULER v5.0
 * Gerencia a cota diária de 100 jogos, priorizando ligas de elite.
 */
export class DailyIngestionScheduler {
  private dataIngestionService: DataIngestionService;
  private batchQueueService: BatchQueueService;
  private readonly MAX_DAILY_GAMES = 100; // Cota otimizada para ligas de alto valor
  private readonly MIN_SCORE_TO_QUEUE = 55; // Score mínimo para ser enfileirado // Cota otimizada para ligas de alto valor

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
    for (let i = 0; i < 3; i++) { // Expandido: Hoje, Amanhã e Depois (Caçador de oportunidades futuras)
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        datesToFetch.push(d.toISOString().split("T")[0]);
    }
    let ingestedCount = 0;
    const processedMatchIds = new Set<string>();
    const enqueuedMatchDetails: { id: string; home: string; away: string; league: string; date: string }[] = [];

    console.log(`[Argos v5.0] Iniciando curadoria diária para as datas: ${datesToFetch.join(", ")}...`);

    // 1. PRIORIDADE TIER 1: Ligas de Elite e Alto Valor
        // 1. Geração de Candidatos: Coletar todos os fixtures potenciais sem filtragem inicial agressiva
    const allPotentialFixtures: any[] = [];
    const priorityLeagues = this.dataIngestionService.getPriorityLeagues();

    const fixturePromises: Promise<any[]>[] = [];
    for (const date of datesToFetch) {
        // Buscar ligas prioritárias
        for (const league of priorityLeagues) {
            fixturePromises.push(
                this.dataIngestionService.getFixturesByLeague(league.id, date)
                    .catch(err => {
                        console.error(`[Argos v5.0] Erro ao buscar liga ${league.name} para ${date}:`, err.message);
                        return [];
                    })
            );
        }
        // Buscar ligas diversas para preenchimento inicial (antes da filtragem inteligente)
        fixturePromises.push(
            this.dataIngestionService.getFixturesAnyLeague(date)
                .catch(err => {
                    console.error(`[Argos v5.0] Erro ao buscar jogos de qualquer liga para ${date}:`, err.message);
                    return [];
                })
        );
    }

    const settledResults = await Promise.allSettled(fixturePromises);
    settledResults.forEach(result => {
        if (result.status === 'fulfilled') {
            allPotentialFixtures.push(...result.value);
        }
    });

    console.log(`[Argos v5.0] Total de ${allPotentialFixtures.length} fixtures potenciais coletados.`);

    // 2. Avaliação e Filtragem com LeagueValueScoreEngine
    const rankedFixtures: { fixture: any; score: LeagueValueScore }[] = [];
    for (const fixture of allPotentialFixtures) {
        if (!fixture || !fixture.fixture || !fixture.teams || !fixture.league) {
            console.warn(`[Argos v5.0] Fixture incompleta ou inválida encontrada, pulando: ${JSON.stringify(fixture)}`);
            continue;
        }

        const timeToKickoffMinutes = (new Date(fixture.fixture.date).getTime() - today.getTime()) / (1000 * 60);
        const leagueStats: LeagueProfile = this.dataIngestionService.getLeagueProfile(fixture.league.id) || {
            id: fixture.league.id,
            name: fixture.league.name,
            tier: "Tier 4",
            historicalLiquidity: 50000,
            oddsDispersion: 5,
            avgGoals: 2.5,
            avgCorners: 10,
            avgCards: 3,
            historicalEVPlus: 0.02,
        };

        const marketContext = {
            saturation: 0.5, // Mock
            calendarPressure: 0.3, // Mock
        };

        const evaluationInput: LeagueValueInput = {
            fixture,
            leagueStats,
            marketContext,
            timeToKickoffMinutes,
        };

        const score = LeagueValueScoreEngine.evaluate(evaluationInput);

        if (score.priorityTier !== "DROP" && score.valueScore >= this.MIN_SCORE_TO_QUEUE) {
            rankedFixtures.push({ fixture, score });
        }
    }

    // 3. Ordenar e selecionar os melhores jogos
    rankedFixtures.sort((a, b) => b.score.valueScore - a.score.valueScore);

    const topFixturesToEnqueue = rankedFixtures.slice(0, this.MAX_DAILY_GAMES);

    console.log(`[Argos v5.0] ${topFixturesToEnqueue.length} jogos selecionados para enfileiramento após avaliação.`);

    for (const { fixture, score } of topFixturesToEnqueue) {
        const matchId = fixture.fixture.id.toString();
        if (!processedMatchIds.has(matchId)) {
            const alreadyQueued = await this.batchQueueService.isAlreadyEnqueued(matchId);
            if (alreadyQueued) {
                console.log(`[Argos v5.0] Jogo ${matchId} já está na fila. Pulando.`);
                continue;
            }

            let verticalsToEnqueue = Object.values(MarketVertical);
            if (score.recommendedAction === "QUEUE_REDUCED") {
                // Lógica para selecionar mercados de alta eficiência
                verticalsToEnqueue = [MarketVertical.OVER_UNDER, MarketVertical.MATCH_ODDS]; // Exemplo
            } else if (score.recommendedAction === "SKIP") {
                // Lógica para 1-2 verticais filtradas
                verticalsToEnqueue = [MarketVertical.MATCH_ODDS]; // Exemplo
            }

            await this.batchQueueService.enqueue(matchId, verticalsToEnqueue);
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

    console.log(`[Argos v5.0] Curadoria inteligente concluída: ${ingestedCount} jogos enfileirados.`);

    return {
      date: datesToFetch.join(", "),
      totalIngested: ingestedCount,
      processedMatchIds: Array.from(processedMatchIds),
      status: ingestedCount >= this.MAX_DAILY_GAMES ? "QUOTA_FULL" : "QUOTA_PARTIAL",
      enqueuedMatchDetails: enqueuedMatchDetails
    };
  }
}
