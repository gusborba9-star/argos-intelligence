import { createClient } from "@supabase/supabase-js";
import { RegimeEngineV4, ExternalFactors } from "@/lib/argos/regime/RegimeEngineV4";
import { RAGContextEngine } from "@/lib/argos/regime/RAGContextEngine";
import { ModelFactory } from "@/lib/core/ModelFactory";
import { SignalClassifierV4, SignalType, ClassifiedSignal } from "@/lib/core/SignalClassifierV4";
import { ArgosSignal } from "@/lib/core/contracts/SignalContract";
import { MarketVertical } from "@/lib/core/ArgosUnifiedEngine";

// ============================================================
// ARGOS ORCHESTRATOR v4.2 — INDUSTRIAL AUDITOR
// Suporte massivo multi-vertical, paralelo e otimizado para Vercel
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
  }

  /**
   * Executa a auditoria completa de mercado para um jogo
   */
  async runAudit(payload: AuditPayload) {
    const startTime = Date.now();
    console.log(`[Argos v4.2] Iniciando auditoria para o jogo: ${payload.matchId}`);

    try {
      // 1. Extração de Contexto (RAG)
      const context = await this.ragEngine.retrieveContext(payload.matchId);

      // 2. Definição de Regime de Mercado
      const regime = await this.regimeEngine.analyze({
        matchId: payload.matchId,
        leagueId: payload.leagueId,
        contextEvidence: context,
        factors: payload.externalFactors
      });

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
    }

    return signals;
  }
}
