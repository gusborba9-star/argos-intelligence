import { NormalizedMarket } from "./MarketNormalizer";
import { FairOddsCalculator } from "./FairOddsCalculator";
import { OddsValueEngine } from "./OddsValueEngine";

export interface Opportunity {
  market: string;
  vertical: string;
  line: number;
  selection: string;
  bookmaker: string;
  odd: number;
  fairOdd: number;
  probability: number;
  expectedValue: number;
  edge: number;
  confidence: number;
  liquidity: number;
  risk: number;
  source: string;
}

export class MarketDiscoveryEngine {
  /**
   * Varre todos os mercados normalizados e identifica oportunidades de valor.
   */
  public static discover(
    normalizedMarkets: NormalizedMarket[], 
    modelPredictions: { [key: string]: number } // Mapeamento vertical_selection_line -> prob
  ): Opportunity[] {
    const opportunities: Opportunity[] = [];

    for (const market of normalizedMarkets) {
      for (const outcome of market.outcomes) {
        // 1. Calcular Fair Line do Mercado
        const fairLine = FairOddsCalculator.calculate(
          normalizedMarkets, 
          market.vertical, 
          outcome.selection, 
          market.line
        );

        if (!fairLine) continue;

        // 2. Obter Probabilidade do Modelo (se disponível)
        // O modelo deve prover probabilidades para as mesmas seleções/linhas
        const modelProb = modelPredictions[`${market.vertical}_${outcome.selection}_${market.line}`] || fairLine.fairProb;

        // 3. Calcular EV Real
        const value = OddsValueEngine.calculateValue(modelProb, outcome.odd);

        // 4. Mapear Oportunidade
        opportunities.push({
          market: market.marketName,
          vertical: market.vertical,
          line: market.line,
          selection: outcome.selection,
          bookmaker: market.bookmaker,
          odd: outcome.odd,
          fairOdd: fairLine.fairOdd,
          probability: modelProb,
          expectedValue: value.expectedValue,
          edge: value.edge,
          confidence: fairLine.confidence,
          liquidity: this.estimateLiquidity(market.bookmaker),
          risk: this.calculateRisk(value.edge, fairLine.confidence),
          source: fairLine.source
        });
      }
    }

    return opportunities;
  }

  private static estimateLiquidity(bookmaker: string): number {
    const weights: { [key: string]: number } = {
      'pinnacle': 1.0,
      'betfair': 0.9,
      'bet365': 0.8,
      'draftkings': 0.7,
      'fanduel': 0.7
    };
    return weights[bookmaker.toLowerCase()] || 0.5;
  }

  private static calculateRisk(edge: number, confidence: number): number {
    // Risco inverso: quanto maior o edge e maior a confiança, menor o risco percebido
    const baseRisk = 1.0;
    const edgeBonus = Math.max(0, edge * 2);
    const confidenceBonus = confidence;
    return Math.max(0.1, baseRisk - edgeBonus - confidenceBonus);
  }
}
