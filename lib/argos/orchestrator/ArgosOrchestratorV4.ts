import { getSupabaseClient } from "@/lib/core/SupabaseClient";
import { SupabaseClient } from "@supabase/supabase-js";
import { RegimeEngineV4, ExternalFactors } from "@/lib/argos/regime/RegimeEngineV4";
import { RAGContextEngine } from "@/lib/argos/regime/RAGContextEngine";
import { ModelFactory, SimulationResult } from "@/lib/core/ModelFactory";
import { SignalClassifierV4, ClassifiedSignal } from "@/lib/core/SignalClassifierV4";
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
// ARGOS ORCHESTRATOR v5.2.1 — SYNDICATE EDITION
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

  async runZeroTouchAudit(
    matchId: string,
    requestedVerticals: MarketVertical[],
    marketOdds?: { [key: string]: number },
    liveData?: { score: { home: number; away: number }; elapsed: number }
  ): Promise<AuditResult> {
    const startTime = Date.now();
    console.log(`[Argos v5.2.1] Iniciando Auditoria para matchId: ${matchId}`);

    try {
      let ingestedData: IngestedData;
      try {
        ingestedData = await this.ingestionService.ingest(matchId);
      } catch (ingestionError: any) {
        if (ingestionError.message.includes("not found")) {
          return { matchId, status: "SUCCESS", error: "NOT_FOUND", executionTimeMs: Date.now() - startTime };
        }
        throw ingestionError;
      }

      const currentScore = liveData?.score || { home: 0, away: 0 };
      const elapsed = liveData?.elapsed || 0;

      const { data: existingLedger } = await this.supabase
        .from("argos_signal_ledger")
        .select("regime, confidence")
        .eq("match_id", matchId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let regime: RegimeProfile;
      if (existingLedger) {
        regime = {
          regime: existingLedger.regime as MarketRegime,
          confidence: existingLedger.confidence as number,
          model_bias: 0,
          variance_multiplier: 1.0,
          reasoning_tags: ["CACHED_ANALYSIS"],
          explanation: "Análise recuperada do cache local.",
        };
      } else {
        const context = await this.ragEngine.retrieveContext(matchId);
        regime = await this.regimeEngine.analyze({
          matchId,
          leagueId: ingestedData.leagueId,
          contextEvidence: context,
          factors: ingestedData.externalFactors,
        });
      }

      const tuning: TuningResult = await this.autoTuner.tuneRegimeParameters(ingestedData.leagueId, regime.regime);
      regime.variance_multiplier *= tuning.suggestedVarianceMultiplier;
      regime.confidence += tuning.confidenceAdjustment;

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
      const eliteLeagues = [1, 2, 3, 4, 11, 13, 15, 61, 71, 72, 73, 78, 94, 140];
      const isElite = eliteLeagues.includes(Number(ingestedData.leagueId));

      if (operationalDensity >= 75 || isElite) executionMode = "FULL";
      else executionMode = "REDUCED"; 

      const mandatoryVerticals = [
        MarketVertical.WINNER, MarketVertical.GOALS, MarketVertical.GOALS_HT,
        MarketVertical.CORNERS, MarketVertical.CARDS, MarketVertical.BTTS, 
        MarketVertical.SHOTS, MarketVertical.SHOTS_ON_TARGET, MarketVertical.HANDICAP
      ];

      const verticalsToProcess = MarketSelectorEngine.selectMarkets(mandatoryVerticals, executionMode, leagueProfile);
      if (verticalsToProcess.length === 0) {
        return { matchId, status: "SUCCESS", executionTimeMs: Date.now() - startTime, error: "NO_MARKETS_SELECTED" };
      }

      const features = FeatureEngine.generateFeatureVector(ingestedData);
      const simulationPromises = verticalsToProcess.map(async (vertical) => {
        const payload: AuditPayload = {
          matchId,
          leagueId: ingestedData.leagueId,
          requestedVerticals: verticalsToProcess,
          externalFactors: features.externalFactors,
          baseMetrics: {
            home: { goals: features.homeMetrics.goals, corners: features.homeMetrics.corners, cards: features.homeMetrics.cards, shots: features.homeMetrics.shots },
            away: { goals: features.awayMetrics.goals, corners: features.awayMetrics.corners, cards: features.awayMetrics.cards, shots: features.awayMetrics.shots },
          },
        };
        return await this.processVertical(vertical, payload, regime, elapsed, currentScore);
      });

      const simulationResults = await Promise.allSettled(simulationPromises);
      const rawSignals: ArgosSignal[] = [];
      simulationResults.forEach((result) => {
        if (result.status === "fulfilled") rawSignals.push(...result.value);
      });

      const classifiedSignals: ClassifiedSignal[] = SignalClassifierV4.classify(rawSignals, regime);
      const sortedSignals = classifiedSignals.sort((a, b) => {
        const scoreA = (a.expectedValue || 0) * 0.6 + a.probability * 0.4;
        const scoreB = (b.expectedValue || 0) * 0.6 + b.probability * 0.4;
        return scoreB - scoreA;
      }).slice(0, 5);

      if (sortedSignals.length > 0) {
        const ledgerEntries = SignalClassifierV4.prepareLedger(matchId, ingestedData.leagueId, sortedSignals, regime);
        const { data: persistedSignals, error: persistError } = await this.supabase
          .from("argos_signal_ledger")
          .insert(ledgerEntries)
          .select("id");

        if (persistError) throw new Error(`Supabase Error: ${persistError.message}`);

        const signalsToDispatch = sortedSignals.map((signal, index) => ({
          ...signal,
          id: persistedSignals[index].id,
        })) as ArgosSignal[];

        await this.telegramDispatcher.dispatch(signalsToDispatch, regime).catch(err => {
          console.error("[Argos v5.2.1] Falha no despacho:", err.message);
        });

        console.log(`[Argos-Processamento] Evento ${matchId} concluído com sucesso. Sinais gerados: ${signalsToDispatch.length}`);
        
        return {
          matchId,
          status: "SUCCESS",
          classifiedSignals: signalsToDispatch,
          regime,
          executionTimeMs: Date.now() - startTime,
        };
      }

      console.log(`[Argos-Processamento] Evento ${matchId} concluído. Nenhum sinal de valor encontrado.`);
      return { matchId, status: "SUCCESS", executionTimeMs: Date.now() - startTime };
    } catch (error: any) {
      console.error(`[Argos v5.2.1] Zero-Touch Error: ${error.message}`);
      return { status: "FAILED", matchId, error: error.message, executionTimeMs: Date.now() - startTime };
    }
  }

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
        const winnerSim = ModelFactory.runMonteCarlo(
          { homeMean: payload.baseMetrics.home.goals || 1.2, awayMean: payload.baseMetrics.away.goals || 1.0 },
          regime, 10000, "GOALS", elapsed, currentScore
        );
        signals.push({
          matchId: payload.matchId,
          market: "HOME_WIN",
          vertical: MarketVertical.WINNER,
          probability: winnerSim.probabilities.home,
          expectedValue: winnerSim.probabilities.home * 2.0 - 1,
          status: "OPTIMIZED"
        });
        break;
    }
    return signals;
  }
}
