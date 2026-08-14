import { DataIngestionService } from "@/lib/core/DataIngestionService";
import { BatchQueueService, QueueStatus } from "@/lib/core/BatchQueueService";
import { MarketVertical } from "@/lib/core/ArgosUnifiedEngine";

// ============================================================
// DAILY INGESTION SCHEDULER v6.0.0 — SYNDICATE MASTER EDITION
//
// Discovery Dinâmico — SEM listas fixas:
//   1. Descobre esportes ativos via API
//   2. Identifica futebol por chave/grupo
//   3. Avalia liquidez (sharp bookmakers presentes)
//   4. Prioriza jogos com maior densidade operacional
//   5. Enfileira com payload completo (Single-Pass)
//   6. Executa limpeza automática da fila
// ============================================================

// Todos os mercados obrigatórios para varredura completa
const ALL_MANDATORY_VERTICALS: MarketVertical[] = [
  MarketVertical.WINNER,
  MarketVertical.HANDICAP,
  MarketVertical.GOALS,
  MarketVertical.GOALS_HT,
  MarketVertical.BTTS,
  MarketVertical.CORNERS,
  MarketVertical.CARDS,
  MarketVertical.SHOTS,
  MarketVertical.SHOTS_ON_TARGET,
];

// Palavras-chave para identificar futebol dinamicamente
const SOCCER_KEYWORDS = [
  "soccer", "football", "futebol", "futbol",
  "premier", "champions", "bundesliga", "serie_a", "la_liga",
  "ligue", "eredivisie", "libertadores", "brasileirao",
];

// Palavras-chave para ligas de elite (boost de prioridade)
const ELITE_LEAGUE_KEYWORDS = [
  "world_cup", "world cup", "premier_league", "premier league",
  "champions_league", "champions league", "libertadores",
  "serie_a", "bundesliga", "la_liga", "ligue_1",
  "brazil", "brasileirao", "copa_do_brasil",
];

export class DailyIngestionScheduler {
  private dataIngestionService: DataIngestionService;
  private batchQueueService: BatchQueueService;
  private readonly MAX_DAILY_GAMES = 200;

  constructor() {
    this.dataIngestionService = new DataIngestionService();
    this.batchQueueService = new BatchQueueService();
  }

  /**
   * Discovery Dinâmico Master v6.0.0.
   * Descobre esportes ativos, identifica futebol, avalia liquidez
   * e enfileira jogos com maior densidade operacional.
   */
  async scheduleDailyIngestion(): Promise<{ totalProcessed: number; status: string; details: any }> {
    console.log(`[Argos-v6] 🛰️ Iniciando Discovery Dinâmico Master...`);
    const startTime = Date.now();

    try {
      // ── ETAPA 1: Limpeza automática da fila ──────────────────────────────
      const cleanupResult = await this.batchQueueService.cleanupQueue();
      console.log(
        `[Argos-Cleanup] Removidos: ${cleanupResult.removed}`
      );

      // ── ETAPA 2: Descoberta de esportes ativos ───────────────────────────
      const activeSports = await this.dataIngestionService.getActiveSports();
      console.log(`[Argos-Discovery] ${activeSports.length} esportes ativos encontrados.`);

      // ── ETAPA 3: Identificação dinâmica de futebol ───────────────────────
      // Sem lista fixa — identifica por chave, grupo e título
      const soccerSports = activeSports.filter((s: any) => this.isSoccer(s));
      console.log(`[Argos-Discovery] ${soccerSports.length} modalidades de futebol identificadas.`);

      if (soccerSports.length === 0) {
        console.warn("[Argos-Discovery] Nenhum esporte de futebol ativo encontrado.");
        return { totalProcessed: 0, status: "NO_SPORTS", details: { cleanupResult } };
      }

      let totalProcessed = 0;
      const processedByLeague: Record<string, number> = {};
      const CONCURRENCY = 14; // 53.7s com 6 ficou perigosamente perto do teto de 55s — dobra a paralelização

      // ── ETAPA 4: Mega Call All-In por esporte (paralelizado) ─────────────
      // Antes: sequencial, 1 esporte de cada vez — 28 esportes x ~2 chamadas
      // cada facilmente passava de 55s e a rota era encerrada no meio.
      // Agora: lotes de 6 em paralelo, o tempo total cai proporcionalmente.
      const relevantSports = soccerSports.slice(0, this.MAX_DAILY_GAMES);
      const allScoredEvents: { event: any; score: number; leagueTitle: string }[] = [];

      for (let i = 0; i < relevantSports.length; i += CONCURRENCY) {
        const batch = relevantSports.slice(i, i + CONCURRENCY);

        const batchResults = await Promise.all(
          batch.map(async (sport: any) => {
            const sportKey = sport.key;
            try {
              const isFresh = await this.dataIngestionService.checkFreshness(sportKey);
              if (!isFresh) return { sportKey, events: [] as any[] };

              const events = await this.dataIngestionService.getMegaCallOdds(sportKey);
              console.log(`[Argos-Discovery] ${sportKey}: ${events.length} eventos encontrados.`);
              return { sportKey, events };
            } catch (err: any) {
              console.error(`[Argos-Discovery] Erro em ${sportKey}:`, err.message);
              return { sportKey, events: [] as any[] };
            }
          })
        );

        // Só ACUMULA aqui — não enfileira ainda. O corte por MAX_DAILY_GAMES
        // só pode ser aplicado DEPOIS de juntar e ordenar TODOS os esportes,
        // senão os primeiros esportes do lote esgotam a cota com jogos de
        // amanhã antes de esportes processados depois (que podem ter jogos
        // de HOJE) sequer serem considerados.
        for (const { events } of batchResults) {
          for (const event of events) {
            const score = this.calculatePriorityScore(event);
            if (score < 2) continue;
            const leagueTitle = event.sport_title || event.league?.name || "unknown";
            allScoredEvents.push({ event, score, leagueTitle });
          }
        }
      }

      // Ordenação GLOBAL por prioridade (proximidade do apito inicial pesa
      // mais que tudo) — só então aplica o limite diário.
      allScoredEvents.sort((a, b) => b.score - a.score);

      for (const { event, score, leagueTitle } of allScoredEvents) {
        if (totalProcessed >= this.MAX_DAILY_GAMES) break;

        const matchId = (event.id || event.fixture?.id || event.match_id).toString();

        try {
          await this.batchQueueService.enqueue(
            matchId,
            "ALL_MARKETS",
            ALL_MANDATORY_VERTICALS,
            event,
            QueueStatus.QUEUED,
            score
          );
          processedByLeague[leagueTitle] = (processedByLeague[leagueTitle] || 0) + 1;
          totalProcessed++;
        } catch (enqueueError: any) {
          console.log(`[Argos-Discovery] ${matchId} já na fila ou erro: ${enqueueError.message}`);
        }
      }

      const executionTime = Date.now() - startTime;
      console.log(
        `[Argos-v6] ✅ Discovery concluído. Eventos enfileirados: ${totalProcessed} em ${executionTime}ms`
      );
      console.log(`[Argos-v6] Distribuição por liga:`, processedByLeague);

      return {
        totalProcessed,
        status: "SUCCESS",
        details: {
          executionTimeMs: executionTime,
          soccerSportsFound: soccerSports.length,
          processedByLeague,
          cleanupResult,
        },
      };
    } catch (error: any) {
      console.error("[Argos-v6] Erro crítico no Scheduler:", error.message);
      return { totalProcessed: 0, status: "FAILED", details: { error: error.message } };
    }
  }

  /**
   * Identifica dinamicamente se um esporte é futebol.
   * Sem dependência de lista fixa — usa chave, grupo e título.
   */
  /**
   * Coleta de resultados reais (para calibrar o modelo com histórico
   * verdadeiro em vez de médias genéricas). Separado do ingest de odds
   * de propósito — antes disputava o mesmo orçamento de tempo/timeout
   * dentro do mesmo loop sequencial e nunca chegava a rodar.
   */
  async collectHistoricalScores(): Promise<{ sportsProcessed: number; totalUpdated: number }> {
    const activeSports = await this.dataIngestionService.getActiveSports();
    const soccerSports = activeSports.filter((s: any) => this.isSoccer(s));
    const CONCURRENCY = 6;
    let totalUpdated = 0;

    for (let i = 0; i < soccerSports.length; i += CONCURRENCY) {
      const batch = soccerSports.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map((sport: any) =>
          this.dataIngestionService.updateTeamFormFromScores(sport.key).catch((err: any) => {
            console.error(`[Argos-TeamForm] Erro em ${sport.key}:`, err.message);
            return 0;
          })
        )
      );
      totalUpdated += results.reduce((a: number, b: number) => a + b, 0);
    }

    return { sportsProcessed: soccerSports.length, totalUpdated };
  }

  private isSoccer(sport: any): boolean {
    const key = (sport.key || "").toLowerCase();
    const group = (sport.group || "").toLowerCase();
    const title = (sport.title || sport.sport_title || "").toLowerCase();

    return SOCCER_KEYWORDS.some(
      (kw) => key.includes(kw) || group.includes(kw) || title.includes(kw)
    );
  }

  /**
   * Calcula a pontuação de prioridade de um evento.
   * Considera: janela temporal, liga de elite, liquidez (sharp bookmakers).
   */
  private calculatePriorityScore(event: any): number {
    let score = 0;

    // ── Prioridade temporal (foco em 48h) ────────────────────────────────
    const commenceTime = new Date(
      event.commence_time || event.fixture?.date || Date.now()
    );
    const hoursToStart =
      (commenceTime.getTime() - Date.now()) / (1000 * 60 * 60);

    if (hoursToStart < 0) return 0; // Evento já iniciado — descarta
    if (hoursToStart <= 6) score += 4;
    else if (hoursToStart <= 24) score += 3;
    else if (hoursToStart <= 48) score += 2;
    else if (hoursToStart <= 96) score += 1;

    // ── Prioridade por liga de elite ─────────────────────────────────────
    const title = (
      event.sport_title ||
      event.league?.name ||
      event.competition?.name ||
      ""
    ).toLowerCase();

    if (ELITE_LEAGUE_KEYWORDS.some((kw) => title.includes(kw))) score += 2;

    // ── Prioridade por liquidez (sharp bookmakers) ───────────────────────
    const bookies = event.bookmakers || [];
    const hasSharp = bookies.some((b: any) =>
      ["pinnacle", "betfair", "matchbook", "smarkets"].includes(
        (b.key || "").toLowerCase()
      )
    );
    if (hasSharp) score += 2;

    // ── Prioridade por densidade de mercados ─────────────────────────────
    const totalMarkets = bookies.reduce(
      (sum: number, b: any) => sum + (b.markets?.length || 0),
      0
    );
    if (totalMarkets >= 20) score += 2;
    else if (totalMarkets >= 10) score += 1;

    return score;
  }
}
