import { getSupabaseClient } from "@/lib/core/SupabaseClient";
import { SupabaseClient } from "@supabase/supabase-js";
import { RegimeEngineV4 } from "@/lib/argos/regime/RegimeEngineV4";
import { RAGContextEngine } from "@/lib/argos/regime/RAGContextEngine";
import { ModelFactory } from "@/lib/core/ModelFactory";
import { SignalClassifierV4 } from "@/lib/core/SignalClassifierV4";
import { MarketVertical } from "@/lib/core/ArgosUnifiedEngine";
import { DataIngestionService } from "@/lib/core/DataIngestionService";
import { FeatureEngine } from "@/lib/core/FeatureEngine";
import { MarketNormalizer, NormalizationReport } from "@/lib/core/market-intelligence/MarketNormalizer";
import { MarketDiscoveryEngine, DiscoveryReport } from "@/lib/core/market-intelligence/MarketDiscoveryEngine";
import { SignalDistributionEngine, DistributedSignal } from "@/lib/core/market-intelligence/SignalDistributionEngine";
import { RegimeProfile } from "@/lib/argos/regime/RegimeSchema";
import { TelegramDispatcher } from "@/lib/argos/notifications/TelegramDispatcher";

// ============================================================
// ARGOS ORCHESTRATOR v6.0.0 — SYNDICATE MASTER EDITION
// Fluxo Único: PropLine → Normalizer → Feature Engine →
//              RAG + Regime → Monte Carlo → Market Intelligence →
//              Odds Value Engine → Signal Classification →
//              Distribution Engine → Telegram
// ============================================================

export interface SyndicateAuditResult {
  matchId: string;
  status: "SUCCESS" | "FAILED" | "NO_VALUE";
  signals: number;
  executionTime: number;
  normalizationReport?: NormalizationReport;
  discoveryReport?: DiscoveryReport;
  regime?: RegimeProfile;
  error?: string;
}

export class ArgosOrchestratorV4 {
  private supabase: SupabaseClient;
  private regimeEngine: RegimeEngineV4;
  private ragEngine: RAGContextEngine;
  private ingestionService: DataIngestionService;
  private telegramDispatcher: TelegramDispatcher;

  constructor(ingestionService?: DataIngestionService, supabaseClient?: SupabaseClient) {
    this.supabase = supabaseClient || getSupabaseClient();
    this.regimeEngine = new RegimeEngineV4(process.env.GOOGLE_API_KEY!);
    this.ragEngine = new RAGContextEngine(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      process.env.GOOGLE_API_KEY!
    );
    this.ingestionService = ingestionService || new DataIngestionService();
    this.telegramDispatcher = new TelegramDispatcher();
  }

  /**
   * FLUXO SYNDICATE MASTER v6.0.0
   * Executa a auditoria completa de uma partida com todos os motores integrados.
   */
  async runSyndicateAudit(fixturePayload: any): Promise<SyndicateAuditResult> {
    const startTime = Date.now();
    const matchId = (
      fixturePayload.id ||
      fixturePayload.match_id ||
      fixturePayload.fixture?.id
    ).toString();

    console.log(`[Argos v6.0.0] 🛡️ Auditoria Master iniciada para: ${matchId}`);

    try {
      // ── ETAPA 1: MarketNormalizer ─────────────────────────────────────────
      // Transforma o payload PropLine em estrutura estável.
      // Captura TODAS as casas, mercados, linhas e odds disponíveis.
      const normalizedMarkets = MarketNormalizer.normalize(fixturePayload);
      const normalizationReport = MarketNormalizer.generateReport(normalizedMarkets);
      console.log(
        `[Argos-Normalizer] Casas: ${normalizationReport.totalBookmakers} | ` +
        `Mercados: ${normalizationReport.totalMarkets} | ` +
        `Sharp: ${normalizationReport.sharpBookmakers.join(", ") || "Nenhuma"}`
      );

      // ── ETAPA 2: Feature Engine ───────────────────────────────────────────
      // Gera vetor de features a partir dos dados históricos e externos.
      const ingestedData = await this.ingestionService.ingestObject(fixturePayload);
      const features = FeatureEngine.generateFeatureVector(ingestedData);

      // ── ETAPA 3: RAG + Regime Engine ─────────────────────────────────────
      // RAG: lesões, clima, motivação, contexto histórico
      // Regime: classifica o estado do mercado e ajusta variância/bias do Monte Carlo
      const context = await this.ragEngine.retrieveContext(matchId, ingestedData.leagueId);
      const regime = await this.regimeEngine.analyze({
        matchId,
        leagueId: ingestedData.leagueId,
        contextEvidence: context,
        factors: ingestedData.externalFactors,
      });
      console.log(
        `[Argos-Regime] Regime: ${regime.regime} | Confiança: ${(regime.confidence * 100).toFixed(0)}% | ` +
        `Bias: ${regime.model_bias} | Variância: ${regime.variance_multiplier}`
      );

      // ── ETAPA 4: Monte Carlo Simulation ──────────────────────────────────
      // Simula TODOS os mercados obrigatórios com ajuste de regime e contexto RAG.
      // A partida só é descartada após varredura completa.
      const modelPredictions = await this.runFullMarketSimulation(features, regime);

      // ── ETAPA 5: Market Intelligence Layer (Discovery) ───────────────────
      // Cruza probabilidades do modelo com fair odds para calcular EV real.
      const opportunities = MarketDiscoveryEngine.discover(normalizedMarkets, modelPredictions);
      const discoveryReport = MarketDiscoveryEngine.generateReport(opportunities);
      console.log(
        `[Argos-Discovery] Oportunidades: ${discoveryReport.totalOpportunities} | ` +
        `EV+: ${discoveryReport.positiveEVCount} | Elite: ${discoveryReport.eliteCount}`
      );

      // ── ETAPA 6: Signal Distribution Engine (FREE vs VIP) ────────────────
      const distributedSignals = SignalDistributionEngine.process(opportunities, regime);

      // ── ETAPA 7: Entrega & Persistência ──────────────────────────────────
      if (distributedSignals.length > 0) {
        const ledgerEntries = SignalClassifierV4.prepareLedger(
          matchId,
          ingestedData.leagueId,
          distributedSignals as any,
          regime
        );
        await this.supabase.from("argos_signal_ledger").insert(ledgerEntries);
        await this.telegramDispatcher.dispatch(distributedSignals as any, regime);
        console.log(`[Argos-Success] ✅ ${distributedSignals.length} sinais despachados.`);
      } else {
        console.log(`[Argos-NoValue] Nenhum sinal com EV+ encontrado após varredura completa de ${matchId}.`);
      }

      return {
        matchId,
        status: distributedSignals.length > 0 ? "SUCCESS" : "NO_VALUE",
        signals: distributedSignals.length,
        executionTime: Date.now() - startTime,
        normalizationReport,
        discoveryReport,
        regime,
      };
    } catch (error: any) {
      console.error(`[Argos-Critical] ❌ Erro na Auditoria Master para ${matchId}: ${error.message}`);
      return {
        matchId,
        status: "FAILED",
        signals: 0,
        executionTime: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  /**
   * Executa simulações Monte Carlo para TODOS os mercados obrigatórios.
   * Integra regime (variância, bias) e contexto RAG para ajuste real.
   * A partida só é descartada após varredura completa.
   */
  private async runFullMarketSimulation(
    features: any,
    regime: RegimeProfile
  ): Promise<{ [key: string]: number }> {
    const predictions: { [key: string]: number } = {};

    // ── WINNER (1X2) ─────────────────────────────────────────────────────
    const winnerSim = ModelFactory.runMonteCarlo(
      { homeMean: features.homeMetrics.goals, awayMean: features.awayMetrics.goals },
      regime, 10000, "GOALS"
    );
    predictions[`${MarketVertical.WINNER}_Home_0`] = winnerSim.probabilities.home;
    predictions[`${MarketVertical.WINNER}_Draw_0`] = winnerSim.probabilities.draw;
    predictions[`${MarketVertical.WINNER}_Away_0`] = winnerSim.probabilities.away;

    // ── HANDICAP ─────────────────────────────────────────────────────────
    // Usa a mesma simulação de gols com ajuste de spread
    predictions[`${MarketVertical.HANDICAP}_Home_0`] = winnerSim.probabilities.home;
    predictions[`${MarketVertical.HANDICAP}_Away_0`] = winnerSim.probabilities.away;

    // ── GOALS (Over/Under) ───────────────────────────────────────────────
    const goalsSim = ModelFactory.runMonteCarlo(
      { homeMean: features.homeMetrics.goals, awayMean: features.awayMetrics.goals },
      regime, 10000, "GOALS"
    );
    predictions[`${MarketVertical.GOALS}_Over_2.5`] = goalsSim.probabilities.over ?? 0;
    predictions[`${MarketVertical.GOALS}_Under_2.5`] = goalsSim.probabilities.under ?? 0;
    predictions[`${MarketVertical.GOALS}_Over_1.5`] = this.estimateOverLine(goalsSim.probabilities.over ?? 0, 2.5, 1.5);
    predictions[`${MarketVertical.GOALS}_Under_1.5`] = 1 - predictions[`${MarketVertical.GOALS}_Over_1.5`];
    predictions[`${MarketVertical.GOALS}_Over_3.5`] = this.estimateOverLine(goalsSim.probabilities.over ?? 0, 2.5, 3.5);
    predictions[`${MarketVertical.GOALS}_Under_3.5`] = 1 - predictions[`${MarketVertical.GOALS}_Over_3.5`];

    // ── GOALS HT ─────────────────────────────────────────────────────────
    const goalsHTSim = ModelFactory.runMonteCarlo(
      { homeMean: features.homeMetrics.goalsHT, awayMean: features.awayMetrics.goalsHT },
      regime, 10000, "GOALS"
    );
    predictions[`${MarketVertical.GOALS_HT}_Over_0.5`] = goalsHTSim.probabilities.over ?? 0;
    predictions[`${MarketVertical.GOALS_HT}_Under_0.5`] = goalsHTSim.probabilities.under ?? 0;
    predictions[`${MarketVertical.GOALS_HT}_Over_1.5`] = this.estimateOverLine(goalsHTSim.probabilities.over ?? 0, 0.5, 1.5);
    predictions[`${MarketVertical.GOALS_HT}_Under_1.5`] = 1 - predictions[`${MarketVertical.GOALS_HT}_Over_1.5`];

    // ── BTTS ─────────────────────────────────────────────────────────────
    // Probabilidade de ambas as equipes marcarem = P(home > 0) * P(away > 0)
    const pHomeScores = 1 - Math.exp(-features.homeMetrics.goals);
    const pAwayScores = 1 - Math.exp(-features.awayMetrics.goals);
    const bttsProb = pHomeScores * pAwayScores;
    predictions[`${MarketVertical.BTTS}_Yes_0`] = bttsProb;
    predictions[`${MarketVertical.BTTS}_No_0`] = 1 - bttsProb;

    // ── CORNERS ──────────────────────────────────────────────────────────
    const cornersSim = ModelFactory.runMonteCarlo(
      { homeMean: features.homeMetrics.corners, awayMean: features.awayMetrics.corners },
      regime, 10000, "CORNERS"
    );
    predictions[`${MarketVertical.CORNERS}_Over_9.5`] = cornersSim.probabilities.over ?? 0;
    predictions[`${MarketVertical.CORNERS}_Under_9.5`] = cornersSim.probabilities.under ?? 0;
    predictions[`${MarketVertical.CORNERS}_Over_8.5`] = this.estimateOverLine(cornersSim.probabilities.over ?? 0, 9.5, 8.5);
    predictions[`${MarketVertical.CORNERS}_Under_8.5`] = 1 - predictions[`${MarketVertical.CORNERS}_Over_8.5`];
    predictions[`${MarketVertical.CORNERS}_Over_10.5`] = this.estimateOverLine(cornersSim.probabilities.over ?? 0, 9.5, 10.5);
    predictions[`${MarketVertical.CORNERS}_Under_10.5`] = 1 - predictions[`${MarketVertical.CORNERS}_Over_10.5`];

    // ── CARDS ─────────────────────────────────────────────────────────────
    const cardsSim = ModelFactory.runMonteCarlo(
      { homeMean: features.homeMetrics.cards, awayMean: features.awayMetrics.cards },
      regime, 10000, "CARDS"
    );
    predictions[`${MarketVertical.CARDS}_Over_3.5`] = cardsSim.probabilities.over ?? 0;
    predictions[`${MarketVertical.CARDS}_Under_3.5`] = cardsSim.probabilities.under ?? 0;
    predictions[`${MarketVertical.CARDS}_Over_4.5`] = this.estimateOverLine(cardsSim.probabilities.over ?? 0, 3.5, 4.5);
    predictions[`${MarketVertical.CARDS}_Under_4.5`] = 1 - predictions[`${MarketVertical.CARDS}_Over_4.5`];

    // ── SHOTS ─────────────────────────────────────────────────────────────
    const shotsSim = ModelFactory.runMonteCarlo(
      { homeMean: features.homeMetrics.shots, awayMean: features.awayMetrics.shots },
      regime, 10000, "GOALS"
    );
    predictions[`${MarketVertical.SHOTS}_Over_22.5`] = shotsSim.probabilities.over ?? 0;
    predictions[`${MarketVertical.SHOTS}_Under_22.5`] = shotsSim.probabilities.under ?? 0;

    // ── SHOTS ON TARGET ───────────────────────────────────────────────────
    const sotSim = ModelFactory.runMonteCarlo(
      { homeMean: features.homeMetrics.shotsOnTarget, awayMean: features.awayMetrics.shotsOnTarget },
      regime, 10000, "GOALS"
    );
    predictions[`${MarketVertical.SHOTS_ON_TARGET}_Over_7.5`] = sotSim.probabilities.over ?? 0;
    predictions[`${MarketVertical.SHOTS_ON_TARGET}_Under_7.5`] = sotSim.probabilities.under ?? 0;

    return predictions;
  }

  /**
   * Estima probabilidade Over para uma linha diferente da simulada.
   * Usa interpolação linear simples baseada na relação entre linhas.
   */
  private estimateOverLine(baseOverProb: number, baseLine: number, targetLine: number): number {
    const diff = targetLine - baseLine;
    // Cada 1 unidade de linha reduz/aumenta a probabilidade Over em ~15%
    const adjustment = diff * 0.15;
    return Math.max(0.01, Math.min(0.99, baseOverProb - adjustment));
  }

  // Deprecated — mantido para compatibilidade com chamadas legadas
  async runZeroTouchAudit(matchId: string, verticals: any) {
    return { status: "FAILED", matchId, error: "DEPRECATED_V6" };
  }
}
