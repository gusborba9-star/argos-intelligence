import { getSupabaseClient } from "@/lib/core/SupabaseClient";
import { SupabaseClient } from "@supabase/supabase-js";
import { RegimeEngineV4, ExternalFactors } from "@/lib/argos/regime/RegimeEngineV4";
import { RAGContextEngine } from "@/lib/argos/regime/RAGContextEngine";
import { ModelFactory, SimulationResult } from "@/lib/core/ModelFactory";
import { SignalClassifierV4 } from "@/lib/core/SignalClassifierV4";
import { ArgosSignal } from "@/lib/core/contracts/SignalContract";
import { MarketVertical } from "@/lib/core/ArgosUnifiedEngine";
import { AutoTuningEngine, TuningResult } from "@/lib/core/AutoTuningEngine";
import { DataIngestionService, IngestedData } from "@/lib/core/DataIngestionService";
import { FeatureEngine } from "@/lib/core/FeatureEngine";
import { LeagueValueScoreEngine } from "@/lib/argos/ingestion/LeagueValueScoreEngine";
import { MarketSelectorEngine } from "@/lib/core/MarketSelectorEngine";
import { AnomalyDetectionService } from "@/lib/argos/auditor/AnomalyDetectionService";
import { RegimeProfile, MarketRegime } from "@/lib/argos/regime/RegimeSchema";
import { TelegramDispatcher } from "@/lib/argos/notifications/TelegramDispatcher";

// ============================================================
// ARGOS ORCHESTRATOR v5.0 — INDUSTRIAL EDITION
// Inteligência Exponencial • Ingestão Reativa • Anti-Fragilidade • Telemetria
// ============================================================

export interface AuditPayload {
  matchId: string;
  leagueId?: string;
  requestedVerticals: MarketVertical[];
  externalFactors: ExternalFactors;
  baseMetrics: {
    home: { goals: number; corners: number; cards: number; shots: number };
    away: { goals: number; corners: number; cards: number; shots: number };
  };
  marketOdds?: { [key: string]: number };
}

export interface AuditResult {
  matchId: string;
  status: "SUCCESS" | "FAILED";
  classifiedSignals?: ArgosSignal[];
  regime?: RegimeProfile;
  executionTimeMs: number;
  error?: string;
}

export class ArgosOrchestratorV4 {
  private supabase: SupabaseClient;
  private regimeEngine: RegimeEngineV4;
  private ragEngine: RAGContextEngine;
  private autoTuner: AutoTuningEngine;
  private ingestionService: DataIngestionService;
  private anomalyDetector: AnomalyDetectionService;
  private telegramDispatcher: TelegramDispatcher;

  constructor(ingestionService?: DataIngestionService, supabaseClient?: SupabaseClient) {
    this.supabase = supabaseClient || getSupabaseClient();
    this.regimeEngine = new RegimeEngineV4(process.env.GOOGLE_API_KEY!);
    this.ragEngine = new RAGContextEngine(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      process.env.GOOGLE_API_KEY!
    );
    this.autoTuner = new AutoTuningEngine(supabaseClient);
    this.ingestionService = ingestionService || new DataIngestionService();
    this.anomalyDetector = new AnomalyDetectionService();
    this.telegramDispatcher = new TelegramDispatcher();
  }

  /**
   * MODO ZERO-TOUCH: Auditoria autônoma a partir de um único matchId
   * @param liveData Dados em tempo real (opcional) { score: { home: number, away: number }, elapsed: number }
   */
  async runZeroTouchAudit(
    matchId: string,
    requestedVerticals: MarketVertical[],
    marketOdds?: { [key: string]: number },
    liveData?: { score: { home: number; away: number }; elapsed: number }
  ): Promise<AuditResult> {
    const startTime = Date.now();
    console.log(`[Argos v5.0] Iniciando Auditoria Zero-Touch para matchId: ${matchId}`);

    try {
      // 1. DATA INGESTION: Extração e Normalização Automática (Data-In)
      let ingestedData: IngestedData;
      try {
        ingestedData = await this.ingestionService.ingest(matchId);
      } catch (ingestionError: any) {
        if (ingestionError.message.includes("not found")) {
          console.warn(`[Argos v5.0] Fixture ${matchId} não encontrada na API. Pulando auditoria.`);
          return {
            matchId,
            status: "SUCCESS", // Retornar SUCCESS para evitar quebra do cron, mas sem sinais
            error: "NOT_FOUND",
            executionTimeMs: Date.now() - startTime,
          };
        }
        throw ingestionError;
      }

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

      let regime: RegimeProfile;
      if (existingLedger) {
        console.log(`[Argos v5.0] Cache Hit. Reutilizando regime.`);
        regime = {
          regime: existingLedger.regime as MarketRegime,
          confidence: existingLedger.confidence as number,
          model_bias: 0,
          variance_multiplier: 1.0,
          reasoning_tags: ["CACHED_ANALYSIS"],
          explanation: "Análise recuperada do cache local.",
        };
      } else {
        // 2.1 AI ANALYSIS (RAG + Regime) - Cache Miss
        const context = await this.ragEngine.retrieveContext(matchId);
        regime = await this.regimeEngine.analyze({
          matchId,
          leagueId: ingestedData.leagueId,
          contextEvidence: context,
          factors: ingestedData.externalFactors,
        });
      }

      // 3. ANTI-FRAGILITY ENGINE & AUTO-TUNING: Ajuste dinâmico baseado no histórico real
      const tuning: TuningResult = await this.autoTuner.tuneRegimeParameters(ingestedData.leagueId, regime.regime);
      regime.variance_multiplier *= tuning.suggestedVarianceMultiplier;
      regime.confidence += tuning.confidenceAdjustment;
      regime.reasoning_tags.push(`AUTO_TUNED_VAR_${tuning.suggestedVarianceMultiplier.toFixed(2)}`);

      // 4. MATCH ENGINE (Decisão de Nível de Jogo)
      const today = new Date();
      const timeToKickoffMinutes = (new Date(ingestedData.fixture.fixture.date).getTime() - today.getTime()) / (1000 * 60);
      const leagueProfile = this.ingestionService.getLeagueProfile(ingestedData.fixture.league.id, ingestedData.fixture.league.name);
      
      const score = LeagueValueScoreEngine.evaluate({
        fixture: ingestedData.fixture,
        leagueStats: leagueProfile,
        marketContext: { saturation: 0.5, calendarPressure: 0.3 },
        timeToKickoffMinutes
      });

      const operationalDensity = score.operationalDensity;
      
      let executionMode: "FULL" | "REDUCED" | "SKIP" = "SKIP";
      
      // Argos v5.0 Syndicate-Level: Elite nunca é SKIP. No mínimo REDUCED.
      const eliteLeagues = [1, 2, 3, 4, 11, 13, 15, 61, 71, 72, 73, 78, 94, 140];
      const isElite = eliteLeagues.includes(Number(ingestedData.leagueId));

      if (operationalDensity >= 75 || isElite) executionMode = "FULL";
      else if (operationalDensity >= 55) executionMode = "REDUCED";

      if (executionMode === "SKIP" && !isElite) {
        // Argos v5.0 Syndicate-Level: Em vez de desistir do jogo, tentamos pelo menos os mercados de Gols (xG) que são mais resilientes.
        console.log(`[Argos v5.0] MATCH ENGINE: Densidade Baixa (${operationalDensity}). Forçando MODO REDUCED em vez de SKIP.`);
        executionMode = "REDUCED";
      }
      
      // Forçar modo FULL para Elite independente da densidade para varredura exaustiva
      if (isElite) executionMode = "FULL";

      // 5. MARKET ENGINES (Decisão de Nível de Mercado)
      // Argos v5.0: EXHAUSTIVE Multi-Market Scanning
      const mandatoryVerticals = [
        MarketVertical.WINNER, 
        MarketVertical.GOALS, 
        MarketVertical.GOALS_HT,
        MarketVertical.CORNERS, 
        MarketVertical.CARDS, 
        MarketVertical.BTTS, 
        MarketVertical.SHOTS, 
        MarketVertical.SHOTS_ON_TARGET,
        MarketVertical.HANDICAP
      ];

      const verticalsToProcess = MarketSelectorEngine.selectMarkets(
        mandatoryVerticals,
        executionMode,
        leagueProfile
      );

      if (verticalsToProcess.length === 0) {
        console.log(`[Argos v5.0] MARKET ENGINES: Nenhum mercado selecionado para jogo ${matchId} no modo ${executionMode}`);
        return {
          matchId,
          status: "SUCCESS",
          executionTimeMs: Date.now() - startTime,
          error: "NO_MARKETS_SELECTED"
        };
      }

      // 6. CONTRATO FORMAL DE DADOS: RawData -> FeatureVector (Camada Isolada)
      const features = FeatureEngine.generateFeatureVector(ingestedData);

      console.log(`[Argos v5.0] Iniciando Exaustão Inteligente [${executionMode}] para o jogo ${matchId}...`);

      const simulationPromises = verticalsToProcess.map(async (vertical) => {
        console.log(`[Argos v5.0] Analisando [${matchId}] | Mercado [${vertical}]...`);
        const payload: AuditPayload = {
          matchId,
          leagueId: ingestedData.leagueId,
          requestedVerticals: verticalsToProcess,
          externalFactors: features.externalFactors,
          baseMetrics: {
            home: {
              goals: features.homeMetrics.goals,
              corners: features.homeMetrics.corners,
              cards: features.homeMetrics.cards,
              shots: features.homeMetrics.shots,
            },
            away: {
              goals: features.awayMetrics.goals,
              corners: features.awayMetrics.corners,
              cards: features.awayMetrics.cards,
              shots: features.awayMetrics.shots,
            },
          },
        };
        const results = await this.processVertical(vertical, payload, regime, elapsed, currentScore);
        return results;
      });

      const simulationResults = await Promise.allSettled(simulationPromises);
      const rawSignals: ArgosSignal[] = [];

      simulationResults.forEach((result) => {
        if (result.status === "fulfilled") {
          rawSignals.push(...result.value);
        } else {
          console.error(`[Argos v5.0] Erro na simulação de vertical: ${result.reason}`);
          // TODO: Implementar telemetria avançada para erros de vertical
        }
      });

      // 7. OPPORTUNITY RANKING (Os mercados competem)
      let classifiedSignals = SignalClassifierV4.classify(rawSignals, regime);
      
      // Argos v5.0: Ranking Multimodal (Edge + Probabilidade + Confiança)
      classifiedSignals = classifiedSignals.sort((a, b) => {
        const scoreA = (a.expectedValue || 0) * 0.6 + a.probability * 0.4;
        const scoreB = (b.expectedValue || 0) * 0.6 + b.probability * 0.4;
        return scoreB - scoreA;
      });

      // Limitar a no máximo 5 melhores oportunidades por jogo para evitar ruído
      classifiedSignals = classifiedSignals.slice(0, 5);

      // 8. DETECÇÃO DE ANOMALIAS: Comparar com odds de mercado e emitir alertas
      if (marketOdds && classifiedSignals.length > 0) {
        const anomalyAlerts = this.anomalyDetector.detectAnomalies(classifiedSignals, marketOdds);
        anomalyAlerts.forEach((alert) => console.warn(alert));
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
          .select("id");

        if (persistedSignals) {
          classifiedSignals = classifiedSignals.map((signal, index) => ({
            ...signal,
            id: persistedSignals[index].id,
          }));
        }

        if (persistError) {
          console.error("[Argos v5.0] Erro na Persistência do Ledger:", {
            message: persistError.message,
            code: persistError.code,
            details: persistError.details,
            hint: persistError.hint,
          });
          throw new Error(`Supabase Persistence Error [${persistError.code}]: ${persistError.message} (${persistError.details || 'no details'})`);
        }

        // 7. DISTRIBUIÇÃO AUTOMATIZADA (Telegram Dispatcher)
        console.log(`[Argos v5.0] Sinais gerados e prontos para despacho: ${classifiedSignals.length}`);
        
        // Disparo FORÇADO e MONITORADO
        if (classifiedSignals.length > 0) {
          console.log("[Argos v5.0] Acionando TelegramDispatcher...");
          await this.telegramDispatcher.dispatch(classifiedSignals, regime).catch(err => {
            console.error("[Argos v5.0] Falha crítica no despacho Telegram:", err.message);
            console.error("[Argos v5.0] Detalhes do erro:", err);
          });
        } else {
          console.warn("[Argos v5.0] Nenhum sinal classificado para despacho no Telegram.");
        }
      }

      const executionTimeMs = Date.now() - startTime;
      console.log(`[Argos v5.0] Auditoria concluída em ${executionTimeMs}ms para ${matchId}`);

      return {
        matchId,
        status: "SUCCESS",
        classifiedSignals: classifiedSignals.map((s) => ({ ...s, id: s.id || '' })),
        regime,
        executionTimeMs,
      };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[Argos v5.0] Zero-Touch Error: ${errorMessage}`);
      // TODO: Implementar telemetria avançada para erros gerais
      return {
        status: "FAILED",
        matchId,
        error: errorMessage,
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Processa uma vertical específica de mercado
   */
  private async processVertical(
    vertical: MarketVertical,
    payload: AuditPayload,
    regime: RegimeProfile,
    elapsed: number = 0,
    currentScore: { home: number; away: number } = { home: 0, away: 0 }
  ): Promise<ArgosSignal[]> {
    const signals: ArgosSignal[] = [];

    switch (vertical) {
      case MarketVertical.WINNER:
        const winnerSim: SimulationResult = ModelFactory.runMonteCarlo(
          { homeMean: payload.baseMetrics.home.goals || 1.2, awayMean: payload.baseMetrics.away.goals || 1.0 },
          regime,
          10000, // Argos v5.0: 10.000 iterações para precisão industrial
          "GOALS",
          elapsed,
          currentScore
        );
        signals.push({
          matchId: payload.matchId,
          market: "HOME_WIN",
          vertical: MarketVertical.WINNER,
          probability: winnerSim.probabilities.home,
          expectedValue: winnerSim.probabilities.home * 2.0 - 1,
          status: "OPTIMIZED",
        });

        // CHAMELEON: Inversão para DRAW ou AWAY se o favorito acomodar
        if (winnerSim.probabilities.home < 0.3 && elapsed > 60) {
          signals.push({
            matchId: payload.matchId,
            market: "X2_DOUBLE_CHANCE",
            vertical: MarketVertical.WINNER,
            probability: winnerSim.probabilities.draw + winnerSim.probabilities.away,
            expectedValue: (winnerSim.probabilities.draw + winnerSim.probabilities.away) * 1.7 - 1,
            status: "HEDGED",
            reasoning: "Chameleon Logic: Favorito em baixa intensidade. Valor em Dupla Chance.",
          });
        }
        break;

      case MarketVertical.CORNERS:
        const cornerSim: SimulationResult = ModelFactory.modelCorners(
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
          expectedValue: probOverCorners * 1.8 - 1,
          status: "OPTIMIZED",
        });

        // UNIVERSAL ALPHA LOGIC: Busca bidirecional de valor extremo
        const probUnderCorners = 1 - probOverCorners;

        if (probUnderCorners > 0.65) {
          signals.push({
            matchId: payload.matchId,
            market: "UNDER_9_5_CORNERS",
            vertical: MarketVertical.CORNERS,
            probability: probUnderCorners,
            expectedValue: probUnderCorners * 1.9 - 1,
            status: "HEDGED",
            reasoning: "Universal Alpha: Detecção de inércia tática. Inversão estratégica para UNDER.",
          });
        } else if (probOverCorners > 0.65) {
          signals.push({
            matchId: payload.matchId,
            market: "OVER_9_5_CORNERS",
            vertical: MarketVertical.CORNERS,
            probability: probOverCorners,
            expectedValue: probOverCorners * 1.8 - 1,
            status: "OPTIMIZED",
            reasoning: "Shock Engine: Reativação de intensidade detectada. Valor em OVER.",
          });
        }
        break;

      case MarketVertical.CARDS:
        const cardSim: SimulationResult = ModelFactory.modelCards(
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
          expectedValue: (cardSim.probabilities.home + cardSim.probabilities.away) * 1.9 - 1,
          status: "OPTIMIZED",
        });
        break;

      case MarketVertical.BTTS:
        const bttsResult: { yes: number; no: number } = ModelFactory.modelBTTS(
          payload.baseMetrics.home.goals || 1.2,
          payload.baseMetrics.away.goals || 1.0,
          regime
        );

        signals.push({
          matchId: payload.matchId,
          market: "BTTS_YES",
          vertical: MarketVertical.BTTS,
          probability: bttsResult.yes,
          expectedValue: bttsResult.yes * 1.95 - 1,
          status: "OPTIMIZED",
        });
        break;

      case MarketVertical.SHOTS:
        const shotSim: SimulationResult = ModelFactory.runMonteCarlo(
          { homeMean: payload.baseMetrics.home.shots || 12, awayMean: payload.baseMetrics.away.shots || 10 },
          regime,
          10000, // 10.000 iterações
          "SHOTS",
          elapsed,
          { home: 0, away: 0 } // Shots não acumulam no placar para fins de simulação de Poisson residual
        );
        signals.push({
          matchId: payload.matchId,
          market: "OVER_22_5_SHOTS",
          vertical: MarketVertical.SHOTS,
          probability: shotSim.probabilities.home + shotSim.probabilities.away,
          expectedValue: (shotSim.probabilities.home + shotSim.probabilities.away) * 1.85 - 1,
          status: "OPTIMIZED",
        });
        break;

      case MarketVertical.HANDICAP:
        const handicapSim: SimulationResult = ModelFactory.runMonteCarlo(
          { homeMean: payload.baseMetrics.home.goals || 1.2, awayMean: payload.baseMetrics.away.goals || 1.0 },
          regime,
          10000, // 10.000 iterações
          "GOALS",
          elapsed,
          currentScore
        );
        signals.push({
          matchId: payload.matchId,
          market: "AH_-0.5_HOME",
          vertical: MarketVertical.HANDICAP,
          probability: handicapSim.probabilities.home,
          expectedValue: handicapSim.probabilities.home * 2.0 - 1,
          status: "OPTIMIZED",
        });
        break;

      default:
        console.warn(`[Argos v5.0] Vertical ${vertical} não suportada.`);
        break;
    }

    return signals;
  }
}
