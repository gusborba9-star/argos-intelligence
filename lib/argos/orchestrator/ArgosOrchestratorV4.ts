import { createClient } from "@supabase/supabase-js";
import { MatchContextInput, MarketVertical } from "@/lib/core/ArgosUnifiedEngine";
import { ArgosSignal } from "@/lib/core/contracts/SignalContract";
import { SignalClassifierV4, SignalType } from "@/lib/core/SignalClassifierV4";
import { RegimeProfile } from "@/lib/argos/regime/RegimeSchema";

// ============================================================
// ARGOS v4.0 — INTEGRATED ORCHESTRATOR
// ============================================================

export class ArgosOrchestratorV4 {
  private apiUrl: string;

  constructor(apiUrl: string) {
    this.apiUrl = apiUrl;
  }

  private async callApi<T>(action: string, payload: any): Promise<T> {
    const response = await fetch(this.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, payload }),
    });

    if (!response.ok) {
      throw new Error(`Argos API Action ${action} failed`);
    }
    return response.json();
  }

  async runAudit(input: MatchContextInput) {
    const startedAt = Date.now();

    try {
      // 1. Context & Regime via API
      const { context_evidence } = await this.callApi<{ context_evidence: string }>("retrieve_context", { 
        matchId: input.matchId, 
        leagueId: input.leagueId 
      });
      
      const regime = await this.callApi<RegimeProfile>("classify_regime", { 
        matchId: input.matchId, 
        leagueId: input.leagueId, 
        contextEvidence: JSON.parse(context_evidence) 
      });

      // 2. Monte Carlo (Simulado localmente para performance ou via API)
      const mcResult = await this.callApi<any>("run_monte_carlo", {
        baseOutput: {
          homeExpectedGoals: input.winnerMatrix?.home?.attack || 1.2,
          awayExpectedGoals: input.winnerMatrix?.away?.attack || 1.0
        },
        iterations: 1500,
        varianceMultiplier: regime.variance_multiplier
      });

      // 3. Signals & Classification
      const rawSignals = this.generateSignals(mcResult, input);
      const classifiedSignals = SignalClassifierV4.classify(rawSignals, regime);

      // 4. Persistence
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
      const ledger = SignalClassifierV4.prepareLedger(input.matchId, input.leagueId, classifiedSignals, regime);
      
      if (ledger.length > 0) {
        await supabase.from("argos_signal_ledger").insert(ledger);
      }

      return {
        match_id: input.matchId,
        regime,
        signals: classifiedSignals,
        execution_time_ms: Date.now() - startedAt
      };
    } catch (error) {
      console.error("Orchestrator Error:", error);
      throw error;
    }
  }

  private generateSignals(mcResult: any, input: MatchContextInput): ArgosSignal[] {
    // Mapeamento simplificado para sinais
    return [
      {
        vertical: MarketVertical.WINNER,
        market: "HOME_WIN",
        probability: mcResult.probabilities.home,
        adjustedProbability: mcResult.probabilities.home,
        impliedOdds: input.winnerMatrix?.home?.impliedOdds || 2.0,
        expectedValue: (mcResult.probabilities.home * (input.winnerMatrix?.home?.impliedOdds || 2.0)) - 1,
        units: 0.1,
        model: "MONTE_CARLO_V4",
        modelConsensusSize: 1500,
        unitSize: 0,
        status: "OPTIMIZED"
      }
    ];
  }
}
