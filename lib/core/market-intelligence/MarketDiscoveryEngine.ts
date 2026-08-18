import { NormalizedMarket } from "./MarketNormalizer";
import { FairOddsCalculator } from "./FairOddsCalculator";
import { OddsValueEngine } from "./OddsValueEngine";
import { MarketVertical } from "../ArgosUnifiedEngine";

// ============================================================
// MARKET DISCOVERY ENGINE v6.1.0 — COMPATIBILITY / AUDIT PATH
// ============================================================
// IMPORTANT: This engine is not the canonical v6.2 production orchestrator.
// It remains available for compatibility/audit consumers, but it must never
// manufacture a model probability from the market fair probability. A market
// reference is evidence about the market, not an independent model forecast.

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
  confidence: number;
  liquidity: number;
  risk: number;
  source: string;
  divergence?: number;
  kellyCriterion?: number;
  ratingLabel?: string;
  hasEdge?: boolean;
  modelProbabilitySource?: string;
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
  MarketVertical.SAVES
];

export class MarketDiscoveryEngine {
  /**
   * Varre mercados disponíveis e identifica oportunidades somente quando uma
   * probabilidade de modelo independente foi fornecida.
   *
   * Antes havia um fallback silencioso para `fairLine.fairProb`. Isso fazia o
   * engine transformar uma estimativa derivada do próprio mercado em
   * "probabilidade do modelo", podendo fabricar EV artificialmente.
   */
  public static discover(
    normalizedMarkets: NormalizedMarket[],
    modelPredictions: { [key: string]: number }
  ): Opportunity[] {
    const opportunities: Opportunity[] = [];

    const verticalsCovered = new Set(normalizedMarkets.map((m) => m.vertical));
    const missingMandatory = MANDATORY_VERTICALS.filter((v) => !verticalsCovered.has(v));

    if (missingMandatory.length > 0) {
      console.log(
        `[MarketDiscovery] Mercados obrigatórios sem cobertura de odds: ${missingMandatory.join(", ")}`
      );
    }

    for (const market of normalizedMarkets) {
      for (const outcome of market.outcomes) {
        const fairLine = FairOddsCalculator.calculate(
          normalizedMarkets,
          market.vertical,
          outcome.selection,
          market.line
        );

        if (!fairLine) continue;

        const selectionKey = outcome.selection.toUpperCase().replace(/\s+/g, "_");
        const candidateKeys = [
          `${market.vertical}_${selectionKey}_${market.line}`,
          `${market.vertical}_${outcome.selection}_${market.line}`,
          `${market.vertical}_${outcome.selection}_0`
        ];
        const modelKey = candidateKeys.find(
          (key) => Number.isFinite(modelPredictions[key])
        );

        // HARD INTEGRITY RULE: no independent model probability means no EV
        // signal. The market fair probability remains available through
        // FairOddsCalculator for reference, but it cannot impersonate the model.
        if (!modelKey) continue;

        const modelProb = modelPredictions[modelKey];
        if (!Number.isFinite(modelProb) || modelProb < 0 || modelProb > 1) continue;

        const value = OddsValueEngine.calculateValue(modelProb, outcome.odd, fairLine.fairOdd);

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
          confidence: fairLine.confidence,
          liquidity: this.estimateLiquidity(market.bookmaker, market.isSharp),
          risk: this.calculateRisk(value.edge, fairLine.confidence),
          source: fairLine.source,
          divergence: fairLine.divergence,
          kellyCriterion: value.kellyCriterion,
          ratingLabel: value.ratingLabel,
          modelProbabilitySource: "EXPLICIT_MODEL_PREDICTION"
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
      discardedReason: opportunities.length === 0 ? "NO_INDEPENDENT_MODEL_PROBABILITY" : undefined
    };
  }

  private static estimateLiquidity(bookmaker: string, isSharp: boolean): number {
    if (isSharp) return bookmaker === "pinnacle" ? 1.0 : 0.9;
    const weights: Record<string, number> = {
      bet365: 0.85,
      betfair: 0.85,
      bwin: 0.70,
      unibet: 0.65,
      draftkings: 0.65,
      fanduel: 0.65,
      williamhill: 0.60,
      betway: 0.55
    };
    return weights[bookmaker.toLowerCase()] ?? 0.50;
  }

  private static calculateRisk(edge: number, confidence: number): number {
    const baseRisk = 1.0;
    const edgeBonus = Math.max(0, edge * 2);
    const confidenceBonus = confidence * 0.5;
    return parseFloat(Math.max(0.05, baseRisk - edgeBonus - confidenceBonus).toFixed(4));
  }
}
