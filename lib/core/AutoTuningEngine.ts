import { createClient } from "@supabase/supabase-js";

// ============================================================
// AUTO-TUNING ENGINE v4.3 — AUTONOMOUS LEARNING
// Ajusta multiplicadores de variância com base no erro histórico
// ============================================================

export interface TuningResult {
  leagueId: string;
  regime: string;
  suggestedVarianceMultiplier: number;
  confidenceAdjustment: number;
}

export class AutoTuningEngine {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Analisa o histórico de uma liga/regime e sugere ajustes de parâmetros
   */
  async tuneRegimeParameters(leagueId: string, regime: string): Promise<TuningResult> {
    // 1. Buscar últimos 50 sinais liquidados para este contexto
    const { data: history, error } = await this.supabase
      .from("argos_signal_ledger")
      .select("brier_score, is_correct, prediction_error")
      .eq("league_id", leagueId)
      .eq("regime", regime)
      .not("brier_score", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error || !history || history.length < 5) {
      return { leagueId, regime, suggestedVarianceMultiplier: 1.0, confidenceAdjustment: 0 };
    }

    // 2. Calcular Erro Médio (Brier Score Médio)
    const avgBrier = history.reduce((acc, curr) => acc + curr.brier_score, 0) / history.length;
    const accuracy = history.filter(h => h.is_correct).length / history.length;

    let suggestedVariance = 1.0;
    let confidenceAdj = 0;

    // 3. Lógica de Ajuste:
    // Se o Brier Score for alto (> 0.25), o modelo está errando muito as probabilidades.
    // Aumentamos a variância para sermos mais conservadores.
    if (avgBrier > 0.25) {
      suggestedVariance = 1.2;
      confidenceAdj = -0.1;
    } 
    // Se a acurácia for muito alta (> 80%), podemos reduzir a variância (modelo confiável).
    else if (accuracy > 0.8) {
      suggestedVariance = 0.85;
      confidenceAdj = 0.05;
    }

    return {
      leagueId,
      regime,
      suggestedVarianceMultiplier: suggestedVariance,
      confidenceAdjustment: confidenceAdj
    };
  }
}
