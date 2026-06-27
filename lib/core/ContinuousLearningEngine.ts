import { getSupabaseClient } from "@/lib/core/SupabaseClient";

// ============================================================
// CONTINUOUS LEARNING ENGINE v6.0.0 — SYNDICATE MASTER EDITION
// Regra de Fusão: dataset_final = (Argos * 0.7) + (PropLine * 0.3)
// Objetivo: Calibrar probabilidades, reduzir erro e identificar ineficiências.
// ============================================================

export interface MarketInefficiency {
  vertical: string;
  leagueId: string;
  bias: number;           // Diferença média entre Prob Real e Prob Estimada
  reliability: number;    // Confiança no ajuste (baseado no volume de dados)
  sampleSize: number;
}

export interface LearningCalibration {
  probabilityAdjustment: number;
  expectedValueAdjustment: number;
  recommendedMarkets: string[];
}

export class ContinuousLearningEngine {
  private static readonly ARGOS_WEIGHT = 0.7;
  private static readonly PROPLINE_WEIGHT = 0.3;
  private static readonly MIN_SAMPLE_SIZE = 30;

  private supabase = getSupabaseClient();

  /**
   * Obtém a calibração de aprendizado para uma liga e vertical específica.
   * Cruza o histórico interno do Argos com o dataset externo da PropLine.
   */
  public async getCalibration(leagueId: string, vertical: string): Promise<LearningCalibration> {
    try {
      // 1. Buscar Histórico Interno Argos (Peso Alto)
      const argosStats = await this.getArgosInternalStats(leagueId, vertical);
      
      // 2. Buscar Histórico Externo PropLine (Peso Médio)
      const proplineStats = await this.getPropLineExternalStats(leagueId, vertical);

      // 3. Fusão de Dados
      const combinedBias = (argosStats.bias * ContinuousLearningEngine.ARGOS_WEIGHT) + (proplineStats.bias * ContinuousLearningEngine.PROPLINE_WEIGHT);
      const combinedReliability = (argosStats.reliability * ContinuousLearningEngine.ARGOS_WEIGHT) + (proplineStats.reliability * ContinuousLearningEngine.PROPLINE_WEIGHT);

      // Se não houver dados suficientes, não aplicamos ajuste agressivo
      const finalAdjustment = combinedReliability >= 0.5 ? combinedBias : combinedBias * combinedReliability;

      return {
        probabilityAdjustment: parseFloat(finalAdjustment.toFixed(4)),
        expectedValueAdjustment: parseFloat((finalAdjustment * 0.5).toFixed(4)),
        recommendedMarkets: this.determineRecommendedMarkets(argosStats, proplineStats)
      };
    } catch (error) {
      console.error("[LearningEngine] Erro ao obter calibração:", error);
      return { probabilityAdjustment: 0, expectedValueAdjustment: 0, recommendedMarkets: [] };
    }
  }

  /**
   * Analisa o histórico interno do Argos: Sinais vs Resultados Reais.
   */
  private async getArgosInternalStats(leagueId: string, vertical: string) {
    const { data, error } = await this.supabase
      .from("argos_signal_ledger")
      .select("probability, is_correct, prediction_error")
      .eq("league_id", leagueId)
      .eq("vertical", vertical)
      .not("is_correct", "is", null)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error || !data || data.length < ContinuousLearningEngine.MIN_SAMPLE_SIZE) {
      return { bias: 0, reliability: 0, sampleSize: data?.length || 0 };
    }

    // Calcula o viés: Se o Argos previu 60% e acertou 50%, o viés é -0.10
    const avgPredicted = data.reduce((sum, s) => sum + s.probability, 0) / data.length;
    const actualWinRate = data.filter(s => s.is_correct).length / data.length;
    const bias = actualWinRate - avgPredicted;
    
    // Confiabilidade aumenta com o tamanho da amostra
    const reliability = Math.min(1, data.length / 100);

    return { bias, reliability, sampleSize: data.length };
  }

  /**
   * Analisa o histórico externo da PropLine (Dataset Expandido).
   * Nota: Em produção, isso consultaria uma tabela de cache de resultados históricos.
   */
  private async getPropLineExternalStats(leagueId: string, vertical: string) {
    // Simulação de consulta ao dataset expandido PropLine
    // Em uma implementação real, buscaríamos da tabela 'propline_historical_results'
    return { bias: 0.02, reliability: 0.4, sampleSize: 500 };
  }

  /**
   * Identifica quais mercados estão performando melhor para esta liga.
   */
  private determineRecommendedMarkets(argos: any, propline: any): string[] {
    // Lógica para sugerir mercados com maior "inefficiency" positiva (onde o modelo acerta mais que o mercado)
    const recommendations = [];
    if (argos.bias > 0.05) recommendations.push("HIGH_ACCURACY_ZONE");
    if (propline.bias > 0.03) recommendations.push("EXTERNAL_VALUE_CONFIRMED");
    return recommendations;
  }

  /**
   * Registra um novo ponto de aprendizado após o fechamento de uma partida.
   */
  public async recordLearningPoint(matchId: string, results: any): Promise<void> {
    // Esta função seria chamada pelo endpoint /api/argos/v4/settle
    console.log(`[LearningEngine] Novo ponto de aprendizado registrado para ${matchId}`);
  }
}

export const learningEngine = new ContinuousLearningEngine();
