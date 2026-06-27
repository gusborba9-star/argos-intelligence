import { NormalizedMarket } from "./MarketNormalizer";

// ============================================================
// FAIR ODDS CALCULATOR v6.0.0 — SYNDICATE MASTER EDITION
// Regra: Pinnacle possui maior peso por ser referência sharp.
// A diferença entre casas é usada como INFORMAÇÃO, nunca como filtro de descarte.
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
  bet365: 0.75, // Aumentado peso conforme solicitado (casas comparação)
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
   * IMPORTANTE: Nunca descarta o jogo por discrepância de linha.
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

    if (relevantMarkets.length === 0) {
      // Se não houver mercado na linha exata, o sistema deve continuar tentando outras linhas
      // em vez de descartar o jogo. O MarketDiscoveryEngine gerencia isso.
      return null;
    }

    // 1. Prioridade Pinnacle (Sharp Reference — maior peso de mercado)
    const pinnacle = relevantMarkets.find((m) => m.bookmaker === "pinnacle");
    
    // 2. Consenso Ponderado (Sempre calculado para servir de base de comparação/divergência)
    const consensus = this.calculateWeightedConsensus(relevantMarkets, selection);
    
    if (pinnacle) {
      const base = this.extractFromMarket(pinnacle, selection, "PINNACLE_SHARP");
      if (base) {
        // A discrepância entre Pinnacle e o resto do mercado (consenso) é informação valiosa.
        const divergence = consensus ? Math.abs(base.fairProb - consensus.fairProb) : 0;
        
        return {
          ...base,
          divergence,
          marketConsensus: consensus?.fairProb || base.fairProb,
        };
      }
    }

    // 3. Fallback: Se Pinnacle não disponível, usa o Consenso Ponderado (Betfair/Bet365/etc)
    return consensus;
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
      confidence: source.includes("PINNACLE") ? 0.98 : 0.88, // Confiança máxima para Pinnacle
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

    return {
      fairProb: avgFairProb,
      fairOdd: avgFairProb > 0 ? 1 / avgFairProb : 999,
      margin: avgMargin,
      confidence: Math.min(0.90, 0.50 + bookieCount * 0.05),
      source: "WEIGHTED_CONSENSUS",
      divergence: 0, // Consenso não tem divergência dele mesmo
      marketConsensus: avgFairProb,
    };
  }
}
