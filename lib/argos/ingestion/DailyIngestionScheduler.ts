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

      // ── ETAPA 4: Mega Call All-In por esporte ────────────────────────────
      for (const sport of soccerSports) {
        if (totalProcessed >= this.MAX_DAILY_GAMES) break;

        const sportKey = sport.key;
        const isFresh = await this.dataIngestionService.checkFreshness(sportKey);
        if (!isFresh) {
          console.log(`[Argos-Discovery] ${sportKey} sem atualização recente, pulando.`);
          continue;
        }

        // Mega Call All-In: traz todo o payload (odds + mercados) em um hit
        const events = await this.dataIngestionService.getMegaCallOdds(sportKey);
        console.log(`[Argos-Discovery] ${sportKey}: ${events.length} eventos encontrados.`);

        // Coleta de resultados reais (para calibrar o modelo com histórico
        // verdadeiro em vez de médias genéricas). Throttled a 4x/dia
        // (00h,06h,12h,18h) — cada chamada de scores gasta ~1 request de
        // budget por esporte, então isso soma esse custo ao invés de
        // multiplicar por cron.
        if ([0, 6, 12, 18].includes(new Date().getUTCHours())) {
          await this.dataIngestionService.updateTeamFormFromScores(sportKey);
        }

        // ── ETAPA 5: Avaliação de liquidez e priorização ─────────────────
        const scoredEvents = events
          .map((event: any) => ({
            event,
            score: this.calculatePriorityScore(event),
          }))
          .filter(({ score }) => score >= 2) // Filtra eventos com baixa densidade operacional
          .sort((a, b) => b.score - a.score); // Ordena por prioridade decrescente

        // ── ETAPA 6: Enfileiramento com payload completo ─────────────────
        for (const { event, score } of scoredEvents) {
          if (totalProcessed >= this.MAX_DAILY_GAMES) break;

          const matchId = (
            event.id ||
            event.fixture?.id ||
            event.match_id
          ).toString();

          const leagueTitle = event.sport_title || event.league?.name || sportKey;

          try {
            await this.batchQueueService.enqueue(
              matchId,
              "ALL_MARKETS",
              ALL_MANDATORY_VERTICALS,
              event, // Payload completo — zero re-fetch
              QueueStatus.QUEUED,
              score
            );

            processedByLeague[leagueTitle] = (processedByLeague[leagueTitle] || 0) + 1;
            totalProcessed++;
          } catch (enqueueError: any) {
            // Duplicidade já tratada no BatchQueueService — apenas loga
            console.log(
              `[Argos-Discovery] ${matchId} já na fila ou erro: ${enqueueError.message}`
            );
          }
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
