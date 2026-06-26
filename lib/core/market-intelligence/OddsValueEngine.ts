export interface ValueAnalysis {
  expectedValue: number;
  edge: number;
  isPositive: boolean;
  kellyCriterion: number;
}

export class OddsValueEngine {
  private static readonly FRACTIONAL_KELLY = 0.25; // 1/4 Kelly para segurança (Syndicate Standard)
  private static readonly MAX_EXPOSURE = 0.05;    // Máximo 5% da banca por sinal

  /**
   * Calcula o valor esperado (EV) real baseado na probabilidade do modelo e odd do mercado.
   * Implementa Fractional Kelly para gestão de banca profissional.
   */
  public static calculateValue(modelProbability: number, marketOdd: number): ValueAnalysis {
    const ev = (modelProbability * marketOdd) - 1;
    const edge = ev;
    
    // Cálculo de Kelly Criterion (Fração sugerida da banca)
    // f* = (p * b - q) / b  => onde b = (odd - 1), p = prob, q = (1 - p)
    const b = marketOdd - 1;
    const q = 1 - modelProbability;
    const fullKelly = b > 0 ? (modelProbability * b - q) / b : 0;

    // Aplicação de Fractional Kelly e Max Exposure
    const fractionalKelly = fullKelly * this.FRACTIONAL_KELLY;
    const finalKelly = Math.max(0, Math.min(this.MAX_EXPOSURE, fractionalKelly));

    return {
      expectedValue: parseFloat(ev.toFixed(4)),
      edge: parseFloat(edge.toFixed(4)),
      isPositive: ev > 0,
      kellyCriterion: parseFloat(finalKelly.toFixed(4))
    };
  }
}
