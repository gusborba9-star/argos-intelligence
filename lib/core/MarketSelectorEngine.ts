import { MarketVertical } from "./ArgosUnifiedEngine";

// ============================================================
// MARKET SELECTOR ENGINE v6.0.0 — SYNDICATE MASTER EDITION
// Regra de Ouro: Varredura COMPLETA.
// NUNCA descartar mercados por "tier" da liga.
// A partida só é descartada após avaliação de valor real em todas as verticais.
// ============================================================

export class MarketSelectorEngine {
  /**
   * Seleciona mercados para análise.
   * No Syndicate Master v6.0.0, SEMPRE retornamos todos os mercados disponíveis
   * para garantir que nenhuma oportunidade seja perdida.
   */
  public static selectMarkets(
    availableMarkets: MarketVertical[],
    executionMode: "FULL" | "REDUCED" | "SKIP" = "FULL"
  ): MarketVertical[] {
    if (executionMode === "SKIP") return [];

    // REGRA MASTER: Varredura completa é o padrão.
    // Ignoramos "REDUCED" ou "Tier" da liga para não perder oportunidades em mercados secundários
    // (ex: escanteios em ligas menores podem ter muito valor).
    
    return [...availableMarkets];
  }
}
