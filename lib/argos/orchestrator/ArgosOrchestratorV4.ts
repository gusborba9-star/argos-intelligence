import { getSupabaseClient } from "@/lib/core/SupabaseClient";
import { RegimeEngineV4, ExternalFactors } from "@/lib/argos/regime/RegimeEngineV4";
import { RAGContextEngine } from "@/lib/argos/regime/RAGContextEngine";
import { ModelFactory } from "@/lib/core/ModelFactory";
import { SignalClassifierV4 } from "@/lib/core/SignalClassifierV4";
import { ArgosSignal } from "@/lib/core/contracts/SignalContract";
import { MarketVertical } from "@/lib/core/ArgosUnifiedEngine";
import { AutoTuningEngine } from "@/lib/core/AutoTuningEngine";
import { DataIngestionService } from "@/lib/core/DataIngestionService";
import { AnomalyDetectionService } from "@/lib/argos/auditor/AnomalyDetectionService";

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
  marketOdds?: { [key: string]: number }; // Adicionado para AnomalyDetectionService
}

export class ArgosOrchestratorV4 {
  private supabase;
  private regimeEngine: RegimeEngineV4;
  private ragEngine: RAGContextEngine;
  private autoTuner: AutoTuningEngine;
  private ingestionService: DataIngestionService;
  private anomalyDetector: AnomalyDetectionService;

  constructor() {
    this.supabase = getSupabaseClient();
    this.regimeEngine = new RegimeEngineV4(process.env.GOOGLE_API_KEY!);
    this.ragEngine = new RAGContextEngine(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      process.env.GOOGLE_API_KEY!
    );
    this.autoTuner = new AutoTuningEngine();
    this.ingestionService = new DataIngestionService();
    this.anomalyDetector = new AnomalyDetectionService();
  }

  /**
   * MODO ZERO-TOUCH: Auditoria autônoma a partir de um único matchId
   * @param liveData Dados em tempo real (opcional) { score: { home: number, away: number }, elapsed: number }
   */
  async runZeroTouchAudit(
    matchId: string, 
    requestedVerticals: string[], 
    marketOdds?: { [key: string]: number },
    liveData?: { score: { home: number, away: number }, elapsed: number }
  ) {
    const startTime = Date.now();
    console.log(`[Argos v5.0] Iniciando Auditoria Zero-Touch para matchId: ${matchId}`);

    try {
      // 1. DATA INGESTION: Extração e Normalização Automática (Data-In)
      const ingestedData = await this.ingestionService.ingest(matchId);
      
      // Ajuste de Live Data se disponível
      const currentScore = liveData?.score || { home: 0, away: 0 };
      const elapsed = liveData?.elapsed || 0;

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

      // 4. MULTI-VERTICAL SIMULATION: Processamento Paralelo (1.500 simulações/vertical)
      // Se nenhuma vertical for solicitada, processar todas as 7 verticais padrão
      const verticalsToProcess = requestedVerticals.length > 0 
        ? requestedVerticals 
        : ["WINNER", "GOALS", "CORNERS", "CARDS", "BTTS", "SHOTS", "HANDICAP"];

      const simulationPromises = verticalsToProcess.map(async (vertical) => {
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
        return this.processVertical(vertical, payload, regime, elapsed, currentScore);
      });

      const rawSignals = (await Promise.all(simulationPromises)).flat();

      // 5. CLASSIFICAÇÃO E PERSISTÊNCIA EM LOTE
      let classifiedSignals = SignalClassifierV4.classify(rawSignals, regime);

      // 6. DETECÇÃO DE ANOMALIAS: Comparar com odds de mercado e emitir alertas
      if (marketOdds && classifiedSignals.length > 0) {
        const anomalyAlerts = this.anomalyDetector.detectAnomalies(classifiedSignals, marketOdds);
        anomalyAlerts.forEach(alert => console.warn(alert));
      }
      
      if (classifiedSignals.length > 0) {
        const ledgerEntries = SignalClassifierV4.prepareLedger(
          matchId,
          ingestedData.leagueId,
          classifiedSignals,
          regime
        );

        const { data: persistedSignals, error: persistError } = await this.supabase
          .from("argos_signal_ledger")
          .insert(ledgerEntries)
          .select("id"); // Seleciona o ID dos sinais inseridos

        if (persistedSignals) {
          // Mapeia os IDs de volta para os sinais classificados
          classifiedSignals = classifiedSignals.map((signal, index) => ({
            ...signal,
            id: persistedSignals[index].id,
          }));
        }

        if (persistError) {
          console.error("[Argos v4.5.1] Erro na Persistência do Ledger:", {
            message: persistError.message,
            code: persistError.code,
            details: persistError.details,
            hint: persistError.hint
          });
          throw new Error(`Supabase Persistence Error [${persistError.code}]: ${persistError.message} (${persistError.details || 'no details'})`);
        }
      }

      const executionTimeMs = Date.now() - startTime;
      console.log(`[Argos v5.0] Auditoria concluída em ${executionTimeMs}ms para ${matchId}`);

      return {
        matchId,
        status: "SUCCESS",
        classifiedSignals: classifiedSignals.map(s => ({ ...s, id: s.id || '' })), // Garante que o ID esteja presente
        regime,
        executionTimeMs
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
    regime: any,
    elapsed: number = 0,
    currentScore: { home: number, away: number } = { home: 0, away: 0 }
  ): Promise<ArgosSignal[]> {
    const signals: ArgosSignal[] = [];

    switch (vertical) {
      case 'WINNER':
        const winnerSim = ModelFactory.runMonteCarlo(
          { homeMean: payload.baseMetrics.home.goals || 1.2, awayMean: payload.baseMetrics.away.goals || 1.0 },
          regime,
          1500,
          'GOALS',
          elapsed,
          currentScore
        );
        signals.push({
          matchId: payload.matchId,
          market: "HOME_WIN",
          vertical: MarketVertical.WINNER,
          probability: winnerSim.probabilities.home,
          expectedValue: (winnerSim.probabilities.home * 2.0) - 1,
          status: "OPTIMIZED" as any
        });

        // CHAMELEON: Inversão para DRAW ou AWAY se o favorito acomodar
        if (winnerSim.probabilities.home < 0.30 && elapsed > 60) {
          signals.push({
            matchId: payload.matchId,
            market: "X2_DOUBLE_CHANCE",
            vertical: MarketVertical.WINNER,
            probability: winnerSim.probabilities.draw + winnerSim.probabilities.away,
            expectedValue: ((winnerSim.probabilities.draw + winnerSim.probabilities.away) * 1.7) - 1,
            status: "HEDGED" as any,
            reasoning: "Chameleon Logic: Favorito em baixa intensidade. Valor em Dupla Chance."
          } as any);
        }
        break;

      case 'CORNERS':
        const cornerSim = ModelFactory.modelCorners(
          payload.baseMetrics.home.corners || 5.0,
          payload.baseMetrics.away.corners || 4.0,
          regime
        );
        const probOverCorners = cornerSim.probabilities.home + cornerSim.probabilities.away;
        signals.push({
          matchId: payload.matchId,
          market: "OVER_9_5_CORNERS",
          vertical: MarketVertical.CORNERS,
          probability: probOverCorners,
          expectedValue: (probOverCorners * 1.8) - 1,
          status: "OPTIMIZED" as any
        });

        // CHAMELEON: Inversão para UNDER_CORNERS em regime de acomodação
        const probUnderCorners = 1 - probOverCorners;
        if (probUnderCorners > 0.70) {
          signals.push({
            matchId: payload.matchId,
            market: "UNDER_9_5_CORNERS",
            vertical: MarketVertical.CORNERS,
            probability: probUnderCorners,
            expectedValue: (probUnderCorners * 1.85) - 1,
            status: "HEDGED" as any,
            reasoning: "Chameleon Logic: Jogo esfriou. Valor estratégico em UNDER Escanteios."
          } as any);
        }
        break;

      case 'CARDS':
        const cardSim = ModelFactory.modelCards(
          payload.baseMetrics.home.cards || 2.0,
          payload.baseMetrics.away.cards || 2.5,
          payload.externalFactors.refereeStrictness || 1.0,
          regime
        );
        signals.push({
          matchId: payload.matchId,
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
          matchId: payload.matchId,
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
          'SHOTS',
          elapsed,
          { home: 0, away: 0 } // Shots não acumulam no placar para fins de simulação de Poisson residual
        );
        signals.push({
          matchId: payload.matchId,
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
          'GOALS',
          elapsed,
          currentScore
        );
        signals.push({
          matchId: payload.matchId,
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
