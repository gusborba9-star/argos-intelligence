export interface ValueAnalysis {
  expectedValue: number;
  edge: number;
  isPositive: boolean;
  kellyCriterion: number;
}

export class OddsValueEngine {
  /**
   * Calcula o valor esperado (EV) real baseado na probabilidade do modelo e odd do mercado.
   * Fórmula: EV = (Probabilidade * Odd) - 1
   */
  public static calculateValue(modelProbability: number, marketOdd: number): ValueAnalysis {
    const ev = (modelProbability * marketOdd) - 1;
    const edge = ev;
    
    // Cálculo de Kelly Criterion (Fração sugerida da banca)
    // f* = (p * b - q) / b  => onde b = (odd - 1), p = prob, q = (1 - p)
    const b = marketOdd - 1;
    const q = 1 - modelProbability;
    const kelly = b > 0 ? (modelProbability * b - q) / b : 0;

    return {
      expectedValue: parseFloat(ev.toFixed(4)),
      edge: parseFloat(edge.toFixed(4)),
      isPositive: ev > 0,
      kellyCriterion: parseFloat(Math.max(0, kelly).toFixed(4))
    };
  }
}
