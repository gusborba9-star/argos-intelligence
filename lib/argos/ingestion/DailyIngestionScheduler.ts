import { DataIngestionService } from "@/lib/core/DataIngestionService";
import { BatchQueueService, QueueStatus } from "@/lib/core/BatchQueueService";
import { FixtureValidator, ValidationStatus } from "@/lib/core/ArgosValidation";

/**
 * DAILY INGESTION SCHEDULER v5.1 — EVENT-DRIVEN HUNTER
 * Transforma o Argos em um caçador de jogos ativos, independente da liga.
 * Foco: Janela de Hoje + 72h.
 */
export class DailyIngestionScheduler {
  private dataIngestionService: DataIngestionService;
  private batchQueueService: BatchQueueService;
  private readonly MAX_DAILY_GAMES = 150; // Cota expandida para cobrir mais eventos
  
  constructor() {
    this.dataIngestionService = new DataIngestionService();
    this.batchQueueService = new BatchQueueService();
  }

  /**
   * Executa a curadoria agnóstica de jogos baseada em janelas de tempo
   */
  async scheduleDailyIngestion(): Promise<{ date: string; totalIngested: number; status: string; enqueuedMatchDetails: any[] }> {
    const today = new Date();
    const datesToFetch: string[] = [];
    
    // Argos v5.1: Janela de 72 horas (3 dias)
    for (let i = 0; i < 4; i++) { 
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        datesToFetch.push(d.toISOString().split("T")[0]);
    }

    console.log(`[Argos v5.1] Iniciando Caçada por Eventos (Hoje + 72h): ${datesToFetch.join(", ")}`);

    // 1. BUSCA AGNÓSTICA (Zero-League-Filter)
    // O Argos agora busca TODOS os eventos de futebol (soccer) disponíveis para as datas alvo.
    const allPotentialFixtures: any[] = [];
    
    // Buscamos eventos de futebol de forma aberta
    const fetchPromises = datesToFetch.map(date => 
        this.dataIngestionService.getFixturesAnyLeague('soccer', date, true)
            .catch(err => {
                console.error(`[Argos v5.1] Erro na caçada para data ${date}:`, err.message);
                return [];
            })
    );

    const results = await Promise.all(fetchPromises);
    allPotentialFixtures.push(...results.flat());

    if (allPotentialFixtures.length === 0) {
        console.warn(`[Argos v5.1] ALERTA: Mercado Inativo na Janela de 72h.`);
        return { date: datesToFetch.join(", "), totalIngested: 0, status: "MARKET_INACTIVE", enqueuedMatchDetails: [] };
    }

    console.log(`[Argos v5.1] Total de ${allPotentialFixtures.length} eventos capturados na rede.`);

    // 2. FILTRAGEM E PRIORIZAÇÃO POR STATUS E RELEVÂNCIA
    const processedMatchIds = new Set<string>();
    const discoveredFixtures: any[] = [];
    const eliteLeagues = [1, 2, 3, 11, 13, 15, 61, 71, 72, 73, 78, 94, 140];

    for (const fixture of allPotentialFixtures) {
        if (!fixture || !fixture.fixture || !fixture.teams || !fixture.league) continue;

        const matchId = fixture.fixture.id.toString();
        if (processedMatchIds.has(matchId)) continue;

        // Filtro de Status: Apenas jogos agendados ou ao vivo (Syndicate logic)
        const status = fixture.fixture.status.short;
        if (!['NS', 'LIVE', '1H', 'HT', '2H'].includes(status)) continue;

        // Validação de Integridade via FixtureValidator
        const validationResult = FixtureValidator.validate(fixture, today);
        const isElite = eliteLeagues.includes(fixture.league.id) || fixture.league.name.toLowerCase().includes("world cup");

        if (validationResult.status !== ValidationStatus.VALIDATED && !isElite) {
            continue;
        }

        discoveredFixtures.push(fixture);
        processedMatchIds.add(matchId);
    }

    // Priorização: Elite primeiro, depois o resto por horário de início
    const sortedFixtures = discoveredFixtures.sort((a, b) => {
        const isAElite = eliteLeagues.includes(a.league.id) ? 1 : 0;
        const isBElite = eliteLeagues.includes(b.league.id) ? 1 : 0;
        if (isAElite !== isBElite) return isBElite - isAElite;
        return new Date(a.fixture.date).getTime() - new Date(b.fixture.date).getTime();
    });

    // 3. ENFILEIRAMENTO (Cota de 150 jogos)
    const finalFixtures = sortedFixtures.slice(0, this.MAX_DAILY_GAMES);
    const enqueuedMatchDetails: any[] = [];
    let ingestedCount = 0;

    for (const fixture of finalFixtures) {
        const matchId = fixture.fixture.id.toString();
        const alreadyQueued = await this.batchQueueService.isAlreadyEnqueued(matchId);
        if (alreadyQueued) continue;

        await this.batchQueueService.enqueue(matchId, "ALL_MARKETS", [], undefined, QueueStatus.VALIDATED);
        
        enqueuedMatchDetails.push({
            id: matchId,
            home: fixture.teams.home.name,
            away: fixture.teams.away.name,
            league: fixture.league.name,
            date: fixture.fixture.date
        });
        ingestedCount++;
    }

    console.log(`[Argos v5.1] Caçada concluída: ${ingestedCount} jogos enfileirados.`);

    return {
      date: datesToFetch.join(", "),
      totalIngested: ingestedCount,
      status: ingestedCount >= this.MAX_DAILY_GAMES ? "QUOTA_FULL" : "QUOTA_PARTIAL",
      enqueuedMatchDetails
    };
  }
}
