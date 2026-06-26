import { NormalizedMarket } from "./MarketNormalizer";

// ============================================================
// FAIR ODDS CALCULATOR v6.0.0 — SYNDICATE MASTER EDITION
// Regra: Pinnacle possui maior peso por ser referência sharp.
// Calcula: fair odds, margem removida, consenso, divergência.
// ============================================================

export interface FairLineResult {
  fairOdd: number;
  fairProb: number;
  margin: number;
  confidence: number;
  source: string;
  divergence?: number; // Divergência entre casas (0 = consenso total)
  marketConsensus?: number; // Probabilidade média de consenso
}

// Pesos por bookmaker (sharp reference > exchange > soft)
const BOOKMAKER_WEIGHTS: Record<string, number> = {
  pinnacle: 1.00,
  matchbook: 0.90,
  smarkets: 0.90,
  betfair: 0.85,
  bet365: 0.70,
  bwin: 0.65,
  unibet: 0.65,
  draftkings: 0.60,
  fanduel: 0.60,
  williamhill: 0.60,
  betway: 0.55,
};

function getBookmakerWeight(bookmaker: string): number {
  return BOOKMAKER_WEIGHTS[bookmaker.toLowerCase()] ?? 0.50;
}

export class FairOddsCalculator {
  /**
   * Calcula a odd justa priorizando Pinnacle (sharp reference).
   * Caso Pinnacle não exista, usa consenso ponderado das melhores casas.
   */
  public static calculate(
    markets: NormalizedMarket[],
    vertical: string,
    selection: string,
    line: number
  ): FairLineResult | null {
    const relevantMarkets = markets.filter(
      (m) => m.vertical === vertical && m.line === line
    );

    if (relevantMarkets.length === 0) return null;

    // 1. Prioridade Pinnacle (Sharp Reference — maior peso de mercado)
    const pinnacle = relevantMarkets.find((m) => m.bookmaker === "pinnacle");
    if (pinnacle) {
      const base = this.extractFromMarket(pinnacle, selection, "PINNACLE_SHARP");
      if (base) {
        return {
          ...base,
          divergence: this.calculateDivergence(relevantMarkets, selection, base.fairProb),
          marketConsensus: this.calculateConsensusProb(relevantMarkets, selection),
        };
      }
    }

    // 2. Betfair Exchange (segunda referência sharp)
    const betfair = relevantMarkets.find((m) => m.bookmaker === "betfair");
    if (betfair) {
      const base = this.extractFromMarket(betfair, selection, "BETFAIR_EXCHANGE");
      if (base) {
        return {
          ...base,
          divergence: this.calculateDivergence(relevantMarkets, selection, base.fairProb),
          marketConsensus: this.calculateConsensusProb(relevantMarkets, selection),
        };
      }
    }

    // 3. Consenso Ponderado das melhores casas disponíveis
    return this.calculateWeightedConsensus(relevantMarkets, selection);
  }

  /**
   * Extrai fair line de um mercado específico removendo o overround.
   */
  private static extractFromMarket(
    market: NormalizedMarket,
    selection: string,
    source: string
  ): FairLineResult | null {
    const outcome = market.outcomes.find(
      (o) => o.selection.toLowerCase() === selection.toLowerCase()
    );
    if (!outcome) return null;

    const totalImplied = market.outcomes.reduce((sum, o) => sum + o.impliedProb, 0);
    if (totalImplied <= 0) return null;

    const fairProb = outcome.impliedProb / totalImplied;
    const margin = totalImplied - 1;

    return {
      fairProb,
      fairOdd: fairProb > 0 ? 1 / fairProb : 999,
      margin,
      confidence: source.includes("PINNACLE") ? 0.95 : 0.88,
      source,
    };
  }

  /**
   * Consenso ponderado por peso de bookmaker.
   * Garante que casas mais sharp tenham maior influência na fair line.
   */
  private static calculateWeightedConsensus(
    markets: NormalizedMarket[],
    selection: string
  ): FairLineResult | null {
    let weightedProbSum = 0;
    let totalWeight = 0;
    let weightedMarginSum = 0;

    for (const m of markets) {
      const outcome = m.outcomes.find(
        (o) => o.selection.toLowerCase() === selection.toLowerCase()
      );
      if (!outcome) continue;

      const overround = m.outcomes.reduce((sum, o) => sum + o.impliedProb, 0);
      if (overround <= 0) continue;

      const fairProb = outcome.impliedProb / overround;
      const weight = getBookmakerWeight(m.bookmaker);

      weightedProbSum += fairProb * weight;
      weightedMarginSum += (overround - 1) * weight;
      totalWeight += weight;
    }

    if (totalWeight === 0) return null;

    const avgFairProb = weightedProbSum / totalWeight;
    const avgMargin = weightedMarginSum / totalWeight;
    const bookieCount = markets.filter((m) =>
      m.outcomes.some((o) => o.selection.toLowerCase() === selection.toLowerCase())
    ).length;

    const divergence = this.calculateDivergence(markets, selection, avgFairProb);

    return {
      fairProb: avgFairProb,
      fairOdd: avgFairProb > 0 ? 1 / avgFairProb : 999,
      margin: avgMargin,
      confidence: Math.min(0.85, 0.45 + bookieCount * 0.06),
      source: "WEIGHTED_CONSENSUS",
      divergence,
      marketConsensus: avgFairProb,
    };
  }

  /**
   * Calcula a divergência entre as casas (dispersão de probabilidades).
   * Alta divergência = mercado menos eficiente = maior potencial de edge.
   */
  private static calculateDivergence(
    markets: NormalizedMarket[],
    selection: string,
    referenceFairProb: number
  ): number {
    const probs: number[] = [];

    for (const m of markets) {
      const outcome = m.outcomes.find(
        (o) => o.selection.toLowerCase() === selection.toLowerCase()
      );
      if (!outcome) continue;

      const overround = m.outcomes.reduce((sum, o) => sum + o.impliedProb, 0);
      if (overround > 0) probs.push(outcome.impliedProb / overround);
    }

    if (probs.length < 2) return 0;

    const mean = probs.reduce((a, b) => a + b, 0) / probs.length;
    const variance = probs.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / probs.length;
    return parseFloat(Math.sqrt(variance).toFixed(4));
  }

  /**
   * Calcula a probabilidade de consenso simples (média não ponderada).
   */
  private static calculateConsensusProb(
    markets: NormalizedMarket[],
    selection: string
  ): number {
    const probs: number[] = [];

    for (const m of markets) {
      const outcome = m.outcomes.find(
        (o) => o.selection.toLowerCase() === selection.toLowerCase()
      );
      if (!outcome) continue;

      const overround = m.outcomes.reduce((sum, o) => sum + o.impliedProb, 0);
      if (overround > 0) probs.push(outcome.impliedProb / overround);
    }

    if (probs.length === 0) return 0;
    return probs.reduce((a, b) => a + b, 0) / probs.length;
  }
}
