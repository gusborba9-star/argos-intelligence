import { getSupabaseClient } from "./SupabaseClient";
import { SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// ARGOS CONTINUOUS LEARNING LOOP v1.0
// Função: Auto-retraining online sem downtime via feedback loop
// ============================================================

export interface LearningFeedback {
  matchId: string;
  leagueId: string;
  vertical: string;
  market: string;
  predictedProb: number;
  actualResult: "WIN" | "LOSS" | "VOID";
  evExpected: number;
  evRealized: number;
}

export class ContinuousLearningLoop {
  private supabase: SupabaseClient;

  constructor() {
    this.supabase = getSupabaseClient();
  }

  /**
   * Registra feedback de resultados reais para aprendizado contínuo.
   */
  async recordFeedback(feedback: LearningFeedback) {
    const { error } = await this.supabase
      .from("argos_learning_ledger")
      .insert({
        match_id: feedback.matchId,
        league_id: feedback.leagueId,
        vertical: feedback.vertical,
        market: feedback.market,
        predicted_prob: feedback.predictedProb,
        actual_result: feedback.actualResult,
        ev_expected: feedback.evExpected,
        ev_realized: feedback.evRealized,
        created_at: new Date().toISOString()
      });

    if (error) {
      console.error("[LearningLoop] Erro ao registrar feedback:", error.message);
    }
  }

  /**
   * Recupera ajustes sugeridos com base no histórico recente.
   * Atua como input para o CalibrationEngine e FeatureEngine.
   */
  async getSuggestedAdjustments(leagueId: string, vertical: string) {
    // Busca os últimos 100 resultados da liga/vertical
    const { data, error } = await this.supabase
      .from("argos_learning_ledger")
      .select("*")
      .eq("league_id", leagueId)
      .eq("vertical", vertical)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error || !data || data.length < 10) {
      return { weightAdjustment: 1.0, bias: 0.0 };
    }

    // Cálculo simplificado de drift: acurácia real vs esperada
    const wins = data.filter(d => d.actual_result === "WIN").length;
    const actualAccuracy = wins / data.length;
    const avgPredictedProb = data.reduce((sum, d) => sum + d.predicted_prob, 0) / data.length;

    const drift = actualAccuracy - avgPredictedProb;

    return {
      weightAdjustment: 1.0 + (drift * 0.1), // Ajuste suave de 10% do drift
      bias: drift,
      sampleSize: data.length
    };
  }
}

export const learningLoop = new ContinuousLearningLoop();
