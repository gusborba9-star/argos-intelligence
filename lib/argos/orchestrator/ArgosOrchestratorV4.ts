import { createClient } from "@supabase/supabase-js";
import { RegimeEngineV4, ExternalFactors } from "@/lib/argos/regime/RegimeEngineV4";
import { RAGContextEngine } from "@/lib/argos/regime/RAGContextEngine";
import { ModelFactory } from "@/lib/core/ModelFactory";
import { SignalClassifierV4, SignalType, ClassifiedSignal } from "@/lib/core/SignalClassifierV4";
import { ArgosSignal } from "@/lib/core/contracts/SignalContract";
import { MarketVertical } from "@/lib/core/ArgosUnifiedEngine";
import { AutoTuningEngine } from "@/lib/core/AutoTuningEngine";

// ============================================================
// ARGOS ORCHESTRATOR v4.4 — ADAPTIVE BRAIN EDITION
// Suporte massivo multi-vertical, paralelo e auto-ajustável
// ============================================================

export interface AuditPayload {
  matchId: string;
  leagueId?: string;
  requestedVerticals: ('WINNER' | 'GOALS' | 'CORNERS' | 'CARDS' | 'SHOTS' | 'BTTS' | 'HANDICAP')[];
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
  }

  /**
   * Executa a auditoria completa de mercado para um jogo
   */
  async runAudit(payload: AuditPayload) {
    const startTime = Date.now();
    console.log(`[Argos v4.2] Iniciando auditoria para o jogo: ${payload.matchId}`);

    try {
      // 1. CACHE SEMÂNTICO: Verificar se já existe análise recente para este jogo
      const { data: existingLedger } = await this.supabase
        .from("argos_signal_ledger")
        .select("regime, confidence")
        .eq("match_id", payload.matchId)
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      let regime;
      let context;

      if (existingLedger) {
        console.log(`[Argos v4.4] Cache Hit para matchId: ${payload.matchId}. Reutilizando regime.`);
        regime = {
          regime: existingLedger.regime,
          confidence: existingLedger.confidence,
          model_bias: 0,
          variance_multiplier: 1.0,
          reasoning_tags: ["CACHED_ANALYSIS"],
          explanation: "Análise recuperada do cache local."
        };
      } else {
        // 1.1 Extração de Contexto (RAG) - Cache Miss
        context = await this.ragEngine.retrieveContext(payload.matchId);

        // 2. Definição de Regime de Mercado via AI
        regime = await this.regimeEngine.analyze({
          matchId: payload.matchId,
          leagueId: payload.leagueId,
          contextEvidence: context,
          factors: payload.externalFactors
        });
      }

      // 2.1 AUTO-TUNING: Ajustar regime com base no histórico real
      if (payload.leagueId) {
        const tuning = await this.autoTuner.tuneRegimeParameters(payload.leagueId, regime.regime);
        regime.variance_multiplier *= tuning.suggestedVarianceMultiplier;
        regime.confidence += tuning.confidenceAdjustment;
        regime.reasoning_tags.push(`AUTO_TUNED_VAR_${tuning.suggestedVarianceMultiplier}`);
      }

      // 3. Processamento Paralelo de Verticais (Market Factory Pattern)
      const simulationPromises = payload.requestedVerticals.map(async (vertical) => {
        return this.processVertical(vertical, payload, regime);
      });

      const rawSignals = (await Promise.all(simulationPromises)).flat();

      // 4. Tripla Classificação de Sinais
      const classifiedSignals = SignalClassifierV4.classify(rawSignals, regime);

      // 5. Persistência em Lote (Batch Insert) no Supabase
      if (classifiedSignals.length > 0) {
        const ledgerEntries = SignalClassifierV4.prepareLedger(
          payload.matchId,
          payload.leagueId,
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
        matchId: payload.matchId,
        regime: regime.regime,
        signalsFound: classifiedSignals.length,
        executionTimeMs: Date.now() - startTime,
        signals: classifiedSignals
      };

    } catch (error: any) {
      console.error(`[Argos v4.2] Erro na auditoria: ${error.message}`);
      return {
        status: "FAILED",
        matchId: payload.matchId,
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
          expectedValue: (winnerSim.probabilities.home * 2.0) - 1, // Exemplo de odd
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
          probability: cornerSim.probabilities.home + cornerSim.probabilities.away, // Simplificado
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
        const bttsSim = ModelFactory.runMonteCarlo(
          { homeMean: payload.baseMetrics.home.goals || 1.2, awayMean: payload.baseMetrics.away.goals || 1.0 },
          regime,
          1500,
          'GOALS'
        );
        // BTTS Yes = Ambos marcam pelo menos 1 gol
        // Simplificação probabilística: P(H>0) * P(A>0)
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
        // Exemplo: Handicap Asiático -0.5 (mesmo que Home Win)
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
