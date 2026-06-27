// ============================================================
// ODDS VALUE ENGINE v6.0.0 — SYNDICATE MASTER EDITION
// Regra: NUNCA enviar sinal sem essa camada.
// O sistema avalia: odd, linha, probabilidade estimada, EV e confiança.
// Nunca usa somente o valor absoluto da odd como filtro (ex: 1.50 pode ter valor).
// ============================================================

export interface ValueAnalysis {
  expectedValue: number;   // EV% = (prob * odd) - 1
  edge: number;            // Edge = EV (alias semântico para clareza)
  edgePercent: number;     // Edge em percentual (ex: 8.5 = 8.5%)
  isPositive: boolean;     // true se EV > 0
  kellyCriterion: number;  // Fração sugerida da banca (Fractional Kelly)
  fullKelly: number;       // Kelly completo (para referência)
  realValue: number;       // Valor real = fairOdd / marketOdd (> 1 = value bet)
  ratingLabel: "ELITE" | "VALUE" | "MARGINAL" | "NEGATIVE";
}

export class OddsValueEngine {
  // Syndicate Standard: 1/4 Kelly para segurança operacional
  private static readonly FRACTIONAL_KELLY = 0.25;
  // Máximo 5% da banca por sinal (gestão de risco profissional)
  private static readonly MAX_EXPOSURE = 0.05;
  // Mínimo de EV para considerar sinal válido (0.5%)
  // Reduzido para capturar mais oportunidades de valor real, mesmo em odds baixas
  private static readonly MIN_EV_THRESHOLD = 0.005;

  /**
   * Calcula o valor esperado real baseado na probabilidade do modelo e odd do mercado.
   * Implementa Fractional Kelly para gestão de banca profissional.
   *
   * @param modelProbability - Probabilidade calculada pelo modelo (0 a 1)
   * @param marketOdd        - Odd decimal oferecida pelo bookmaker
   * @param fairOdd          - Odd justa calculada pelo FairOddsCalculator (opcional)
   */
  public static calculateValue(
    modelProbability: number,
    marketOdd: number,
    fairOdd?: number
  ): ValueAnalysis {
    // Proteção contra valores inválidos
    const prob = Math.max(0.001, Math.min(0.999, modelProbability));
    const odd = Math.max(1.01, marketOdd);

    // EV = (prob * odd) - 1
    const ev = prob * odd - 1;
    const edgePercent = parseFloat((ev * 100).toFixed(2));

    // Kelly Criterion: f* = (p * b - q) / b
    // onde b = odd - 1 (lucro por unidade), q = 1 - p
    const b = odd - 1;
    const q = 1 - prob;
    const fullKelly = b > 0 ? (prob * b - q) / b : 0;

    // Fractional Kelly (1/4) com limite máximo de exposição
    const fractionalKelly = fullKelly * this.FRACTIONAL_KELLY;
    const finalKelly = Math.max(0, Math.min(this.MAX_EXPOSURE, fractionalKelly));

    // Valor Real: razão entre fair odd e market odd
    // > 1 = value bet (mercado subestima a probabilidade real)
    const realValue = fairOdd ? parseFloat((fairOdd / odd).toFixed(4)) : parseFloat((1 / (prob * odd)).toFixed(4));

    // Rating qualitativo do sinal
    const ratingLabel = this.getRatingLabel(ev, prob, odd);

    return {
      expectedValue: parseFloat(ev.toFixed(4)),
      edge: parseFloat(ev.toFixed(4)),
      edgePercent,
      isPositive: ev > this.MIN_EV_THRESHOLD,
      kellyCriterion: parseFloat(finalKelly.toFixed(4)),
      fullKelly: parseFloat(Math.max(0, fullKelly).toFixed(4)),
      realValue,
      ratingLabel,
    };
  }

  /**
   * Classifica a qualidade do sinal com base no EV, probabilidade e odd.
   * Removido filtro agressivo de odds baixas.
   */
  private static getRatingLabel(ev: number, prob: number, odd: number): ValueAnalysis["ratingLabel"] {
    // ELITE: Alto EV e alta probabilidade (independente da odd)
    if (ev >= 0.10 && prob >= 0.55) return "ELITE";
    
    // VALUE: EV consistente (ex: odd 1.50 com prob 75% = EV 0.125 -> ELITE)
    if (ev >= 0.05) return "VALUE";
    
    if (ev > 0) return "MARGINAL";
    return "NEGATIVE";
  }

  /**
   * Verifica se um sinal atende ao threshold mínimo para ser despachado.
   * Regra: NUNCA enviar sinal sem EV calculado e positivo.
   */
  public static isValidSignal(analysis: ValueAnalysis): boolean {
    return analysis.isPositive && analysis.expectedValue > this.MIN_EV_THRESHOLD;
  }
}
