import { DataIngestionService } from "@/lib/core/DataIngestionService";
import { BatchQueueService, QueueStatus } from "@/lib/core/BatchQueueService";
import { MarketVertical } from "@/lib/core/ArgosUnifiedEngine";
import { ANALYSIS_HORIZON_HOURS, evaluateAnalysisHorizon } from "@/lib/core/contracts/AnalysisHorizon";

// Canonical discovery/execution horizon. The queue imports the same contract.
export const MAX_ANALYSIS_HORIZON_HOURS = ANALYSIS_HORIZON_HOURS;

const ALL_MANDATORY_VERTICALS: MarketVertical[] = [MarketVertical.WINNER, MarketVertical.HANDICAP, MarketVertical.GOALS, MarketVertical.GOALS_HT, MarketVertical.BTTS, MarketVertical.CORNERS, MarketVertical.CARDS, MarketVertical.SHOTS, MarketVertical.SHOTS_ON_TARGET];
const SOCCER_KEYWORDS = ["soccer", "football", "futebol", "futbol", "premier", "champions", "bundesliga", "serie_a", "la_liga", "ligue", "eredivisie", "libertadores", "brasileirao"];
const ELITE_LEAGUE_KEYWORDS = ["world_cup", "world cup", "premier_league", "premier league", "champions_league", "champions league", "libertadores", "serie_a", "bundesliga", "la_liga", "ligue_1", "brazil", "brasileirao", "copa_do_brasil"];

export class DailyIngestionScheduler {
  private dataIngestionService: DataIngestionService;
  private batchQueueService: BatchQueueService;
  private readonly MAX_DAILY_GAMES = 200;

  constructor() { this.dataIngestionService = new DataIngestionService(); this.batchQueueService = new BatchQueueService(); }

  async scheduleDailyIngestion(): Promise<{ totalProcessed: number; status: string; details: any }> {
    const startTime = Date.now();
    try {
      const cleanupResult = await this.batchQueueService.cleanupQueue();
      const soccerSports = (await this.dataIngestionService.getActiveSports()).filter((s: any) => this.isSoccer(s));
      if (soccerSports.length === 0) return { totalProcessed: 0, status: "NO_SPORTS", details: { cleanupResult } };
      let totalProcessed = 0;
      const processedByLeague: Record<string, number> = {};
      const allScoredEvents: { event: any; score: number; leagueTitle: string }[] = [];

      for (let i = 0; i < soccerSports.length; i += 14) {
        const batchResults = await Promise.all(soccerSports.slice(i, i + 14).map(async (sport: any) => {
          try {
            if (!(await this.dataIngestionService.checkFreshness(sport.key))) return { events: [] as any[] };
            return { events: await this.dataIngestionService.getMegaCallOdds(sport.key) };
          } catch (err: any) { console.error(`[Argos-Discovery] Erro em ${sport.key}:`, err.message); return { events: [] as any[] }; }
        }));
        for (const { events } of batchResults) for (const event of events) {
          if (!this.isWithinAnalysisHorizon(event)) continue;
          const score = this.calculatePriorityScore(event);
          if (score >= 2) allScoredEvents.push({ event, score, leagueTitle: event.sport_title || event.league?.name || "unknown" });
        }
      }

      allScoredEvents.sort((a, b) => this.hoursToStart(a.event) - this.hoursToStart(b.event) || b.score - a.score);
      for (const { event, score, leagueTitle } of allScoredEvents) {
        if (totalProcessed >= this.MAX_DAILY_GAMES) break;
        const matchId = (event.id || event.fixture?.id || event.match_id).toString();
        try {
          await this.batchQueueService.enqueue(matchId, "ALL_MARKETS", ALL_MANDATORY_VERTICALS, event, QueueStatus.QUEUED, score);
          processedByLeague[leagueTitle] = (processedByLeague[leagueTitle] || 0) + 1;
          totalProcessed++;
        } catch (error: any) { console.log(`[Argos-Discovery] ${matchId} já na fila ou erro: ${error.message}`); }
      }
      return { totalProcessed, status: "SUCCESS", details: { executionTimeMs: Date.now() - startTime, soccerSportsFound: soccerSports.length, processedByLeague, cleanupResult, analysisHorizonHours: MAX_ANALYSIS_HORIZON_HOURS } };
    } catch (error: any) { console.error("[Argos-v6.2] Erro crítico no Scheduler:", error.message); return { totalProcessed: 0, status: "FAILED", details: { error: error.message } }; }
  }

  async collectHistoricalScores(): Promise<{ sportsProcessed: number; totalUpdated: number }> {
    const soccerSports = (await this.dataIngestionService.getActiveSports()).filter((s: any) => this.isSoccer(s));
    const results = await Promise.all(soccerSports.map((sport: any) => this.dataIngestionService.updateTeamFormFromScores(sport.key).catch(() => 0)));
    return { sportsProcessed: soccerSports.length, totalUpdated: results.reduce((a: number, b: number) => a + b, 0) };
  }

  private isSoccer(sport: any): boolean { const key = (sport.key || "").toLowerCase(), group = (sport.group || "").toLowerCase(), title = (sport.title || sport.sport_title || "").toLowerCase(); return SOCCER_KEYWORDS.some((kw) => key.includes(kw) || group.includes(kw) || title.includes(kw)); }
  private hoursToStart(event: any): number { const commence = new Date(event.commence_time || event.fixture?.date || NaN).getTime(); return Number.isFinite(commence) ? (commence - Date.now()) / 3600000 : Number.POSITIVE_INFINITY; }
  private isWithinAnalysisHorizon(event: any): boolean { return evaluateAnalysisHorizon(event?.commence_time || event?.fixture?.date || NaN).eligible; }
  private calculatePriorityScore(event: any): number {
    const hoursToStart = this.hoursToStart(event); if (!Number.isFinite(hoursToStart) || hoursToStart < 0 || hoursToStart > MAX_ANALYSIS_HORIZON_HOURS) return 0;
    let score = hoursToStart <= 6 ? 4 : hoursToStart <= 12 ? 3 : 2;
    const title = (event.sport_title || event.league?.name || event.competition?.name || "").toLowerCase();
    if (ELITE_LEAGUE_KEYWORDS.some((kw) => title.includes(kw))) score += 2;
    if ((event.bookmakers || []).some((b: any) => ["pinnacle", "betfair", "matchbook", "smarkets"].includes((b.key || "").toLowerCase()))) score += 2;
    const totalMarkets = (event.bookmakers || []).reduce((sum: number, b: any) => sum + (b.markets?.length || 0), 0);
    if (totalMarkets >= 20) score += 2; else if (totalMarkets >= 10) score += 1;
    return score;
  }
}
