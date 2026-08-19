import { DataIngestionService } from "@/lib/core/DataIngestionService";
import { BatchQueueService, QueueStatus } from "@/lib/core/BatchQueueService";
import { MarketVertical } from "@/lib/core/ArgosUnifiedEngine";

// ============================================================
// DAILY INGESTION SCHEDULER v6.2.0
// Temporal integrity: only pre-match events within the publication
// maturity window are eligible for quantitative execution.
// ============================================================

// A 48h horizon is useful for discovery but too stale for a production
// prediction snapshot: injuries, lineups, prices and context can change
// materially before kickoff. Discovery may see farther ahead, but the
// quantitative queue must only admit matches inside this window.
export const MAX_ANALYSIS_HORIZON_HOURS = 24;

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

const SOCCER_KEYWORDS = [
  "soccer", "football", "futebol", "futbol",
  "premier", "champions", "bundesliga", "serie_a", "la_liga",
  "ligue", "eredivisie", "libertadores", "brasileirao",
];

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

  async scheduleDailyIngestion(): Promise<{ totalProcessed: number; status: string; details: any }> {
    console.log(`[Argos-v6.2] Starting temporal-maturity-safe discovery...`);
    const startTime = Date.now();

    try {
      const cleanupResult = await this.batchQueueService.cleanupQueue();
      const activeSports = await this.dataIngestionService.getActiveSports();
      const soccerSports = activeSports.filter((s: any) => this.isSoccer(s));

      if (soccerSports.length === 0) {
        return { totalProcessed: 0, status: "NO_SPORTS", details: { cleanupResult } };
      }

      let totalProcessed = 0;
      const processedByLeague: Record<string, number> = {};
      const CONCURRENCY = 14;
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
              return { sportKey, events };
            } catch (err: any) {
              console.error(`[Argos-Discovery] Erro em ${sportKey}:`, err.message);
              return { sportKey, events: [] as any[] };
            }
          })
        );

        for (const { events } of batchResults) {
          for (const event of events) {
            // Temporal maturity is a correctness constraint. A match can be
            // discovered earlier, but it must not enter quantitative execution
            // until it is close enough to kickoff for the snapshot to remain
            // materially relevant.
            if (!this.isWithinAnalysisHorizon(event)) continue;
            const score = this.calculatePriorityScore(event);
            if (score < 2) continue;
            const leagueTitle = event.sport_title || event.league?.name || "unknown";
            allScoredEvents.push({ event, score, leagueTitle });
          }
        }
      }

      allScoredEvents.sort((a, b) => {
        const timeA = this.hoursToStart(a.event);
        const timeB = this.hoursToStart(b.event);
        return timeA - timeB || b.score - a.score;
      });

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
      return {
        totalProcessed,
        status: "SUCCESS",
        details: {
          executionTimeMs: executionTime,
          soccerSportsFound: soccerSports.length,
          processedByLeague,
          cleanupResult,
          analysisHorizonHours: MAX_ANALYSIS_HORIZON_HOURS,
        },
      };
    } catch (error: any) {
      console.error("[Argos-v6.2] Erro crítico no Scheduler:", error.message);
      return { totalProcessed: 0, status: "FAILED", details: { error: error.message } };
    }
  }

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
    return SOCCER_KEYWORDS.some((kw) => key.includes(kw) || group.includes(kw) || title.includes(kw));
  }

  private hoursToStart(event: any): number {
    const commence = new Date(event.commence_time || event.fixture?.date || NaN).getTime();
    if (!Number.isFinite(commence)) return Number.POSITIVE_INFINITY;
    return (commence - Date.now()) / (1000 * 60 * 60);
  }

  private isWithinAnalysisHorizon(event: any): boolean {
    const hours = this.hoursToStart(event);
    return Number.isFinite(hours) && hours >= 0 && hours <= MAX_ANALYSIS_HORIZON_HOURS;
  }

  private calculatePriorityScore(event: any): number {
    let score = 0;
    const hoursToStart = this.hoursToStart(event);
    if (!Number.isFinite(hoursToStart) || hoursToStart < 0 || hoursToStart > MAX_ANALYSIS_HORIZON_HOURS) return 0;

    if (hoursToStart <= 6) score += 4;
    else if (hoursToStart <= 12) score += 3;
    else score += 2;

    const title = (
      event.sport_title || event.league?.name || event.competition?.name || ""
    ).toLowerCase();
    if (ELITE_LEAGUE_KEYWORDS.some((kw) => title.includes(kw))) score += 2;

    const bookies = event.bookmakers || [];
    const hasSharp = bookies.some((b: any) =>
      ["pinnacle", "betfair", "matchbook", "smarkets"].includes((b.key || "").toLowerCase())
    );
    if (hasSharp) score += 2;

    const totalMarkets = bookies.reduce(
      (sum: number, b: any) => sum + (b.markets?.length || 0), 0
    );
    if (totalMarkets >= 20) score += 2;
    else if (totalMarkets >= 10) score += 1;

    return score;
  }
}
