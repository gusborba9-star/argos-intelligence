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

// ============================================================
// ARGOS ORCHESTRATOR v6.1.1 — SYNDICATE MASTER EDITION
// Instrumentação Completa de Motores (STEP 2-11)
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
  distributedSignals?: DistributedSignal[];
}

export class ArgosOrchestratorV4 {
  private supabase: SupabaseClient;
  private regimeEngine: RegimeEngineV4;
  private ragEngine: RAGContextEngine;
  private ingestionService: DataIngestionService;

  constructor(ingestionService?: DataIngestionService, supabaseClient?: SupabaseClient) {
    this.supabase = supabaseClient || getSupabaseClient();
    this.regimeEngine = new RegimeEngineV4(process.env.GOOGLE_API_KEY!);
    this.ragEngine = new RAGContextEngine(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      process.env.GOOGLE_API_KEY!
    );
    this.ingestionService = ingestionService || new DataIngestionService();
  }

  private logStep(step: string, queueItemId: string, startTime: number, extra: any = {}) {
    const now = new Date().toISOString();
    const elapsed = Date.now() - startTime;
    console.log(`[INSTRUMENTATION] [${now}] [${queueItemId || 'DIRECT'}] ${step} | Elapsed: ${elapsed}ms`, extra);
  }

  /**
   * FLUXO SYNDICATE MASTER v6.1.1
   * Executa a auditoria completa de uma partida com todos os motores integrados.
   */
  async runSyndicateAudit(fixturePayload: any, queueItemId: string = "DIRECT"): Promise<SyndicateAuditResult> {
    const startTime = Date.now();
    const matchId = (
      fixturePayload.id ||
      fixturePayload.match_id ||
      fixturePayload.fixture?.id
    ).toString();

    console.log(`[Argos v6.1.1] 🛡️ Auditoria Master iniciada para: ${matchId}`);

    try {
      // 1. MarketNormalizer (STEP 2-3)
      this.logStep("STEP 2 - MarketNormalizer started", queueItemId, startTime);
      const normalizedMarkets = MarketNormalizer.normalize(fixturePayload);
      const normalizationReport = MarketNormalizer.generateReport(normalizedMarkets);
      this.logStep("STEP 3 - MarketNormalizer finished", queueItemId, startTime, { markets: normalizedMarkets.length });

      // 2. Feature Engine (STEP 4-5)
      this.logStep("STEP 4 - FeatureEngine started", queueItemId, startTime);
      const ingestedData = await this.ingestionService.ingestObject(fixturePayload);
      const features = FeatureEngine.generateFeatureVector(ingestedData);
      this.logStep("STEP 5 - FeatureEngine finished", queueItemId, startTime);

      // 3. RAG + Regime Engine (STEP 6-7 part 1)
      this.logStep("STEP 6 - MonteCarlo + RAG started", queueItemId, startTime);
      const context = await this.ragEngine.retrieveContext(matchId, ingestedData.leagueId);
      const regime = await this.regimeEngine.analyze({
        matchId,
        leagueId: ingestedData.leagueId,
        contextEvidence: context,
        factors: ingestedData.externalFactors,
      });

      // 4. Monte Carlo Simulation + Continuous Learning Calibration (STEP 6-7 part 2)
      const modelPredictions = await this.runFullMarketSimulation(features, regime, ingestedData.leagueId);
      this.logStep("STEP 7 - MonteCarlo finished", queueItemId, startTime);

      // 5. Market Intelligence Layer (Discovery) (STEP 8-9)
      this.logStep("STEP 8 - MarketDiscovery started", queueItemId, startTime);
      const opportunities = MarketDiscoveryEngine.discover(normalizedMarkets, modelPredictions);
      const discoveryReport = MarketDiscoveryEngine.generateReport(opportunities);
      this.logStep("STEP 9 - MarketDiscovery finished", queueItemId, startTime, { opportunities: opportunities.length });

      // 6. Signal Distribution Engine (FREE vs VIP) & Telegram Dispatch (STEP 10-11)
      this.logStep("STEP 10 - SignalDistribution started", queueItemId, startTime);
      const matchContext = {
        name: `${fixturePayload.home_team || fixturePayload.teams?.home?.name || 'Home'} vs ${fixturePayload.away_team || fixturePayload.teams?.away?.name || 'Away'}`,
        league: fixturePayload.league?.name || "Elite League",
        kickoff: fixturePayload.kickoff_at || fixturePayload.fixture?.date || new Date().toISOString()
      };

      const distributedSignals = await SignalDistributionEngine.processAndDispatch(
        opportunities, 
        regime,
        matchContext
      );
      this.logStep("STEP 11 - SignalDistribution finished", queueItemId, startTime, { signals: distributedSignals.length });

      // 7. Persistência no Ledger para Aprendizado Futuro
      if (distributedSignals.length > 0) {
        const ledgerEntries = SignalClassifierV4.prepareLedger(
          matchId,
          ingestedData.leagueId,
          distributedSignals as any,
          regime
        );
        await this.supabase.from("argos_signal_ledger").insert(ledgerEntries);
        console.log(`[Argos-Success] ✅ ${distributedSignals.length} sinais processados e despachados.`);
      }

      return {
        matchId,
        status: distributedSignals.length > 0 ? "SUCCESS" : "NO_VALUE",
        signals: distributedSignals.length,
        executionTime: Date.now() - startTime,
        normalizationReport,
        discoveryReport,
        regime,
        distributedSignals
      };
    } catch (error: any) {
      console.error(`[Argos-Critical] [${queueItemId}] ❌ Erro na Auditoria Master para ${matchId}: ${error.message}`);
      console.error(`[INSTRUMENTATION] [${queueItemId}] STACK TRACE:`, error.stack);
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
   * Agora integra a calibração do Continuous Learning Engine.
   */
  private async runFullMarketSimulation(
    features: any,
    regime: RegimeProfile,
    leagueId: string
  ): Promise<{ [key: string]: number }> {
    const predictions: { [key: string]: number } = {};

    // WINNER (1X2)
    const winnerSim = await ModelFactory.runMonteCarloWithLearning(
      { homeMean: features.homeMetrics.goals, awayMean: features.awayMetrics.goals },
      regime, leagueId, "GOALS"
    );
    predictions[`${MarketVertical.WINNER}_Home_0`] = winnerSim.probabilities.home;
    predictions[`${MarketVertical.WINNER}_Draw_0`] = winnerSim.probabilities.draw;
    predictions[`${MarketVertical.WINNER}_Away_0`] = winnerSim.probabilities.away;

    // HANDICAP
    predictions[`${MarketVertical.HANDICAP}_Home_0`] = winnerSim.probabilities.home;
    predictions[`${MarketVertical.HANDICAP}_Away_0`] = winnerSim.probabilities.away;

    // GOALS (Over/Under)
    const goalsSim = await ModelFactory.runMonteCarloWithLearning(
      { homeMean: features.homeMetrics.goals, awayMean: features.awayMetrics.goals },
      regime, leagueId, "GOALS"
    );
    predictions[`${MarketVertical.GOALS}_Over_2.5`] = goalsSim.probabilities.over ?? 0;
    predictions[`${MarketVertical.GOALS}_Under_2.5`] = goalsSim.probabilities.under ?? 0;

    // GOALS HT
    const goalsHTSim = await ModelFactory.runMonteCarloWithLearning(
      { homeMean: features.homeMetrics.goalsHT, awayMean: features.awayMetrics.goalsHT },
      regime, leagueId, "GOALS"
    );
    predictions[`${MarketVertical.GOALS_HT}_Over_0.5`] = goalsHTSim.probabilities.over ?? 0;
    predictions[`${MarketVertical.GOALS_HT}_Under_0.5`] = goalsHTSim.probabilities.under ?? 0;

    // BTTS
    const pHomeScores = 1 - Math.exp(-features.homeMetrics.goals);
    const pAwayScores = 1 - Math.exp(-features.awayMetrics.goals);
    const bttsProb = pHomeScores * pAwayScores;
    predictions[`${MarketVertical.BTTS}_Yes_0`] = bttsProb;
    predictions[`${MarketVertical.BTTS}_No_0`] = 1 - bttsProb;

    // CORNERS
    const cornersSim = await ModelFactory.runMonteCarloWithLearning(
      { homeMean: features.homeMetrics.corners, awayMean: features.awayMetrics.corners },
      regime, leagueId, "CORNERS"
    );
    predictions[`${MarketVertical.CORNERS}_Over_9.5`] = cornersSim.probabilities.over ?? 0;
    predictions[`${MarketVertical.CORNERS}_Under_9.5`] = cornersSim.probabilities.under ?? 0;

    // CARDS
    const cardsSim = await ModelFactory.runMonteCarloWithLearning(
      { homeMean: features.homeMetrics.cards, awayMean: features.awayMetrics.cards },
      regime, leagueId, "CARDS"
    );
    predictions[`${MarketVertical.CARDS}_Over_3.5`] = cardsSim.probabilities.over ?? 0;
    predictions[`${MarketVertical.CARDS}_Under_3.5`] = cardsSim.probabilities.under ?? 0;

    return predictions;
  }
}
