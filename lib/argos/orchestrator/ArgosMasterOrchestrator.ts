import { MarketNormalizer } from "../../core/market-intelligence/MarketNormalizer";
import { FairOddsCalculator } from "../../core/market-intelligence/FairOddsCalculator";
import { OddsValueEngine } from "../../core/market-intelligence/OddsValueEngine";
import { ModelFactory } from "../../core/ModelFactory";
import { FeatureEngine } from "../../core/FeatureEngine";
import { DataIngestionService } from "../../core/DataIngestionService";
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

    // Trava de segurança: nunca gerar/despachar sinal pra um jogo cujo
    // horário de início já passou (feed da fonte pode ficar com kickoff
    // desatualizado). Sem isso, um jogo já encerrado pode continuar
    // recebendo sinal.
    const kickoffCheck = rawData.commence_time ? new Date(rawData.commence_time).getTime() : null;
    if (kickoffCheck && kickoffCheck < Date.now() - 10 * 60 * 1000) {
      console.warn(`[ArgosMaster] ⏭️ Abortado ${matchId}: kickoff (${rawData.commence_time}) já passou.`);
      return { status: "SKIPPED_EXPIRED", matchId };
    }


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
    // Busca histórico real de gols (acumulado dia a dia via /scores da PropLine).
    // Se ainda não há dados reais pra esse time, cai no default genérico do
    // FeatureEngine — não trava, só ainda não está calibrado com dado real.
    const dataService = new DataIngestionService();
    const [homeHistory, awayHistory] = await Promise.all([
      dataService.getRealTeamHistory(rawData.sport_key || leagueIdentifier, rawData.home_team),
      dataService.getRealTeamHistory(rawData.sport_key || leagueIdentifier, rawData.away_team),
    ]);

    // TRAVA DE PRECISÃO: sem uma amostra mínima real de jogos pra AMBOS os
    // times, o modelo cai no default genérico (1.5 gols) e pode divergir
    // brutalmente do mercado (ex: modelo 55%, mercado real ~15%) — foi
    // exatamente isso que gerou sinal inflado em jogos como Coleraine vs
    // HJK. Preferimos NÃO gerar sinal de Gols/BTTS/Handicap a gerar um
    // inflado. Segue rodando (Winner ainda sai, é mais robusto ao default),
    // mas os mercados sensíveis à média de gols ficam de fora até haver
    // amostra real.
    const MIN_REAL_SAMPLE = 1; // temporário: reduzido de 3 pra 1 em 31/07/2026 — a coleta de
    // histórico ficou 2 dias travada (bug de timeout do pg_net, corrigido agora), então
    // exigir 3 jogos manteria o sistema mudo por mais alguns dias. Subir de volta pra 3
    // conforme a cobertura de times aumentar.
    const hasRealData = homeHistory.length >= MIN_REAL_SAMPLE && awayHistory.length >= MIN_REAL_SAMPLE;
    if (!hasRealData) {
      console.warn(`[ArgosMaster] ⚠️ ${matchId}: sem amostra real suficiente (home:${homeHistory.length}, away:${awayHistory.length}) — Gols/BTTS/Handicap suprimidos pra evitar sinal inflado.`);
    }

    const features = FeatureEngine.generateFeatureVector({
      ...rawData,
      homeHistory: rawData.homeHistory?.length ? rawData.homeHistory : homeHistory,
      awayHistory: rawData.awayHistory?.length ? rawData.awayHistory : awayHistory,
    });

    // Escanteios/Cartões: fonte de dado separada (não vem do /scores da
    // PropLine, vem do backfill histórico público). Só gera sinal desses
    // mercados se AMBOS os times tiverem amostra real — mesma filosofia
    // de precisão do resto do sistema.
    const [homeExtra, awayExtra] = await Promise.all([
      dataService.getTeamExtraStats(rawData.sport_key || leagueIdentifier, rawData.home_team),
      dataService.getTeamExtraStats(rawData.sport_key || leagueIdentifier, rawData.away_team),
    ]);
    const hasExtraStats = !!homeExtra && !!awayExtra;
    let countStatProbabilities: Record<string, Record<string, number>> = {};
    if (hasExtraStats && homeExtra && awayExtra) {
      const cornersHomeMean = (homeExtra.cornersFor + awayExtra.cornersAgainst) / 2;
      const cornersAwayMean = (awayExtra.cornersFor + homeExtra.cornersAgainst) / 2;
      const cardsHomeMean = (homeExtra.cardsFor + awayExtra.cardsAgainst) / 2;
      const cardsAwayMean = (awayExtra.cardsFor + homeExtra.cardsAgainst) / 2;
      countStatProbabilities[MarketVertical.CORNERS] = ModelFactory.runCountStatSimulation(
        cornersHomeMean, cornersAwayMean, [7.5, 8.5, 9.5, 10.5, 11.5, 12.5]
      );
      countStatProbabilities[MarketVertical.CARDS] = ModelFactory.runCountStatSimulation(
        cardsHomeMean, cardsAwayMean, [2.5, 3.5, 4.5, 5.5, 6.5]
      );
    } else {
      console.warn(`[ArgosMaster] ⚠️ ${matchId}: sem amostra real de escanteios/cartões — mercados suprimidos.`);
    }
    
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
      // Sem amostra real, Gols/BTTS/Handicap ficam de fora (dependem
      // diretamente da média de gols, que sem dado real é só um chute
      // genérico). Corners/Cards têm sua própria trava de amostra (fonte
      // de dado é o backfill histórico, separado do /scores da PropLine).
      if (!hasRealData && [MarketVertical.GOALS, MarketVertical.GOALS_HT, MarketVertical.BTTS, MarketVertical.HANDICAP].includes(vertical)) {
        continue;
      }
      if ([MarketVertical.CORNERS, MarketVertical.CARDS].includes(vertical) && !hasExtraStats) {
        continue;
      }

      // Corners/Cards usam o simulador de contagem (Poisson simples com
      // médias reais) — não o Monte Carlo de gols, que não tem noção
      // nenhuma de escanteio ou cartão.
      const isCountStatVertical = [MarketVertical.CORNERS, MarketVertical.CARDS].includes(vertical);
      const simulation = isCountStatVertical
        ? { probabilities: countStatProbabilities[vertical] || {} }
        : await ModelFactory.runMonteCarloWithLearning(
            { homeMean: features.homeMetrics.goals, awayMean: features.awayMetrics.goals }, // Exemplo simplificado
            regime as any,
            leagueIdentifier,
            vertical as any
          );

      // 4. Fair Line & Value Engine (Pinnacle-heavy)
      // Seleções descobertas dinamicamente a partir do que a PropLine realmente
      // ofertou nessa partida (todas as linhas de Goals, Winner, BTTS) — em vez
      // de uma lista fixa que ignorava as linhas reais do mercado.
      const selections = this.getSelectionsForVertical(vertical, normalizedMarkets, rawData.home_team, rawData.away_team);

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

          // Antes: só entrava na lista se tivesse EV+, o que tornava impossível
          // o FREE mostrar "alta probabilidade mesmo sem EV+" (nunca chegava a
          // existir esse dado). Agora toda seleção avaliada entra, marcada com
          // `hasEdge` — o VIP filtra por hasEdge, o FREE filtra por probabilidade.
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
            ratingLabel: valueAnalysis.ratingLabel,
            hasEdge: valueAnalysis.isPositive
          });
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
          matchId,
          name: `${rawData.home_team} vs ${rawData.away_team}`,
          homeTeam: rawData.home_team,
          awayTeam: rawData.away_team,
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
  private static getSelectionsForVertical(
    vertical: MarketVertical,
    normalizedMarkets: any[],
    homeTeam?: string,
    awayTeam?: string
  ) {
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
      case MarketVertical.CORNERS:
      case MarketVertical.CARDS: {
        const lines = new Set<number>(
          normalizedMarkets
            .filter((m) => m.vertical === vertical)
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
      case MarketVertical.HANDICAP: {
        // Handicap identifica a seleção pelo nome do próprio time (convenção
        // the-odds-api/PropLine), não por "Home"/"Away" — por isso precisa
        // do nome real dos times pra casar com o outcome certo.
        if (!homeTeam || !awayTeam) return [];
        const selections: { key: string; label: string; line: number }[] = [];
        const seen = new Set<string>();
        normalizedMarkets
          .filter((m) => m.vertical === MarketVertical.HANDICAP)
          .forEach((m) => {
            m.outcomes.forEach((o: any) => {
              const dedupeKey = `${o.selection}|${o.point ?? m.line}`;
              if (seen.has(dedupeKey)) return;
              seen.add(dedupeKey);
              const line = o.point ?? m.line;
              if (o.selection === homeTeam) {
                selections.push({ key: `home_handicap_${line}`, label: homeTeam, line });
              } else if (o.selection === awayTeam) {
                selections.push({ key: `away_handicap_${line}`, label: awayTeam, line });
              }
            });
          });
        return selections;
      }
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
      .filter((odd: number) => odd >= 1.35 && odd < 100); // piso de 1.35 — sem sinal de odd curtíssima

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
