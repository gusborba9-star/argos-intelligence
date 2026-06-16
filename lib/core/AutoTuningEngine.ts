import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { MarketRegime } from "@/lib/argos/regime/RegimeSchema";

// ============================================================
// AUTO-TUNING ENGINE v5.0 — ANTI-FRAGILITY & AUTONOMOUS LEARNING
// Ajusta multiplicadores de variância e detecta regimes de observação
// ============================================================

export interface TuningResult {
  leagueId: string;
  regime: MarketRegime;
  suggestedVarianceMultiplier: number;
  confidenceAdjustment: number;
  isInObservationMode: boolean;
  observationReason?: string;
}

export class AutoTuningEngine {
  private supabase: SupabaseClient;

  constructor(supabaseClient?: SupabaseClient) {
    this.supabase = supabaseClient || createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  /**
   * Analisa o histórico de uma liga/regime e sugere ajustes de parâmetros, 
   * podendo colocar a liga em modo de observação.
   */
  async tuneRegimeParameters(leagueId: string, regime: MarketRegime): Promise<TuningResult> {
    // 1. Buscar últimos 50 sinais liquidados para este contexto
    const { data: history, error } = await this.supabase
      .from("argos_signal_ledger")
      .select("brier_score, is_correct, prediction_error")
      .eq("league_id", leagueId)
      .eq("regime", regime)
      .not("brier_score", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error(`[AutoTuningEngine] Erro ao buscar histórico para ${leagueId}/${regime}:`, error.message);
      return { leagueId, regime, suggestedVarianceMultiplier: 1.0, confidenceAdjustment: 0, isInObservationMode: false };
    }

    if (!history || history.length < 10) { // Mínimo de 10 amostras para análise robusta
      return { leagueId, regime, suggestedVarianceMultiplier: 1.0, confidenceAdjustment: 0, isInObservationMode: false, observationReason: "Dados insuficientes para auto-ajuste." };
    }

    // 2. Calcular Erro Médio (Brier Score Médio) e Acurácia
    const avgBrier = history.reduce((acc, curr) => acc + curr.brier_score, 0) / history.length;
    const accuracy = history.filter(h => h.is_correct).length / history.length;

    let suggestedVariance = 1.0;
    let confidenceAdj = 0;
    let isInObservationMode = false;
    let observationReason: string | undefined;

    // 3. Lógica de Ajuste e Anti-Fragilidade:
    // Se o Brier Score for alto (> 0.25) E a acurácia for baixa (< 0.7), 
    // o modelo está perdendo assertividade. Entrar em modo de observação.
    if (avgBrier > 0.25 && accuracy < 0.7) {
      suggestedVariance = 1.5; // Aumenta drasticamente a variância (conservadorismo extremo)
      confidenceAdj = -0.2; // Reduz a confiança
      isInObservationMode = true;
      observationReason = `Anti-Fragility: Baixa acurácia (${(accuracy * 100).toFixed(1)}%) e alto Brier Score (${avgBrier.toFixed(2)}) detectados. Liga em modo de observação.`;
    } 
    // Se o Brier Score for moderado (> 0.20) ou a acurácia for apenas razoável (< 0.8)
    else if (avgBrier > 0.20 || accuracy < 0.8) {
      suggestedVariance = 1.2; // Aumenta a variância para sermos mais conservadores
      confidenceAdj = -0.1; // Reduz a confiança
      observationReason = `Auto-Tuning: Ajuste conservador devido a Brier Score moderado (${avgBrier.toFixed(2)}) ou acurácia razoável (${(accuracy * 100).toFixed(1)}%).`;
    }
    // Se a acurácia for muito alta (> 0.85) e o Brier Score baixo (< 0.15), 
    // podemos reduzir a variância (modelo confiável).
    else if (accuracy > 0.85 && avgBrier < 0.15) {
      suggestedVariance = 0.85; // Reduz a variância (mais agressivo)
      confidenceAdj = 0.05; // Aumenta a confiança
      observationReason = `Auto-Tuning: Alta acurácia (${(accuracy * 100).toFixed(1)}%) e baixo Brier Score (${avgBrier.toFixed(2)}). Otimização agressiva.`;
    }

    return {
      leagueId,
      regime,
      suggestedVarianceMultiplier: suggestedVariance,
      confidenceAdjustment: confidenceAdj,
      isInObservationMode,
      observationReason,
    };
  }
}
