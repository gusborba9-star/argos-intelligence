import { MarketVertical } from "./ArgosUnifiedEngine";

/**
 * MARKET SELECTOR ENGINE v5.0
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
    
    if (executionMode === "FULL") return availableMarkets;

    // Lógica de REDUCED_SET dinâmica baseada no perfil da liga
    const priorityMap: Record<string, MarketVertical[]> = {
      "Tier 1": [MarketVertical.WINNER, MarketVertical.GOALS, MarketVertical.HANDICAP, MarketVertical.GOALS_HT],
      "Tier 2": [MarketVertical.GOALS, MarketVertical.CORNERS, MarketVertical.BTTS, MarketVertical.WINNER],
      "Tier 3": [MarketVertical.GOALS, MarketVertical.WINNER, MarketVertical.GOALS_HT]
    };

    const preferredVerticals = priorityMap[leagueProfile.tier] || priorityMap["Tier 3"];
    
    // Interseção entre os preferidos e os disponíveis
    return preferredVerticals.filter(v => availableMarkets.includes(v));
  }
}
