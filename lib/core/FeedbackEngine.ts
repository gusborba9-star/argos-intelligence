// ============================================================
// FEEDBACK ENGINE v4.0
// O Cérebro do Argos: Calcula o erro e a precisão das previsões
// ============================================================

export interface SettlementInput {
  matchId: string;
  actualHomeGoals: number;
  actualAwayGoals: number;
  predictedProbabilities: {
    home: number;
    draw: number;
    away: number;
  };
}

export interface FeedbackMetrics {
  brierScore: number;
  isCorrect: boolean;
  predictionError: number;
  logLoss: number;
}

export class FeedbackEngine {
  /**
   * Calcula o Brier Score (quanto menor, mais preciso)
   * Referência: Medida de precisão para previsões probabilísticas
   */
  static calculateBrierScore(input: SettlementInput): number {
    const { actualHomeGoals, actualAwayGoals, predictedProbabilities } = input;
    
    // One-hot encoding do resultado real
    const actual = {
      home: actualHomeGoals > actualAwayGoals ? 1 : 0,
      draw: actualHomeGoals === actualAwayGoals ? 1 : 0,
      away: actualAwayGoals > actualHomeGoals ? 1 : 0
    };

    const homeError = Math.pow(predictedProbabilities.home - actual.home, 2);
    const drawError = Math.pow(predictedProbabilities.draw - actual.draw, 2);
    const awayError = Math.pow(predictedProbabilities.away - actual.away, 2);

    return (homeError + drawError + awayError) / 3;
  }

  /**
   * Analisa a qualidade da previsão e gera métricas de feedback
   */
  static analyze(input: SettlementInput): FeedbackMetrics {
    const brierScore = this.calculateBrierScore(input);
    
    const actualResult = input.actualHomeGoals > input.actualAwayGoals ? 'home' : 
                         input.actualHomeGoals === input.actualAwayGoals ? 'draw' : 'away';
    
    const predictedResult = input.predictedProbabilities.home > input.predictedProbabilities.draw && 
                            input.predictedProbabilities.home > input.predictedProbabilities.away ? 'home' :
                            input.predictedProbabilities.draw > input.predictedProbabilities.away ? 'draw' : 'away';

    const isCorrect = actualResult === predictedResult;
    
    // Log Loss para penalizar previsões erradas com alta confiança
    const actualProb = actualResult === 'home' ? input.predictedProbabilities.home :
                       actualResult === 'draw' ? input.predictedProbabilities.draw : input.predictedProbabilities.away;
    
    const logLoss = -Math.log(Math.max(actualProb, 0.001));

    return {
      brierScore,
      isCorrect,
      predictionError: 1 - actualProb,
      logLoss
    };
  }
}
