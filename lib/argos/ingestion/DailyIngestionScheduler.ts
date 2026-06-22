import { DataIngestionService } from "@/lib/core/DataIngestionService";
import { LeagueValueScoreEngine, LeagueValueInput, LeagueValueScore, LeagueProfile } from "./LeagueValueScoreEngine";
import { BatchQueueService, QueueStatus } from "@/lib/core/BatchQueueService";
import { MarketVertical } from "../../core/ArgosUnifiedEngine";
import { FixtureValidator, ValidationStatus } from "@/lib/core/ArgosValidation";

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
    const datesToFetch: string[] = [];
    
    // Argos v5.0 Syndicate-Level: Janela de 72 horas (3 dias)
    for (let i = 0; i < 4; i++) { // Hoje + 3 dias futuros (cobrindo a janela de 72h)
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        datesToFetch.push(d.toISOString().split("T")[0]);
    }
    let ingestedCount = 0;
    const processedMatchIds = new Set<string>();
    const enqueuedMatchDetails: { id: string; home: string; away: string; league: string; date: string }[] = [];

    console.log(`[Argos v5.0] Iniciando curadoria diária para as datas: ${datesToFetch.join(", ")}...`);

    // 1. PRIORIDADE TIER 1: Ligas de Elite e Alto Valor
        // Argos v5.0: PIPELINE ADAPTATIVO (Descoberta Automática)
        // 1. Geração de Candidatos: Buscar todos os fixtures disponíveis para as datas alvo.
    const allPotentialFixtures: any[] = [];
    const priorityLeagues = ['soccer_epl', 'soccer_la_liga', 'soccer_serie_a', 'soccer_bundesliga', 'soccer_ligue_1', 'soccer_brazil_serie_a'];

    console.log(`[Argos v5.0] Disparando busca paralela para ${datesToFetch.length * priorityLeagues.length} combinações...`);

    // Criamos um array de promessas para todas as combinações de data e liga
    const fetchPromises = datesToFetch.flatMap(date => 
        priorityLeagues.map(sportKey => 
            this.dataIngestionService.getFixturesAnyLeague(sportKey, date, true)
                .catch(err => {
                    console.error(`[Argos v5.0] Erro ao buscar ${sportKey} para ${date}:`, err.message);
                    return [];
                })
        )
    );

    // Resolvemos todas as promessas e unificamos o resultado
    const results = await Promise.all(fetchPromises);
    allPotentialFixtures.push(...results.flat());

    console.log(`[Argos v5.0] Total de ${allPotentialFixtures.length} fixtures potenciais coletados.`);

    // 2. DESCOBERTA PURA (Argos v5.0 — Zero-Filter Discovery)
    // O Scheduler não decide mais o que é "bom". Ele apenas descobre o que existe.
    // Toda a inteligência de filtragem foi movida para o Gate Único no Orchestrator.
    const discoveredFixtures: any[] = [];
    for (const fixture of allPotentialFixtures) {
        if (!fixture || !fixture.fixture || !fixture.teams || !fixture.league) continue;

        const matchId = fixture.fixture.id.toString();
        if (processedMatchIds.has(matchId)) continue;

        // Deduplicação Técnica e Pre-Filter de Janela de Tempo (Regra de Produção)
        const timeToKickoffMinutes = (new Date(fixture.fixture.date).getTime() - today.getTime()) / (1000 * 60);
                // --- INÍCIO DA CORREÇÃO ---
const isWorldCup = fixture.league.name.toLowerCase().includes("world cup") || fixture.league.id === 1; // Ajuste o ID se necessário
let validationResult = FixtureValidator.validate(fixture, today);

if (isWorldCup) {
    console.log(`[Argos v5.0] Evento Prioridade Máxima detectado: ${fixture.league.name}. Forçando validação.`);
    validationResult = { status: ValidationStatus.VALIDATED, reason: "Force Override" };
}

if (validationResult.status !== ValidationStatus.VALIDATED) {
  console.log(`[Argos v5.0] Jogo ${matchId} rejeitado por: ${validationResult.reason}`);
  processedMatchIds.add(matchId);
  continue;
}
// --- FIM DA CORREÇÃO ---


        // Deduplicação Técnica e Pre-Filter de Janela de Tempo (Regra de Produção)
        // A janela de tempo agora é validada pelo FixtureValidator
        // if (timeToKickoffMinutes < 45 || timeToKickoffMinutes > 2880) continue;  

        discoveredFixtures.push(fixture);
        processedMatchIds.add(matchId);
    }

    console.log(`[Argos v5.0] ${discoveredFixtures.length} jogos descobertos e prontos para enfileiramento.`);

    // Argos v5.0: Priorização de Ligas de Elite (Copa do Mundo, Champions, Libertadores, Brasileirão A/B, etc.)
    const eliteLeagues = [1, 2, 3, 11, 13, 15, 61, 71, 72, 73, 78, 94, 140];
    const prioritizedFixtures = discoveredFixtures.sort((a, b) => {
        const isAElite = eliteLeagues.includes(a.league.id) ? 1 : 0;
        const isBElite = eliteLeagues.includes(b.league.id) ? 1 : 0;
        return isBElite - isAElite;
    });

    // Limitar à cota diária (100 jogos) para evitar explosão de fila e respeitar limites de API
    const finalFixtures = prioritizedFixtures.slice(0, this.MAX_DAILY_GAMES);

    for (const fixture of finalFixtures) {
        const matchId = fixture.fixture.id.toString();
        const alreadyQueued = await this.batchQueueService.isAlreadyEnqueued(matchId);
        if (alreadyQueued) continue;

        // Enfileirar para análise completa. O Orchestrator decidirá a profundidade via operationalDensity.
                // Enfileirar para análise completa. O Orchestrator decidirá a profundidade via operationalDensity.
        // O segundo argumento (verticals) será usado para a chave única operacional, mas por enquanto é vazio.
                // Enfileirar para análise completa. O Orchestrator decidirá a profundidade via operationalDensity.
        // Por enquanto, enfileiramos com um marketFamily genérico. O Orchestrator irá expandir.
        await this.batchQueueService.enqueue(matchId, "ALL_MARKETS", [], undefined, QueueStatus.VALIDATED);
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
