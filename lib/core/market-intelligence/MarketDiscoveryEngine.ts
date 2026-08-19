import { NormalizedMarket } from "./MarketNormalizer";
import { FairOddsCalculator } from "./FairOddsCalculator";
import { OddsValueEngine } from "./OddsValueEngine";
import { MarketVertical } from "../ArgosUnifiedEngine";

// ============================================================
// MARKET DISCOVERY ENGINE — COMPATIBILITY / AUDIT PATH
// ============================================================
// Market evidence and model probability are deliberately separate contracts.
// This engine never converts market fair probability into a model forecast.

export interface Opportunity {
  market: string;
  vertical: string;
  line: number;
  selection: string;
  bookmaker: string;
  bookmakerTitle?: string;
  odd: number;
  fairOdd: number;
  probability: number;
  expectedValue: number;
  edge: number;
  edgePercent: number;
  liquidity: number;
  risk: number;
  source: string;
  divergence?: number;
  marketDivergence?: number;
  marketConsensusProbability?: number;
  kellyCriterion?: number;
  ratingLabel?: string;
  hasEdge?: boolean;
  modelProbabilitySource?: string;
  sampleSize?: number;
  fairSource?: string;
  calibrationSource?: string;
  pushProbability?: number;
  lossProbability?: number;
}

export interface DiscoveryReport {
  totalOpportunities: number;
  positiveEVCount: number;
  eliteCount: number;
  verticalBreakdown: Record<string, number>;
  discardedReason?: string;
}

const MANDATORY_VERTICALS: MarketVertical[] = [
  MarketVertical.WINNER,
  MarketVertical.HANDICAP,
  MarketVertical.GOALS,
  MarketVertical.GOALS_HT,
  MarketVertical.BTTS,
  MarketVertical.CORNERS,
  MarketVertical.CARDS,
  MarketVertical.SHOTS,
  MarketVertical.SHOTS_ON_TARGET,
  MarketVertical.FOULS,
  MarketVertical.TACKLES,
  MarketVertical.SAVES,
];

export class MarketDiscoveryEngine {
  public static discover(
    normalizedMarkets: NormalizedMarket[],
    modelPredictions: { [key: string]: number },
  ): Opportunity[] {
    const opportunities: Opportunity[] = [];
    const verticalsCovered = new Set(normalizedMarkets.map((m) => m.vertical));
    const missingMandatory = MANDATORY_VERTICALS.filter((v) => !verticalsCovered.has(v));

    if (missingMandatory.length > 0) {
      console.log(
        `[MarketDiscovery] Mercados obrigatórios sem cobertura de odds: ${missingMandatory.join(", ")}`,
      );
    }

    for (const market of normalizedMarkets) {
      for (const outcome of market.outcomes) {
        const fairLine = FairOddsCalculator.calculate(
          normalizedMarkets,
          market.vertical,
          outcome.selection,
          market.line,
        );
        if (!fairLine) continue;

        const selectionKey = outcome.selection.toUpperCase().replace(/\s+/g, "_");
        const candidateKeys = [
          `${market.vertical}_${selectionKey}_${market.line}`,
          `${market.vertical}_${outcome.selection}_${market.line}`,
          `${market.vertical}_${outcome.selection}_0`,
        ];
        const modelKey = candidateKeys.find((key) => Number.isFinite(modelPredictions[key]));

        // No independent model probability => no model EV signal.
        if (!modelKey) continue;

        const modelProb = modelPredictions[modelKey];
        if (!Number.isFinite(modelProb) || modelProb <= 0 || modelProb >= 1) continue;

        const value = OddsValueEngine.calculateValue(modelProb, outcome.odd, fairLine.fairOdd);
        const liquidity = this.estimateLiquidity(market.bookmaker, market.isSharp);

        opportunities.push({
          market: market.marketName,
          vertical: market.vertical,
          line: market.line,
          selection: outcome.selection,
          bookmaker: market.bookmaker,
          bookmakerTitle: market.bookmakerTitle,
          odd: outcome.odd,
          fairOdd: fairLine.fairOdd,
          probability: modelProb,
          expectedValue: value.expectedValue,
          edge: value.edge,
          edgePercent: value.edgePercent,
          liquidity,
          risk: this.calculateRisk(value.edge, liquidity, fairLine.evidence.divergence),
          source: fairLine.source,
          divergence: fairLine.evidence.divergence,
          marketDivergence: fairLine.evidence.divergence,
          marketConsensusProbability: fairLine.marketConsensusProbability,
          kellyCriterion: value.kellyCriterion,
          ratingLabel: value.ratingLabel,
          modelProbabilitySource: "EXPLICIT_MODEL_PREDICTION",
        });
      }
    }

    return opportunities;
  }

  public static generateReport(opportunities: Opportunity[]): DiscoveryReport {
    const positiveEV = opportunities.filter((o) => o.expectedValue > 0);
    const elite = opportunities.filter((o) => o.ratingLabel === "ELITE");
    const verticalBreakdown: Record<string, number> = {};

    for (const op of positiveEV) {
      verticalBreakdown[op.vertical] = (verticalBreakdown[op.vertical] || 0) + 1;
    }

    return {
      totalOpportunities: opportunities.length,
      positiveEVCount: positiveEV.length,
      eliteCount: elite.length,
      verticalBreakdown,
    };
  }

  private static estimateLiquidity(bookmaker: string, isSharp?: boolean): number {
    if (isSharp || bookmaker.toLowerCase() === "pinnacle") return 1;
    return 0.7;
  }

  private static calculateRisk(edge: number, liquidity: number, divergence: number): number {
    return Math.max(0, Math.min(1, 1 - Math.abs(edge) * 0.5 + divergence * 0.25 - liquidity * 0.15));
  }
}