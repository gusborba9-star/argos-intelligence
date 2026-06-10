import { createClient } from "@supabase/supabase-js";
import { RegimeEngineV4, ExternalFactors } from "@/lib/argos/regime/RegimeEngineV4";
import { RAGContextEngine } from "@/lib/argos/regime/RAGContextEngine";
import { ModelFactory } from "@/lib/core/ModelFactory";
import { SignalClassifierV4 } from "@/lib/core/SignalClassifierV4";
import { ArgosSignal } from "@/lib/core/contracts/SignalContract";
import { MarketVertical } from "@/lib/core/ArgosUnifiedEngine";
import { AutoTuningEngine } from "@/lib/core/AutoTuningEngine";
import { DataIngestionService } from "@/lib/core/DataIngestionService";

// ============================================================
// ARGOS ORCHESTRATOR v4.5 — ZERO-TOUCH EDITION
// Inteligência Exponencial • Ingestão Automática • Insight-Out
// ============================================================

export interface AuditPayload {
  matchId: string;
  leagueId?: string;
  requestedVerticals: string[];
  externalFactors: ExternalFactors;
  baseMetrics: {
    home: Record<string, number>;
    away: Record<string, number>;
  };
}

export class ArgosOrchestratorV4 {
  private supabase;
  private regimeEngine: RegimeEngineV4;
  private ragEngine: RAGContextEngine;
  private autoTuner: AutoTuningEngine;
  private ingestionService: DataIngestionService;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    this.regimeEngine = new RegimeEngineV4(process.env.GOOGLE_API_KEY!);
    this.ragEngine = new RAGContextEngine(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      process.env.GOOGLE_API_KEY!
    );
    this.autoTuner = new AutoTuningEngine();
    this.ingestionService = new DataIngestionService(process.env.FOOTBALL_API_KEY || "");
  }

  /**
   * MODO ZERO-TOUCH: Auditoria autônoma a partir de um único matchId
   */
  async runZeroTouchAudit(matchId: string, requestedVerticals: string[]) {
    const startTime = Date.now();
    console.log(`[Argos v4.5] Iniciando Auditoria Zero-Touch para matchId: ${matchId}`);

    try {
      // 1. DATA INGESTION: Extração e Normalização Automática (Data-In)
      const ingestedData = await this.ingestionService.ingest(matchId);

      // 2. CACHE SEMÂNTICO: Verificar análise recente
      const { data: existingLedger } = await this.supabase
        .from("argos_signal_ledger")
        .select("regime, confidence")
        .eq("match_id", matchId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let regime;
      if (existingLedger) {
        console.log(`[Argos v4.5] Cache Hit. Reutilizando regime.`);
        regime = {
          regime: existingLedger.regime,
          confidence: existingLedger.confidence,
          model_bias: 0,
          variance_multiplier: 1.0,
          reasoning_tags: ["CACHED_ANALYSIS"],
          explanation: "Análise recuperada do cache local."
        };
      } else {
        // 2.1 AI ANALYSIS (RAG + Regime) - Cache Miss
        const context = await this.ragEngine.retrieveContext(matchId);
        regime = await this.regimeEngine.analyze({
          matchId,
          leagueId: ingestedData.leagueId,
          contextEvidence: context,
          factors: ingestedData.externalFactors
        });
      }

      // 3. AUTO-TUNING: Ajuste dinâmico baseado no histórico real
      const tuning = await this.autoTuner.tuneRegimeParameters(ingestedData.leagueId, regime.regime);
      regime.variance_multiplier *= tuning.suggestedVarianceMultiplier;
      regime.confidence += tuning.confidenceAdjustment;
      regime.reasoning_tags.push(`AUTO_TUNED_VAR_${tuning.suggestedVarianceMultiplier.toFixed(2)}`);

      // 4. MULTI-VERTICAL SIMULATION: Processamento Paralelo
      const simulationPromises = requestedVerticals.map(async (vertical) => {
        const payload: AuditPayload = {
          matchId,
          leagueId: ingestedData.leagueId,
          requestedVerticals,
          externalFactors: ingestedData.externalFactors,
          baseMetrics: {
            home: {
              goals: ingestedData.home.goals,
              corners: ingestedData.home.corners,
              cards: ingestedData.home.cards,
              shots: ingestedData.home.shots
            },
            away: {
              goals: ingestedData.away.goals,
              corners: ingestedData.away.corners,
              cards: ingestedData.away.cards,
              shots: ingestedData.away.shots
            }
          }
        };
        return this.processVertical(vertical, payload, regime);
      });

      const rawSignals = (await Promise.all(simulationPromises)).flat();

      // 5. CLASSIFICAÇÃO E PERSISTÊNCIA EM LOTE
      const classifiedSignals = SignalClassifierV4.classify(rawSignals, regime);
      
      if (classifiedSignals.length > 0) {
        const ledgerEntries = SignalClassifierV4.prepareLedger(
          matchId,
          ingestedData.leagueId,
          classifiedSignals,
          regime
        );

        const { error: persistError } = await this.supabase
          .from("argos_signal_ledger")
          .insert(ledgerEntries);

        if (persistError) throw persistError;
      }

      return {
        status: "SUCCESS",
        matchId,
        regime: regime.regime,
        signalsFound: classifiedSignals.length,
        executionTimeMs: Date.now() - startTime,
        signals: classifiedSignals
      };

    } catch (error: any) {
      console.error(`[Argos v4.5] Zero-Touch Error: ${error.message}`);
      return {
        status: "FAILED",
        matchId,
        error: error.message,
        executionTimeMs: Date.now() - startTime
      };
    }
  }

  /**
   * Processa uma vertical específica de mercado
   */
  private async processVertical(
    vertical: string,
    payload: AuditPayload,
    regime: any
  ): Promise<ArgosSignal[]> {
    const signals: ArgosSignal[] = [];

    switch (vertical) {
      case 'WINNER':
        const winnerSim = ModelFactory.runMonteCarlo(
          { homeMean: payload.baseMetrics.home.goals || 1.2, awayMean: payload.baseMetrics.away.goals || 1.0 },
          regime,
          1500,
          'GOALS'
        );
        signals.push({
          market: "HOME_WIN",
          vertical: MarketVertical.WINNER,
          probability: winnerSim.probabilities.home,
          expectedValue: (winnerSim.probabilities.home * 2.0) - 1,
          status: "OPTIMIZED" as any
        });
        break;

      case 'CORNERS':
        const cornerSim = ModelFactory.modelCorners(
          payload.baseMetrics.home.corners || 5.0,
          payload.baseMetrics.away.corners || 4.0,
          regime
        );
        signals.push({
          market: "OVER_9_5_CORNERS",
          vertical: MarketVertical.CORNERS,
          probability: cornerSim.probabilities.home + cornerSim.probabilities.away,
          expectedValue: ((cornerSim.probabilities.home + cornerSim.probabilities.away) * 1.8) - 1,
          status: "OPTIMIZED" as any
        });
        break;

      case 'CARDS':
        const cardSim = ModelFactory.modelCards(
          payload.baseMetrics.home.cards || 2.0,
          payload.baseMetrics.away.cards || 2.5,
          payload.externalFactors.refereeStrictness || 1.0,
          regime
        );
        signals.push({
          market: "OVER_4_5_CARDS",
          vertical: MarketVertical.CARDS,
          probability: cardSim.probabilities.home + cardSim.probabilities.away,
          expectedValue: ((cardSim.probabilities.home + cardSim.probabilities.away) * 1.9) - 1,
          status: "OPTIMIZED" as any
        });
        break;

      case 'BTTS':
        const probH = 1 - Math.exp(-(payload.baseMetrics.home.goals || 1.2));
        const probA = 1 - Math.exp(-(payload.baseMetrics.away.goals || 1.0));
        const probBTTS = probH * probA;
        
        signals.push({
          market: "BTTS_YES",
          vertical: MarketVertical.BTTS,
          probability: probBTTS,
          expectedValue: (probBTTS * 1.9) - 1,
          status: "OPTIMIZED" as any
        });
        break;

      case 'SHOTS':
        const shotSim = ModelFactory.runMonteCarlo(
          { homeMean: payload.baseMetrics.home.shots || 12, awayMean: payload.baseMetrics.away.shots || 10 },
          regime,
          1500,
          'SHOTS'
        );
        signals.push({
          market: "OVER_22_5_SHOTS",
          vertical: MarketVertical.SHOTS,
          probability: shotSim.probabilities.home + shotSim.probabilities.away,
          expectedValue: ((shotSim.probabilities.home + shotSim.probabilities.away) * 1.85) - 1,
          status: "OPTIMIZED" as any
        });
        break;

      case 'HANDICAP':
        const handicapSim = ModelFactory.runMonteCarlo(
          { homeMean: payload.baseMetrics.home.goals || 1.2, awayMean: payload.baseMetrics.away.goals || 1.0 },
          regime,
          1500,
          'GOALS'
        );
        signals.push({
          market: "AH_-0.5_HOME",
          vertical: MarketVertical.HANDICAP,
          probability: handicapSim.probabilities.home,
          expectedValue: (handicapSim.probabilities.home * 2.0) - 1,
          status: "OPTIMIZED" as any
        });
        break;
    }

    return signals;
  }
}
