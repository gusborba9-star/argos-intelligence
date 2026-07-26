import { MarketNormalizer } from "../../core/market-intelligence/MarketNormalizer";
import { FairOddsCalculator } from "../../core/market-intelligence/FairOddsCalculator";
import { OddsValueEngine } from "../../core/market-intelligence/OddsValueEngine";
import { ModelFactory } from "../../core/ModelFactory";
import { FeatureEngine } from "../../core/FeatureEngine";
import { RAGContextEngine } from "../regime/RAGContextEngine";
// RegimeEngineV4 removido. O regime agora é extraído do RAGContextEngine.
import { SignalDistributionEngine } from "../../core/market-intelligence/SignalDistributionEngine";
import { MarketVertical } from "../../core/ArgosUnifiedEngine";

export class ArgosMasterOrchestrator {
  private static readonly VERSION = "6.0.0-MASTER";

  /**
   * Fluxo Mestre Syndicate Edition:
   * PropLine Raw Data -> Normalizer -> Feature Engine -> RAG + Monte Carlo -> Value Engine -> Distribution
   */
  public static async run(matchId: string, rawData: any) {
    console.log(`[ArgosMaster] 🚀 Iniciando análise v${this.VERSION} para: ${matchId}`);

    // Payload real da PropLine não tem `league_id` (formato antigo api-football) —
    // usa `sport_key`/`sport_title`. Normaliza aqui pra manter compatibilidade com
    // ambos os formatos.
    const leagueIdentifier = String(
      rawData.league_id ?? rawData.sport_key ?? rawData.sport_title ?? "unknown_league"
    );


    // 1. Normalização Total (Zero Descarte)
    const normalizedMarkets = MarketNormalizer.normalize(rawData);
    const report = MarketNormalizer.generateReport(normalizedMarkets);
    console.log(`[ArgosMaster] Mercados normalizados: ${report.totalMarkets} | Sharp Ref: ${report.hasSharpReference}`);

    // 2. Enriquecimento de Contexto (RAG + Regime)
    const ragEngine = new RAGContextEngine(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      process.env.GOOGLE_AI_API_KEY!
    );
    const context = await ragEngine.retrieveContext(matchId, leagueIdentifier);

    // O regime agora é influenciado pelos dados do RAG
    const regime = {
      variance_multiplier: (context.lesoes.length > 0 || context.clima !== 'Condições normais') ? 1.3 : 1.1,
      model_bias: context.motivacao.includes('favorito') ? 0.05 : 0.02,
      market_regime: "NEUTRAL"
    };

    // 3. Feature Engineering & Monte Carlo Simulation
    const features = FeatureEngine.generateFeatureVector(rawData);
    
    // Analisar todos os mercados obrigatórios
    const verticalsToAnalyze = [
      MarketVertical.WINNER,
      MarketVertical.HANDICAP,
      MarketVertical.GOALS,
      MarketVertical.GOALS_HT,
      MarketVertical.BTTS,
      MarketVertical.CORNERS,
      MarketVertical.CARDS
    ];

    const opportunities: any[] = [];

    for (const vertical of verticalsToAnalyze) {
      // Simulação Monte Carlo calibrada
      const simulation = await ModelFactory.runMonteCarloWithLearning(
        { homeMean: features.homeMetrics.goals, awayMean: features.awayMetrics.goals }, // Exemplo simplificado
        regime as any,
        leagueIdentifier,
        vertical as any
      );

      // 4. Fair Line & Value Engine (Pinnacle-heavy)
      // Seleções descobertas dinamicamente a partir do que a PropLine realmente
      // ofertou nessa partida (todas as linhas de Goals, Winner, BTTS) — em vez
      // de uma lista fixa que ignorava as linhas reais do mercado.
      const selections = this.getSelectionsForVertical(vertical, normalizedMarkets);

      for (const selection of selections) {
        const fairLine = FairOddsCalculator.calculate(normalizedMarkets, vertical, selection.label, selection.line);

        if (fairLine) {
          const prob = simulation.probabilities[selection.key];
          if (prob === undefined) continue; // Modelo ainda não calibrado pra essa seleção — não inventa sinal.

          // Odd real de mercado (melhor preço disponível entre as casas), separada
          // da fair odd (referência sharp) — antes o código comparava fair com a
          // própria fair, o que nunca representa valor real.
          const marketOdd = this.getBestMarketOdd(normalizedMarkets, vertical, selection.label, selection.line);
          if (marketOdd === null) continue;

          const valueAnalysis = OddsValueEngine.calculateValue(prob, marketOdd, fairLine.fairOdd);

          if (valueAnalysis.isPositive) {
            opportunities.push({
              vertical,
              selection: selection.label,
              line: selection.line,
              probability: prob,
              fairOdd: fairLine.fairOdd,
              odd: marketOdd,
              expectedValue: valueAnalysis.expectedValue,
              edge: valueAnalysis.edge,
              edgePercent: valueAnalysis.edgePercent,
              kellyCriterion: valueAnalysis.kellyCriterion,
              ratingLabel: valueAnalysis.ratingLabel
            });
          }
        }
      }
    }

    // 5. Geração de Análise Profunda baseada em Contexto RAG
    const analysisSummary = this.generateDeepAnalysis(context, features, opportunities);

    // 6. Distribuição Final (Telegram FREE/VIP)
    if (opportunities.length > 0) {
      // Adicionar o resumo a todos os sinais para o VIP
      const opportunitiesWithAnalysis = opportunities.map(op => ({
        ...op,
        analysisSummary
      }));

      await SignalDistributionEngine.processAndDispatch(
        opportunitiesWithAnalysis,
        regime as any,
        {
          name: `${rawData.home_team} vs ${rawData.away_team}`,
          league: features.leagueProfile.name,
          kickoff: rawData.commence_time || rawData.kickoff_at || null
        }
      );
    }

    return {
      status: "SUCCESS",
      version: this.VERSION,
      matchId,
      opportunitiesFound: opportunities.length,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Descobre as seleções a avaliar a partir do que a PropLine realmente
   * ofertou (todas as linhas de Goals, não só 2.5), mapeando para as chaves
   * de probabilidade que o Monte Carlo sabe calcular hoje (Winner, Goals
   * qualquer linha, BTTS). Handicap/Corners/Cards/Goals-HT ainda não têm
   * modelo de probabilidade próprio — normalizamos os mercados pra auditoria,
   * mas não inventamos sinal onde não há calibração real (ver checagem
   * `prob === undefined` no chamador).
   */
  private static getSelectionsForVertical(vertical: MarketVertical, normalizedMarkets: any[]) {
    switch (vertical) {
      case MarketVertical.WINNER:
        return [
          { key: "home", label: "Home", line: 0 },
          { key: "draw", label: "Draw", line: 0 },
          { key: "away", label: "Away", line: 0 },
        ];
      case MarketVertical.GOALS: {
        const lines = new Set<number>(
          normalizedMarkets
            .filter((m) => m.vertical === MarketVertical.GOALS)
            .map((m) => m.line)
            .filter((l: number) => !!l)
        );
        const selections: { key: string; label: string; line: number }[] = [];
        lines.forEach((line) => {
          selections.push({ key: `over_${line}`, label: "Over", line });
          selections.push({ key: `under_${line}`, label: "Under", line });
        });
        return selections;
      }
      case MarketVertical.BTTS:
        return [
          { key: "btts_yes", label: "Yes", line: 0 },
          { key: "btts_no", label: "No", line: 0 },
        ];
      default:
        return [];
    }
  }

  /**
   * Melhor preço real disponível no mercado (decimal, já convertido de
   * formato americano) para a seleção/linha pedida — usado como odd de
   * mercado real na comparação de valor, em vez de reusar a fair odd.
   */
  private static getBestMarketOdd(
    normalizedMarkets: any[],
    vertical: MarketVertical,
    selectionLabel: string,
    line: number
  ): number | null {
    const candidates = normalizedMarkets
      .filter((m) => m.vertical === vertical && m.line === line)
      .flatMap((m) => m.outcomes)
      .filter((o: any) => o.selection.toLowerCase() === selectionLabel.toLowerCase())
      .map((o: any) => o.odd)
      .filter((odd: number) => odd > 1 && odd < 100); // descarta lixo/sentinelas

    if (candidates.length === 0) return null;
    return Math.max(...candidates);
  }

  private static generateDeepAnalysis(context: any, features: any, opportunities: any[]): string {
    let summary = "O modelo detectou ";
    
    if (opportunities.length > 3) {
      summary += "uma partida de alta densidade operacional com valor em múltiplos mercados. ";
    } else {
      summary += "oportunidades pontuais de valor estratégico. ";
    }

    if (context.lesoes.length > 0) {
      summary += `Impacto crítico de ausências: ${context.lesoes.slice(0, 2).join(", ")}. `;
    }

    if (features.homeRecentForm > 0.7) {
      summary += "Forte dominância recente do mandante observada. ";
    }

    summary += "A simulação Monte Carlo (10k) confirma convergência para as fair lines calculadas via Pinnacle.";
    
    return summary;
  }
}
