import { NormalizedMarket } from "./MarketNormalizer";

export interface FairLineResult {
  fairOdd: number;
  fairProb: number;
  margin: number;
  confidence: number;
  source: string;
}

export class FairOddsCalculator {
  /**
   * Calcula a odd justa baseada no peso do mercado, priorizando Pinnacle e Betfair.
   */
  public static calculate(markets: NormalizedMarket[], vertical: string, selection: string, line: number): FairLineResult | null {
    const relevantMarkets = markets.filter(m => 
      m.vertical === vertical && 
      m.line === line
    );

    if (relevantMarkets.length === 0) return null;

    // 1. Prioridade Pinnacle (Sharp Reference)
    const pinnacle = relevantMarkets.find(m => m.bookmaker === 'pinnacle');
    if (pinnacle) {
      return this.extractFromMarket(pinnacle, selection, "PINNACLE_SHARP");
    }

    // 2. Prioridade Betfair (Exchange Reference)
    const betfair = relevantMarkets.find(m => m.bookmaker === 'betfair');
    if (betfair) {
      return this.extractFromMarket(betfair, selection, "BETFAIR_EXCHANGE");
    }

    // 3. Média Ponderada (Consenso de Mercado)
    return this.calculateMarketConsensus(relevantMarkets, selection);
  }

  private static extractFromMarket(market: NormalizedMarket, selection: string, source: string): FairLineResult | null {
    const outcome = market.outcomes.find(o => o.selection === selection);
    if (!outcome) return null;

    // Cálculo simplificado de remoção de vigorish (overround)
    const totalImplied = market.outcomes.reduce((sum, o) => sum + o.impliedProb, 0);
    const fairProb = outcome.impliedProb / totalImplied;

    return {
      fairProb,
      fairOdd: 1 / fairProb,
      margin: totalImplied - 1,
      confidence: 0.9,
      source
    };
  }

  private static calculateMarketConsensus(markets: NormalizedMarket[], selection: string): FairLineResult | null {
    let totalProb = 0;
    let count = 0;
    let totalMargin = 0;

    for (const m of markets) {
      const outcome = m.outcomes.find(o => o.selection === selection);
      if (outcome) {
        const overround = m.outcomes.reduce((sum, o) => sum + o.impliedProb, 0);
        totalProb += outcome.impliedProb / overround;
        totalMargin += (overround - 1);
        count++;
      }
    }

    if (count === 0) return null;

    const avgFairProb = totalProb / count;
    return {
      fairProb: avgFairProb,
      fairOdd: 1 / avgFairProb,
      margin: totalMargin / count,
      confidence: Math.min(0.8, 0.5 + (count * 0.05)),
      source: "MARKET_CONSENSUS"
    };
  }
}
