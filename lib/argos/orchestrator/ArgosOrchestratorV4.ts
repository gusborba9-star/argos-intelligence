import { getSupabaseClient } from "@/lib/core/SupabaseClient";
import { SupabaseClient } from "@supabase/supabase-js";
import { RegimeEngineV4 } from "@/lib/argos/regime/RegimeEngineV4";
import { RAGContextEngine } from "@/lib/argos/regime/RAGContextEngine";
import { ModelFactory } from "@/lib/core/ModelFactory";
import { SignalClassifierV4 } from "@/lib/core/SignalClassifierV4";
import { MarketVertical } from "@/lib/core/ArgosUnifiedEngine";
import { DataIngestionService } from "@/lib/core/DataIngestionService";
import { FeatureEngine } from "@/lib/core/FeatureEngine";
import { MarketNormalizer } from "@/lib/core/market-intelligence/MarketNormalizer";
import { MarketDiscoveryEngine } from "@/lib/core/market-intelligence/MarketDiscoveryEngine";
import { SignalDistributionEngine, DistributedSignal } from "@/lib/core/market-intelligence/SignalDistributionEngine";
import { RegimeProfile } from "@/lib/argos/regime/RegimeSchema";
import { TelegramDispatcher } from "@/lib/argos/notifications/TelegramDispatcher";

/**
 * ARGOS ORCHESTRATOR v6.0.0 — SYNDICATE MASTER EDITION
 * Arquitetura de Fluxo Único com Inteligência de Mercado Real.
 */
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

  async runSyndicateAudit(fixturePayload: any): Promise<any> {
    const startTime = Date.now();
    const matchId = (fixturePayload.id || fixturePayload.match_id).toString();
    
    console.log(`[Argos v6.0.0] 🛡️ Auditoria Master iniciada para: ${matchId}`);

    try {
      // 1. Normalização & Ingestão
      const normalizedMarkets = MarketNormalizer.normalize(fixturePayload);
      const ingestedData = await this.ingestionService.ingestObject(fixturePayload);
      const features = FeatureEngine.generateFeatureVector(ingestedData);

      // 2. Inteligência de Contexto (RAG + Regime)
      const context = await this.ragEngine.retrieveContext(matchId, ingestedData.leagueId);
      const regime = await this.regimeEngine.analyze({
        matchId,
        leagueId: ingestedData.leagueId,
        contextEvidence: context,
        factors: ingestedData.externalFactors,
      });

      // 3. Simulações Multi-Vertical
      const modelPredictions: { [key: string]: number } = {};
      const verticals = [
        MarketVertical.WINNER, MarketVertical.GOALS, 
        MarketVertical.CORNERS, MarketVertical.BTTS,
        MarketVertical.CARDS
      ];

      for (const vertical of verticals) {
        const sim = await this.runSimulation(vertical, features, regime);
        if (sim) {
          Object.entries(sim.probabilities).forEach(([sel, prob]) => {
            const key = sel.toUpperCase();
            modelPredictions[`${vertical}_${key}_0`] = prob as number;
            // Mapeamento específico para Totais
            if (vertical === MarketVertical.GOALS || vertical === MarketVertical.CORNERS) {
              modelPredictions[`${vertical}_OVER_2.5`] = sim.probabilities.over || 0;
              modelPredictions[`${vertical}_UNDER_2.5`] = sim.probabilities.under || 0;
            }
          });
        }
      }

      // 4. Discovery Engine (EV + Edge + Liquidity)
      const opportunities = MarketDiscoveryEngine.discover(normalizedMarkets, modelPredictions);

      // 5. Distribution Engine (FREE vs VIP Selection)
      const distributedSignals = SignalDistributionEngine.process(opportunities, regime);

      // 6. Entrega & Persistência
      if (distributedSignals.length > 0) {
        const ledgerEntries = SignalClassifierV4.prepareLedger(matchId, ingestedData.leagueId, distributedSignals as any, regime);
        await this.supabase.from("argos_signal_ledger").insert(ledgerEntries);

        await this.telegramDispatcher.dispatch(distributedSignals as any, regime);
        console.log(`[Argos-Success] ✅ ${distributedSignals.length} sinais de elite despachados.`);
      }

      return {
        matchId,
        status: "SUCCESS",
        signals: distributedSignals.length,
        executionTime: Date.now() - startTime
      };

    } catch (error: any) {
      console.error(`[Argos-Critical] ❌ Erro na Auditoria Master: ${error.message}`);
      return { status: "FAILED", matchId, error: error.message };
    }
  }

  private async runSimulation(vertical: MarketVertical, features: any, regime: RegimeProfile) {
    const metrics = { 
      homeMean: features.homeMetrics.goals, 
      awayMean: features.awayMetrics.goals 
    };
    
    switch (vertical) {
      case MarketVertical.WINNER: return ModelFactory.runMonteCarlo(metrics, regime);
      case MarketVertical.GOALS: return ModelFactory.runMonteCarlo(metrics, regime, 10000, "GOALS");
      case MarketVertical.CORNERS: 
        return ModelFactory.runMonteCarlo(
          { homeMean: features.homeMetrics.corners, awayMean: features.awayMetrics.corners }, 
          regime, 10000, "CORNERS"
        );
      default: return null;
    }
  }

  // Deprecated
  async runZeroTouchAudit(matchId: string, verticals: any) {
    return { status: "FAILED", matchId, error: "DEPRECATED_V6" };
  }
}
