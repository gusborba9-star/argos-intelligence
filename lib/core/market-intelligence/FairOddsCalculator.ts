import { NormalizedMarket } from "./MarketNormalizer";

// ============================================================
// FAIR ODDS CALCULATOR — MARKET REFERENCE ONLY
// ============================================================
// This module describes the market; it never produces a model probability.
// "Fair" here means overround-normalized market probability, not Argos model
// probability. Evidence quality is explicit metadata and is never exposed as
// a probability/confidence value.

export interface MarketEvidence {
  source: "PINNACLE_SHARP" | "WEIGHTED_CONSENSUS";
  bookmakerCount: number;
  sharpBookmakerPresent: boolean;
  divergence: number;
}

export interface FairLineResult {
  fairOdd: number;
  fairProbability: number;
  margin: number;
  source: MarketEvidence["source"];
  evidence: MarketEvidence;
  marketConsensusProbability: number;
}

const BOOKMAKER_WEIGHTS: Record<string, number> = {
  pinnacle: 1.00,
  matchbook: 0.90,
  smarkets: 0.90,
  betfair: 0.85,
  bet365: 0.75,
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
  public static calculate(
    markets: NormalizedMarket[],
    vertical: string,
    selection: string,
    line: number,
  ): FairLineResult | null {
    const relevantMarkets = markets.filter(
      (m) => m.vertical === vertical && m.line === line,
    );

    if (relevantMarkets.length === 0) return null;

    const consensus = this.calculateWeightedConsensus(relevantMarkets, selection);
    if (!consensus) return null;

    const pinnacle = relevantMarkets.find((m) => m.bookmaker === "pinnacle");
    if (pinnacle) {
      const sharp = this.extractFromMarket(pinnacle, selection);
      if (sharp) {
        const divergence = Math.abs(sharp.fairProbability - consensus.fairProbability);
        const bookmakerCount = relevantMarkets.filter((m) =>
          m.outcomes.some((o) => o.selection.toLowerCase() === selection.toLowerCase()),
        ).length;

        return {
          fairOdd: sharp.fairOdd,
          fairProbability: sharp.fairProbability,
          margin: sharp.margin,
          source: "PINNACLE_SHARP",
          evidence: {
            source: "PINNACLE_SHARP",
            bookmakerCount,
            sharpBookmakerPresent: true,
            divergence,
          },
          marketConsensusProbability: consensus.fairProbability,
        };
      }
    }

    return consensus;
  }

  private static extractFromMarket(
    market: NormalizedMarket,
    selection: string,
  ): { fairOdd: number; fairProbability: number; margin: number } | null {
    const outcome = market.outcomes.find(
      (o) => o.selection.toLowerCase() === selection.toLowerCase(),
    );
    if (!outcome) return null;

    const totalImplied = market.outcomes.reduce((sum, o) => sum + o.impliedProb, 0);
    if (!Number.isFinite(totalImplied) || totalImplied <= 0) return null;

    const fairProbability = outcome.impliedProb / totalImplied;
    if (!Number.isFinite(fairProbability) || fairProbability <= 0 || fairProbability >= 1) return null;

    return {
      fairProbability,
      fairOdd: 1 / fairProbability,
      margin: totalImplied - 1,
    };
  }

  private static calculateWeightedConsensus(
    markets: NormalizedMarket[],
    selection: string,
  ): FairLineResult | null {
    let weightedProbSum = 0;
    let totalWeight = 0;
    let weightedMarginSum = 0;
    let bookmakerCount = 0;

    for (const market of markets) {
      const outcome = market.outcomes.find(
        (o) => o.selection.toLowerCase() === selection.toLowerCase(),
      );
      if (!outcome) continue;

      const overround = market.outcomes.reduce((sum, o) => sum + o.impliedProb, 0);
      if (!Number.isFinite(overround) || overround <= 0) continue;

      const fairProbability = outcome.impliedProb / overround;
      const weight = getBookmakerWeight(market.bookmaker);
      if (!Number.isFinite(fairProbability) || weight <= 0) continue;

      weightedProbSum += fairProbability * weight;
      weightedMarginSum += (overround - 1) * weight;
      totalWeight += weight;
      bookmakerCount += 1;
    }

    if (totalWeight <= 0) return null;

    const fairProbability = weightedProbSum / totalWeight;
    const margin = weightedMarginSum / totalWeight;
    if (!Number.isFinite(fairProbability) || fairProbability <= 0 || fairProbability >= 1) return null;

    const evidence: MarketEvidence = {
      source: "WEIGHTED_CONSENSUS",
      bookmakerCount,
      sharpBookmakerPresent: markets.some((m) => m.isSharp && m.bookmaker === "pinnacle"),
      divergence: 0,
    };

    return {
      fairProbability,
      fairOdd: 1 / fairProbability,
      margin,
      source: "WEIGHTED_CONSENSUS",
      evidence,
      marketConsensusProbability: fairProbability,
    };
  }
}
