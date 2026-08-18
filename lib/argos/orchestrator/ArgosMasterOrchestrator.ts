import { MarketNormalizer } from "../../core/market-intelligence/MarketNormalizer";
import { FairOddsCalculator } from "../../core/market-intelligence/FairOddsCalculator";
import { OddsValueEngine } from "../../core/market-intelligence/OddsValueEngine";
import { ModelFactory } from "../../core/ModelFactory";
import { AsianHandicapSettlementEngine } from "../../core/market-intelligence/AsianHandicapSettlementEngine";
import { FeatureEngine } from "../../core/FeatureEngine";
import { DataIngestionService } from "../../core/DataIngestionService";
import { RAGContextEngine } from "../regime/RAGContextEngine";
import { SignalDistributionEngine } from "../../core/market-intelligence/SignalDistributionEngine";
import { MarketVertical } from "../../core/ArgosUnifiedEngine";
import { getSupabaseClient } from "../../core/SupabaseClient";
import { apiFootballService } from "../../core/ApiFootballService";

const MAX_ANALYSIS_HORIZON_HOURS = 48;

export class ArgosMasterOrchestrator {
  private static readonly VERSION = "6.3.2-MASTER";
  private static readonly MIN_REAL_SAMPLE = 1;
  private static readonly MAX_PLAUSIBLE_EV = 1.0;
  private static readonly MAX_ODD_MARKET_REFERENCE_RATIO = 3.0;

  public static async run(matchId: string, rawData: any) {
    console.log(`[ArgosMaster] Starting v${this.VERSION}: ${matchId}`);

    const kickoff = rawData.commence_time ? new Date(rawData.commence_time).getTime() : null;
    if (kickoff && kickoff < Date.now() - 10 * 60 * 1000) return { status: "SKIPPED_EXPIRED", matchId };
    if (!kickoff || !Number.isFinite(kickoff)) return { status: "SKIPPED_INVALID_KICKOFF", matchId };
    const hoursToKickoff = (kickoff - Date.now()) / (1000 * 60 * 60);
    if (hoursToKickoff > MAX_ANALYSIS_HORIZON_HOURS) {
      console.log(`[ArgosMaster] Skipping ${matchId}: kickoff is ${hoursToKickoff.toFixed(1)}h away, horizon=${MAX_ANALYSIS_HORIZON_HOURS}h.`);
      return { status: "SKIPPED_OUTSIDE_ANALYSIS_HORIZON", matchId, hoursToKickoff, maxHours: MAX_ANALYSIS_HORIZON_HOURS };
    }

    const leagueIdentifier = String(rawData.league_id ?? rawData.sport_key ?? rawData.sport_title ?? "unknown_league");
    const normalizedMarkets = MarketNormalizer.normalize(rawData);
    const report = MarketNormalizer.generateReport(normalizedMarkets);
    console.log(`[ArgosMaster] Markets=${report.totalMarkets} sharp=${report.hasSharpReference}`);

    const ragEngine = new RAGContextEngine(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, process.env.GOOGLE_AI_API_KEY!);
    const context = await ragEngine.retrieveContext(matchId, leagueIdentifier);
    // External context is evidence, not an arbitrary probability multiplier.
    // Until a calibrated feature model exists for motivation/absence impact,
    // it must not move the scoring mean directly.
    const regime = { variance_multiplier: context.lesoes.length > 0 || context.clima !== "Condições normais" ? 1.3 : 1.1, model_bias: 0, market_regime: "NEUTRAL" };

    const dataService = new DataIngestionService();
    const sportKey = rawData.sport_key || leagueIdentifier;
    const [homeHistory, awayHistory] = await Promise.all([dataService.getRealTeamHistory(sportKey, rawData.home_team), dataService.getRealTeamHistory(sportKey, rawData.away_team)]);
    const hasRealData = homeHistory.length >= this.MIN_REAL_SAMPLE && awayHistory.length >= this.MIN_REAL_SAMPLE;
    const features = FeatureEngine.generateFeatureVector({ ...rawData, homeHistory: rawData.homeHistory?.length ? rawData.homeHistory : homeHistory, awayHistory: rawData.awayHistory?.length ? rawData.awayHistory : awayHistory });

    const [homeExtra, awayExtra] = await Promise.all([dataService.getTeamExtraStats(sportKey, rawData.home_team), dataService.getTeamExtraStats(sportKey, rawData.away_team)]);
    const hasExtraStats = !!homeExtra && !!awayExtra;
    const countStatProbabilities: Record<string, Record<string, number>> = {};
    if (homeExtra && awayExtra) {
      const cornersHomeMean = (homeExtra.cornersFor + awayExtra.cornersAgainst) / 2;
      const cornersAwayMean = (awayExtra.cornersFor + homeExtra.cornersAgainst) / 2;
      const cardsHomeMean = (homeExtra.cardsFor + awayExtra.cardsAgainst) / 2;
      const cardsAwayMean = (awayExtra.cardsFor + homeExtra.cardsAgainst) / 2;
      countStatProbabilities[MarketVertical.CORNERS] = ModelFactory.runCountStatSimulation(cornersHomeMean, cornersAwayMean, [7.5, 8.5, 9.5, 10.5, 11.5, 12.5]);
      countStatProbabilities[MarketVertical.CARDS] = ModelFactory.runCountStatSimulation(cardsHomeMean, cardsAwayMean, [2.5, 3.5, 4.5, 5.5, 6.5]);
    }

    let h2hSummary: any = null;
    if (hasRealData) { try { h2hSummary = await apiFootballService.getH2HSummary(rawData.home_team, rawData.away_team); } catch { h2hSummary = null; } }
    const verticalsToAnalyze = [MarketVertical.WINNER, MarketVertical.HANDICAP, MarketVertical.GOALS, MarketVertical.GOALS_HT, MarketVertical.BTTS, MarketVertical.CORNERS, MarketVertical.CARDS];
    const opportunities: any[] = [];

    // Expected scoring rate is an attack/defence fusion, not simply the team's
    // own recent goals. This prevents a high-scoring team facing a strong
    // defence from being treated as if its raw attacking average were the
    // match lambda, one of the principal sources of inflated tail probabilities.
    const homeAttack = features.homeMetrics.goals;
    const homeDefence = features.homeMetrics.goalsAgainst;
    const awayAttack = features.awayMetrics.goals;
    const awayDefence = features.awayMetrics.goalsAgainst;
    const expectedHomeGoals = Math.max(0.05, (homeAttack + awayDefence) / 2);
    const expectedAwayGoals = Math.max(0.05, (awayAttack + homeDefence) / 2);

    for (const vertical of verticalsToAnalyze) {
      if (!hasRealData && [MarketVertical.GOALS, MarketVertical.GOALS_HT, MarketVertical.BTTS, MarketVertical.HANDICAP].includes(vertical)) continue;
      if ([MarketVertical.CORNERS, MarketVertical.CARDS].includes(vertical) && !hasExtraStats) continue;
      const isCountStatVertical = [MarketVertical.CORNERS, MarketVertical.CARDS].includes(vertical);
      const isHandicap = vertical === MarketVertical.HANDICAP;
      const simulation = isCountStatVertical ? { probabilities: countStatProbabilities[vertical] || {} } : isHandicap ? null : await ModelFactory.runMonteCarloWithLearning({ homeMean: expectedHomeGoals, awayMean: expectedAwayGoals }, regime as any, leagueIdentifier, vertical as any);
      const selections = this.getSelectionsForVertical(vertical, normalizedMarkets, rawData.home_team, rawData.away_team);
      const handicapPoints = isHandicap ? [...new Set(selections.filter((s): s is HandicapSelection => s.kind === "handicap").map((s) => s.point))] : [];
      const handicapSettlement = isHandicap ? AsianHandicapSettlementEngine.simulate(expectedHomeGoals, expectedAwayGoals, regime as any, handicapPoints) : {};

      for (const selection of selections) {
        const marketReference = FairOddsCalculator.calculate(normalizedMarkets, vertical, selection.label, selection.line);
        if (!marketReference) continue;
        const marketOdd = this.getBestMarketOdd(normalizedMarkets, vertical, selection.label, selection.line);
        if (marketOdd === null) continue;

        let modelProbability: number;
        let valueAnalysis: any;
        if (selection.kind === "handicap") {
          const settlement = handicapSettlement[`${selection.side}_${selection.point}`];
          if (!settlement) continue;
          modelProbability = this.clipProbability(settlement.win);
          valueAnalysis = OddsValueEngine.calculateAsianHandicapValue(modelProbability, settlement.push, marketOdd, marketReference.fairOdd);
        } else {
          const rawProb = simulation?.probabilities[selection.key];
          if (rawProb === undefined || !Number.isFinite(rawProb)) continue;
          modelProbability = this.clipProbability(rawProb);
          valueAnalysis = OddsValueEngine.calculateValue(modelProbability, marketOdd, marketReference.fairOdd);
        }

        const modelFairOdd = 1 / modelProbability;
        const marketFairOdd = marketReference.fairOdd;
        const marketReferenceRatio = marketFairOdd > 0 ? marketOdd / marketFairOdd : 1;
        if (valueAnalysis.expectedValue > this.MAX_PLAUSIBLE_EV || marketReferenceRatio > this.MAX_ODD_MARKET_REFERENCE_RATIO || marketReferenceRatio < 1 / this.MAX_ODD_MARKET_REFERENCE_RATIO) {
          await this.logAnomaly({ match_id: matchId, vertical, selection: selection.label, line: selection.line, odd: marketOdd, fair_odd: modelFairOdd, market_reference_odd: marketFairOdd, probability: modelProbability, expected_value: valueAnalysis.expectedValue, reason: valueAnalysis.expectedValue > this.MAX_PLAUSIBLE_EV ? "EV_ABOVE_CEILING" : "MARKET_REFERENCE_DIVERGENCE" });
          continue;
        }

        opportunities.push({ vertical, selection: selection.label, line: selection.line, handicapPoint: selection.kind === "handicap" ? selection.point : undefined, probability: modelProbability, modelProbability, pushProbability: valueAnalysis.pushProbability ?? 0, lossProbability: valueAnalysis.lossProbability, modelFairOdd, fairOdd: modelFairOdd, marketReferenceOdd: marketFairOdd, fairSource: marketReference.source, marketReferenceProbability: this.clipProbability(marketReference.marketConsensus ?? marketReference.fairProb), marketConsensusProbability: marketReference.marketConsensus ?? null, marketDivergence: marketReference.divergence ?? 0, odd: marketOdd, expectedValue: valueAnalysis.expectedValue, edge: valueAnalysis.edge, edgePercent: valueAnalysis.edgePercent, kellyCriterion: valueAnalysis.kellyCriterion, ratingLabel: valueAnalysis.ratingLabel, hasEdge: valueAnalysis.isPositive, sampleSize: isCountStatVertical ? Math.min(homeExtra?.sampleSize || 0, awayExtra?.sampleSize || 0) : Math.min(homeHistory.length, awayHistory.length), h2hMatches: h2hSummary?.matchesPlayed ?? 0 });
      }
    }

    const analysisSummary = this.generateDeepAnalysis(context, features, opportunities);
    if (opportunities.length > 0) await SignalDistributionEngine.processAndDispatch(opportunities.map((op) => ({ ...op, analysisSummary })), regime as any, { matchId, name: `${rawData.home_team} vs ${rawData.away_team}`, homeTeam: rawData.home_team, awayTeam: rawData.away_team, league: features.leagueProfile.name, kickoff: rawData.commence_time || rawData.kickoff_at || null });
    return { status: "SUCCESS", version: this.VERSION, matchId, opportunitiesFound: opportunities.length, timestamp: new Date().toISOString() };
  }

  private static clipProbability(probability: number): number { return Math.max(0.03, Math.min(0.97, probability)); }
  private static async logAnomaly(payload: Record<string, unknown>): Promise<void> { try { await getSupabaseClient().from("argos_anomaly_log").insert(payload); } catch {} }

  private static getSelectionsForVertical(vertical: MarketVertical, normalizedMarkets: any[], homeTeam?: string, awayTeam?: string): Selection[] {
    switch (vertical) {
      case MarketVertical.WINNER: return [{ kind: "standard", key: "home", label: "Home", line: 0 }, { kind: "standard", key: "draw", label: "Draw", line: 0 }, { kind: "standard", key: "away", label: "Away", line: 0 }];
      case MarketVertical.GOALS: {
        const lines = new Set<number>(normalizedMarkets.filter((m) => m.vertical === vertical).map((m) => m.line).filter((l: number) => Number.isFinite(l)));
        return [...lines].flatMap((line) => [{ kind: "standard", key: `over_${line}`, label: "Over", line }, { kind: "standard", key: `under_${line}`, label: "Under", line }]);
      }
      case MarketVertical.CORNERS:
      case MarketVertical.CARDS: {
        const lines = new Set<number>(normalizedMarkets.filter((m) => m.vertical === vertical).map((m) => m.line).filter((l: number) => Number.isFinite(l)));
        return [...lines].flatMap((line) => [{ kind: "standard", key: `over_${line}`, label: "Over", line }, { kind: "standard", key: `under_${line}`, label: "Under", line }]);
      }
      case MarketVertical.BTTS: return [{ kind: "standard", key: "btts_yes", label: "Yes", line: 0 }, { kind: "standard", key: "btts_no", label: "No", line: 0 }];
      case MarketVertical.HANDICAP: {
        if (!homeTeam || !awayTeam) return [];
        const selections: HandicapSelection[] = [];
        const seen = new Set<string>();
        normalizedMarkets.filter((m) => m.vertical === vertical).forEach((m) => m.outcomes.forEach((o: any) => {
          const rawPoint = Number(o.point ?? m.line);
          if (!Number.isFinite(rawPoint)) return;
          const dedupeKey = `${o.selection}|${rawPoint}`;
          if (seen.has(dedupeKey)) return;
          seen.add(dedupeKey);
          if (o.selection === homeTeam) selections.push({ kind: "handicap", key: `home_${rawPoint}`, label: homeTeam, line: Math.abs(rawPoint), point: rawPoint, side: "home" });
          else if (o.selection === awayTeam) selections.push({ kind: "handicap", key: `away_${rawPoint}`, label: awayTeam, line: Math.abs(rawPoint), point: rawPoint, side: "away" });
        }));
        return selections;
      }
      default: return [];
    }
  }

  private static getBestMarketOdd(normalizedMarkets: any[], vertical: MarketVertical, selectionLabel: string, line: number): number | null {
    const candidates = normalizedMarkets.filter((m) => m.vertical === vertical && m.line === line).flatMap((m) => m.outcomes).filter((o: any) => o.selection.toLowerCase() === selectionLabel.toLowerCase()).map((o: any) => o.odd).filter((odd: number) => Number.isFinite(odd) && odd >= 1.35 && odd < 100);
    return candidates.length > 0 ? Math.max(...candidates) : null;
  }

  private static generateDeepAnalysis(context: any, features: any, opportunities: any[]): string {
    let summary = opportunities.length > 3 ? "O modelo identificou múltiplas oportunidades quantitativas independentes. " : "O modelo identificou uma oportunidade quantitativa pontual. ";
    if (context.lesoes.length > 0) summary += `Contexto de ausências: ${context.lesoes.slice(0, 2).join(", ")}. `;
    if (features.homeRecentForm > 0.7) summary += "Dominância recente do mandante foi incorporada como contexto. ";
    summary += "Probabilidade, fair odd do modelo, preço de mercado, EV e Kelly pertencem à mesma cadeia quantitativa canônica.";
    return summary;
  }
}

type StandardSelection = { kind: "standard"; key: string; label: string; line: number };
type HandicapSelection = { kind: "handicap"; key: string; label: string; line: number; point: number; side: "home" | "away" };
type Selection = StandardSelection | HandicapSelection;
