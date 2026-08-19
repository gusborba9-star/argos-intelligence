import { MarketVertical } from "../contracts/MarketVertical";
import { MarketCoverageRegistry } from "./MarketCoverageRegistry";

// ============================================================
// MARKET NORMALIZER v6.0.0 — CANONICAL COVERAGE PATH
// Raw provider payload is normalized without discarding unknown markets.
// Canonical vertical resolution is centralized in MarketCoverageRegistry.
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
  unknownMarkets: string[];
}

const SHARP_BOOKMAKERS = ["pinnacle", "betfair", "matchbook", "smarkets"];

export class MarketNormalizer {
  public static normalize(event: any): NormalizedMarket[] {
    const normalized: NormalizedMarket[] = [];
    const bookmakers = Array.isArray(event?.bookmakers) ? event.bookmakers : [];

    for (const bookie of bookmakers) {
      const bookieKey = String(bookie?.key || "").toLowerCase();
      const bookieTitle = bookie?.title || bookie?.key || "Unknown";
      const isSharp = SHARP_BOOKMAKERS.includes(bookieKey);
      const markets = Array.isArray(bookie?.markets) ? bookie.markets : [];

      for (const market of markets) {
        const vertical = this.mapToVertical(market?.key);
        const rawOutcomes = (Array.isArray(market?.outcomes) ? market.outcomes : [])
          .map((o: any) => {
            const rawPrice = typeof o?.price === "number" ? o.price : Number.NaN;
            if (!Number.isFinite(rawPrice) || rawPrice === 0) return null;

            // Provider contract: American odds. Keep conversion isolated here.
            const decimalOdd = rawPrice > 0
              ? 1 + rawPrice / 100
              : 1 + 100 / Math.abs(rawPrice);
            if (!Number.isFinite(decimalOdd) || decimalOdd <= 1) return null;

            return {
              selection: o?.name || o?.description || "Unknown",
              odd: Number(decimalOdd.toFixed(4)),
              impliedProb: 1 / decimalOdd,
              point: typeof o?.point === "number" ? o.point : undefined,
            };
          })
          .filter(Boolean) as NormalizedMarket["outcomes"];

        if (rawOutcomes.length === 0) continue;

        // Outcomes from one provider market may contain several lines. Split
        // by absolute point so a line can never inherit another line's price.
        const pointGroups = new Map<number | null, NormalizedMarket["outcomes"]>();
        for (const outcome of rawOutcomes) {
          const key = outcome.point !== undefined ? Math.abs(outcome.point) : null;
          const group = pointGroups.get(key) ?? [];
          group.push(outcome);
          pointGroups.set(key, group);
        }

        for (const [point, outcomes] of pointGroups) {
          normalized.push({
            vertical,
            marketName: String(market?.key || "unknown"),
            line: point !== null ? point : this.extractLine(market),
            outcomes,
            bookmaker: bookieKey,
            bookmakerTitle: bookieTitle,
            lastUpdate: this.parseTimestamp(bookie?.last_update ?? market?.last_update),
            isSharp,
          });
        }
      }
    }

    return normalized;
  }

  public static generateReport(normalized: NormalizedMarket[]): NormalizationReport {
    const sharpBookmakers = [...new Set(normalized.filter((m) => m.isSharp).map((m) => m.bookmakerTitle))];
    const verticalCoverage: Record<string, number> = {};
    const unknownMarkets = [...new Set(normalized.filter((m) => m.vertical === MarketVertical.UNKNOWN).map((m) => m.marketName))];

    for (const market of normalized) {
      verticalCoverage[market.vertical] = (verticalCoverage[market.vertical] || 0) + 1;
    }

    return {
      totalBookmakers: new Set(normalized.map((m) => m.bookmaker)).size,
      totalMarkets: normalized.length,
      sharpBookmakers,
      verticalCoverage,
      hasSharpReference: sharpBookmakers.length > 0,
      unknownMarkets,
    };
  }

  public static mapToVertical(key: string): MarketVertical {
    return MarketCoverageRegistry.resolve(String(key || ""))?.vertical ?? MarketVertical.UNKNOWN;
  }

  private static extractLine(market: any): number {
    if (typeof market?.line === "number" && Number.isFinite(market.line)) return Math.abs(market.line);
    const outcomeWithPoint = (Array.isArray(market?.outcomes) ? market.outcomes : []).find(
      (o: any) => typeof o?.point === "number" && Number.isFinite(o.point),
    );
    if (outcomeWithPoint) return Math.abs(outcomeWithPoint.point);
    const match = String(market?.key || "").match(/(\d+\.?\d*)/);
    return match ? parseFloat(match[1]) : 0;
  }

  private static parseTimestamp(value: unknown): number {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    const parsed = Date.parse(String(value || ""));
    return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : Math.floor(Date.now() / 1000);
  }
}
