import { MarketVertical } from "./ArgosUnifiedEngine";

/**
 * MARKET SELECTOR ENGINE v5.1
 * Responsabilidade Única: Decidir quais mercados serão analisados.
 * Entrada: availableMarkets[] + executionMode + leagueProfile
 * Saída: selectedMarkets[]
 */
export class MarketSelectorEngine {
  public static selectMarkets(
    availableMarkets: MarketVertical[],
    executionMode: "FULL" | "REDUCED" | "SKIP",
    leagueProfile: any
  ): MarketVertical[] {
    if (executionMode === "SKIP") return [];

    if (executionMode === "FULL") {
      return [...availableMarkets];
    }

    const tier = leagueProfile?.tier ?? "Tier 3";

    const priorityMap: Record<string, MarketVertical[]> = {
      "Tier 1": [
        MarketVertical.WINNER,
        MarketVertical.GOALS,
        MarketVertical.HANDICAP,
        MarketVertical.GOALS_HT
      ],
      "Tier 2": [
        MarketVertical.GOALS,
        MarketVertical.CORNERS,
        MarketVertical.BTTS,
        MarketVertical.WINNER
      ],
      "Tier 3": [
        MarketVertical.GOALS,
        MarketVertical.WINNER,
        MarketVertical.GOALS_HT
      ]
    };

    const preferred = priorityMap[tier] ?? priorityMap["Tier 3"];

    // mantém ordem determinística baseada no priorityMap
    const selected = preferred.filter(v => availableMarkets.includes(v));

    // fallback crítico: nunca retornar vazio em REDUCED se houver mercados disponíveis
    if (selected.length === 0) {
      return availableMarkets.slice(0, 3);
    }

    return selected;
  }
}
