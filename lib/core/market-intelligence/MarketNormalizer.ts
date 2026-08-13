import { MarketVertical } from "../ArgosUnifiedEngine";

// ============================================================
// MARKET NORMALIZER v6.0.0 — SYNDICATE MASTER EDITION
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
  isSharp: boolean; // Pinnacle / Betfair = sharp reference
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
  /**
   * Transforma o payload bruto da PropLine em uma estrutura padronizada.
   * Captura TODAS as casas e TODOS os mercados disponíveis sem descartar nada.
   */
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

        // REGRA MASTER: Não descartar mercados desconhecidos antes da avaliação.
        // Mercados UNKNOWN são normalizados com vertical UNKNOWN para auditoria posterior.

        const rawOutcomes = (market.outcomes || []).map((o: any) => {
          const rawPrice = typeof o.price === "number" ? o.price : 100;
          // PropLine entrega odds em formato AMERICANO (ex: -174, +130), não decimal.
          // Conversão correta: negativo = favorito, positivo = underdog.
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

        // CRÍTICO: um único bloco de mercado pode conter outcomes de VÁRIAS
        // linhas diferentes misturadas (confirmado com dado real da Bovada —
        // Under 0.5 + Under 2.5 + Over 0.5 + Over 2.5 no mesmo array). Tratar
        // o bloco inteiro como "uma linha só" fazia a odd de uma linha ser
        // atribuída erroneamente a outra (ex: Over 2.5 @2.05 virando "Over 0.5").
        // Agrupa por ponto real de cada outcome antes de decidir a linha.
        const pointGroups = new Map<number | null, typeof rawOutcomes>();
        for (const o of rawOutcomes) {
          const key = o.point ?? null;
          if (!pointGroups.has(key)) pointGroups.set(key, []);
          pointGroups.get(key)!.push(o);
        }

        for (const [point, outcomes] of pointGroups) {
          normalized.push({
            vertical,
            marketName: market.key,
            line: point !== null ? Math.abs(point) : this.extractLine(market),
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

  /**
   * Gera um relatório de cobertura de mercado para auditoria.
   */
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
   * Mapeia a chave de mercado da PropLine para o enum MarketVertical.
   * Cobre todos os mercados obrigatórios da arquitetura Syndicate Master.
   */
  public static mapToVertical(key: string): MarketVertical {
    const k = (key || "").toLowerCase();

    // Vencedor / Result
    if (k === "h2h" || k.includes("match_winner") || k.includes("1x2")) return MarketVertical.WINNER;

    // Handicap
    if (k.includes("spreads") || k.includes("handicap") || k.includes("asian_handicap")) return MarketVertical.HANDICAP;

    // Gols HT (Half Time) — deve vir antes de totals genérico
    if (k.includes("totals_first_half") || k.includes("ht_goals") || k.includes("half_time_goals") || k.includes("first_half_totals")) return MarketVertical.GOALS_HT;

    // Gols (Over/Under totais)
    if (k.includes("totals") || k.includes("goals_ou") || k.includes("over_under")) return MarketVertical.GOALS;

    // BTTS
    if (k.includes("btts") || k.includes("both_teams_to_score")) return MarketVertical.BTTS;

    // Escanteios
    if (k.includes("corners")) return MarketVertical.CORNERS;

    // Cartões
    if (k.includes("cards") || k.includes("bookings")) return MarketVertical.CARDS;

    // Finalizações no alvo
    if (k.includes("shots_on_target") || k.includes("shots_on_goal")) return MarketVertical.SHOTS_ON_TARGET;

    // Finalizações totais
    if (k.includes("shots")) return MarketVertical.SHOTS;

    // Faltas
    if (k.includes("fouls")) return MarketVertical.FOULS;

    // Defesas
    if (k.includes("saves")) return MarketVertical.SAVES;

    // Duelos/Tackles
    if (k.includes("tackles")) return MarketVertical.TACKLES;

    return MarketVertical.UNKNOWN;
  }

  private static extractLine(market: any): number {
    if (typeof market.line === "number") return market.line;
    // PropLine armazena a linha nos outcomes (ex: point: 2.5)
    const outcomeWithPoint = (market.outcomes || []).find(
      (o: any) => typeof o.point === "number"
    );
    if (outcomeWithPoint) return Math.abs(outcomeWithPoint.point);
    // Tenta extrair da chave do mercado (ex: "totals_2.5")
    const match = (market.key || "").match(/(\d+\.?\d*)/);
    return match ? parseFloat(match[1]) : 0;
  }
}
