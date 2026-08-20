import { MarketVertical } from "../ArgosUnifiedEngine";
import { MarketCoverageRegistry } from "./MarketCoverageRegistry";

// ============================================================
// MARKET NORMALIZER v6.1.0 — SYNDICATE MASTER EDITION
// Transforma o payload bruto da PropLine em estrutura estável.
// Captura TODAS as casas, mercados, linhas e odds disponíveis.
// Nenhum mercado é descartado antes de passar pelo motor de avaliação.
// ============================================================

export interface NormalizedMarket {
  vertical: MarketVertical;
  marketName: string;
  line: number;
  outcomes: {
    selection: string;
    odd: number;
    impliedProb: number;
    point?: number;
  }[];
  bookmaker: string;
  bookmakerTitle: string;
  lastUpdate: number;
  isSharp: boolean;
}

export interface NormalizationReport {
  totalBookmakers: number;
  totalMarkets: number;
  sharpBookmakers: string[];
  verticalCoverage: Record<string, number>;
  hasSharpReference: boolean;
}

const SHARP_BOOKMAKERS = ["pinnacle", "betfair", "matchbook", "smarkets"];

export class MarketNormalizer {
  public static normalize(event: any): NormalizedMarket[] {
    const normalized: NormalizedMarket[] = [];
    const bookmakers = event.bookmakers || [];

    for (const bookie of bookmakers) {
      const bookieKey = (bookie.key || "").toLowerCase();
      const bookieTitle = bookie.title || bookie.key || "Unknown";
      const isSharp = SHARP_BOOKMAKERS.includes(bookieKey);
      const markets = bookie.markets || [];

      for (const market of markets) {
        const vertical = this.mapToVertical(market.key);
        const rawOutcomes = (market.outcomes || []).map((o: any) => {
          const rawPrice = typeof o.price === "number" ? o.price : 100;
          const decimalOdd = rawPrice > 0
            ? 1 + rawPrice / 100
            : 1 + 100 / Math.abs(rawPrice);
          return {
            selection: o.name || o.description || "Unknown",
            odd: parseFloat(decimalOdd.toFixed(4)),
            impliedProb: decimalOdd > 0 ? 1 / decimalOdd : 0,
            point: typeof o.point === "number" ? o.point : undefined,
          };
        });

        if (rawOutcomes.length === 0) continue;

        const pointGroups = new Map<number | null, typeof rawOutcomes>();
        for (const o of rawOutcomes) {
          const key = o.point !== undefined ? Math.abs(o.point) : null;
          if (!pointGroups.has(key)) pointGroups.set(key, []);
          pointGroups.get(key)!.push(o);
        }

        for (const [point, outcomes] of pointGroups) {
          normalized.push({
            vertical,
            marketName: market.key,
            line: point !== null ? point : this.extractLine(market),
            outcomes,
            bookmaker: bookieKey,
            bookmakerTitle: bookieTitle,
            lastUpdate: bookie.last_update || Math.floor(Date.now() / 1000),
            isSharp,
          });
        }
      }
    }

    return normalized;
  }

  public static generateReport(normalized: NormalizedMarket[]): NormalizationReport {
    const sharpBookmakers = [...new Set(
      normalized.filter(m => m.isSharp).map(m => m.bookmakerTitle)
    )];

    const verticalCoverage: Record<string, number> = {};
    for (const m of normalized) {
      verticalCoverage[m.vertical] = (verticalCoverage[m.vertical] || 0) + 1;
    }

    return {
      totalBookmakers: new Set(normalized.map(m => m.bookmaker)).size,
      totalMarkets: normalized.length,
      sharpBookmakers,
      verticalCoverage,
      hasSharpReference: sharpBookmakers.length > 0,
    };
  }

  /**
   * Canonical provider-market resolution. The registry is authoritative;
   * unknown provider keys remain UNKNOWN instead of being heuristically
   * fabricated into an existing vertical.
   */
  public static mapToVertical(key: string): MarketVertical {
    return MarketCoverageRegistry.resolve(key)?.vertical ?? MarketVertical.UNKNOWN;
  }

  private static extractLine(market: any): number {
    if (typeof market.line === "number") return market.line;
    const outcomeWithPoint = (market.outcomes || []).find(
      (o: any) => typeof o.point === "number"
    );
    if (outcomeWithPoint) return Math.abs(outcomeWithPoint.point);
    const match = (market.key || "").match(/(\d+\.?\d*)/);
    return match ? parseFloat(match[1]) : 0;
  }
}
