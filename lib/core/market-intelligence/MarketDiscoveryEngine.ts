import { NormalizedMarket } from "./MarketNormalizer";
import { FairOddsCalculator } from "./FairOddsCalculator";
import { OddsValueEngine } from "./OddsValueEngine";
import { MarketVertical } from "../ArgosUnifiedEngine";

// ============================================================
// MARKET DISCOVERY ENGINE v6.0.0 — SYNDICATE MASTER EDITION
// Regra: A partida só é descartada após varredura completa.
// Se Winner não possui valor, executar TODOS os outros mercados.
// Inclui: vencedor, empate, handicap, dupla chance, empate anula,
// over/under, gols HT, ambas marcam, gols equipe, escanteios,
// cartões, jogadores (gols, assistência, chute).
// ============================================================

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
}

export interface DiscoveryReport {
  totalOpportunities: number;
  positiveEVCount: number;
  eliteCount: number;
  verticalBreakdown: Record<string, number>;
  discardedReason?: string;
}

// Mercados obrigatórios para varredura completa (Syndicate Master)
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
   * Varre TODOS os mercados normalizados e identifica oportunidades de valor.
   * A partida só é descartada após varredura completa de todos os mercados.
   */
  public static discover(
    normalizedMarkets: NormalizedMarket[],
    modelPredictions: { [key: string]: number }
  ): Opportunity[] {
    const opportunities: Opportunity[] = [];

    // Agrupa mercados por vertical para garantir cobertura completa
    const verticalsCovered = new Set(normalizedMarkets.map((m) => m.vertical));
    const missingMandatory = MANDATORY_VERTICALS.filter((v) => !verticalsCovered.has(v));

    if (missingMandatory.length > 0) {
      console.log(
        `[MarketDiscovery] Mercados obrigatórios sem cobertura de odds: ${missingMandatory.join(", ")}`
      );
    }

    for (const market of normalizedMarkets) {
      // REGRA MASTER: Analisar todos os mercados disponíveis.
      for (const outcome of market.outcomes) {
        // 1. Calcular Fair Line do Mercado
        const fairLine = FairOddsCalculator.calculate(
          normalizedMarkets,
          market.vertical,
          outcome.selection,
          market.line
        );

        if (!fairLine) continue;

        // 2. Obter Probabilidade do Modelo
        const selectionKey = outcome.selection.toUpperCase().replace(/\s+/g, "_");
        const modelProb =
          modelPredictions[`${market.vertical}_${selectionKey}_${market.line}`] ||
          modelPredictions[`${market.vertical}_${outcome.selection}_${market.line}`] ||
          modelPredictions[`${market.vertical}_${outcome.selection}_0`] ||
          fairLine.fairProb; // Fallback: usa fair prob como estimativa do modelo

        // 3. Calcular EV Real
        const value = OddsValueEngine.calculateValue(modelProb, outcome.odd, fairLine.fairOdd);

        // 4. Mapear Oportunidade
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
        });
      }
    }

    return opportunities;
  }

  /**
   * Gera relatório de discovery para auditoria e debug.
   */
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
      discardedReason: opportunities.length === 0 ? "NO_MARKETS_AVAILABLE" : undefined,
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
      betway: 0.55,
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
