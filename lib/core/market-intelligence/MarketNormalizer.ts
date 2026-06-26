import { MarketVertical } from "../ArgosUnifiedEngine";

export interface NormalizedMarket {
  vertical: MarketVertical;
  marketName: string;
  line: number;
  outcomes: {
    selection: string;
    odd: number;
    impliedProb: number;
  }[];
  bookmaker: string;
  lastUpdate: number;
}

export class MarketNormalizer {
  /**
   * Transforma o payload bruto da PropLine em uma estrutura padronizada para os modelos.
   */
  public static normalize(event: any): NormalizedMarket[] {
    const normalized: NormalizedMarket[] = [];
    const bookmakers = event.bookmakers || [];

    for (const bookie of bookmakers) {
      const bookieKey = bookie.key.toLowerCase();
      const markets = bookie.markets || [];

      for (const market of markets) {
        const vertical = this.mapToVertical(market.key);
        if (vertical === MarketVertical.UNKNOWN) continue;

        const outcomes = (market.outcomes || []).map((o: any) => ({
          selection: o.name,
          odd: o.price,
          impliedProb: 1 / o.price
        }));

        normalized.push({
          vertical,
          marketName: market.key,
          line: this.extractLine(market),
          outcomes,
          bookmaker: bookieKey,
          lastUpdate: bookie.last_update || Math.floor(Date.now() / 1000)
        });
      }
    }

    return normalized;
  }

  private static mapToVertical(key: string): MarketVertical {
    const k = key.toLowerCase();
    if (k.includes("h2h")) return MarketVertical.WINNER;
    if (k.includes("totals")) return MarketVertical.GOALS;
    if (k.includes("btts")) return MarketVertical.BTTS;
    if (k.includes("corners")) return MarketVertical.CORNERS;
    if (k.includes("cards")) return MarketVertical.CARDS;
    if (k.includes("shots_on_target")) return MarketVertical.SHOTS_ON_TARGET;
    if (k.includes("shots")) return MarketVertical.SHOTS;
    if (k.includes("handicap")) return MarketVertical.HANDICAP;
    return MarketVertical.UNKNOWN;
  }

  private static extractLine(market: any): number {
    // Tenta extrair a linha (ex: 2.5) de campos comuns da PropLine
    if (typeof market.line === 'number') return market.line;
    const outcomeWithPoint = market.outcomes?.find((o: any) => typeof o.point === 'number');
    return outcomeWithPoint ? Math.abs(outcomeWithPoint.point) : 0;
  }
}
