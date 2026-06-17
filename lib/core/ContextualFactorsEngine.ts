// ============================================================
// CONTEXTUAL FACTORS ENGINE v5.0 — TOTAL VARIABLES MOTOR
// Integração de fatores contextuais reais com estatística
// ============================================================

export interface ContextualFactors {
  // Fatores de Motivação
  motivationFactor: number; // 0.7 - 1.3 (baixa a alta motivação)
  isLifeOrDeathMatch: boolean; // Jogo de vida ou morte (eliminação, título)
  
  // Fatores de Lesões e Escalação
  keyInjuriesCount: number; // Número de lesões cruciais
  injuryImpactFactor: number; // 0.6 - 1.0 (redução de força)
  startingLineupStrength: number; // 0.7 - 1.2 (força da escalação)
  
  // Fatores de Confronto Histórico
  headToHeadWinRate: number; // Taxa de vitória no confronto direto
  homeAdvantageMultiplier: number; // 1.0 - 1.3 (fator casa)
  
  // Fatores Ambientais
  weatherCondition: "clear" | "rainy" | "snowy" | "windy" | "extreme"; // Condição climática
  weatherImpactFactor: number; // 0.8 - 1.2 (impacto do clima)
  humidity: number; // 0 - 100 (umidade relativa)
  
  // Fatores de Forma Atual
  recentFormFactor: number; // 0.7 - 1.3 (forma recente)
  consecutiveWins: number; // Vitórias consecutivas
  consecutiveLosses: number; // Derrotas consecutivas
  
  // Fatores de Pressão Psicológica
  pressureFactor: number; // 0.8 - 1.2 (pressão psicológica)
  crowdEffect: number; // 0.9 - 1.1 (efeito da torcida)
}

export class ContextualFactorsEngine {
  /**
   * Calcula o fator de motivação baseado no contexto do jogo
   */
  static calculateMotivationFactor(
    isLifeOrDeath: boolean,
    currentPosition: number,
    targetPosition: number,
    pointsRemaining: number
  ): number {
    let motivationFactor = 1.0;

    // Jogo de vida ou morte (eliminação, playoff)
    if (isLifeOrDeath) {
      motivationFactor *= 1.25;
    }

    // Luta por título ou fuga do rebaixamento
    if (Math.abs(currentPosition - targetPosition) <= 3) {
      motivationFactor *= 1.15;
    }

    // Últimas rodadas da temporada
    if (pointsRemaining <= 9) {
      motivationFactor *= 1.1;
    }

    return Math.min(1.3, Math.max(0.7, motivationFactor));
  }

  /**
   * Calcula o impacto de lesões cruciais
   */
  static calculateInjuryImpact(
    keyInjuriesCount: number,
    totalSquadSize: number = 23
  ): { injuryImpactFactor: number; startingLineupStrength: number } {
    // Cada lesão crucial reduz a força em 5-8%
    const injuryImpactFactor = Math.max(0.6, 1.0 - keyInjuriesCount * 0.07);

    // Força da escalação é reduzida proporcionalmente
    const startingLineupStrength = 0.85 + injuryImpactFactor * 0.35;

    return { injuryImpactFactor, startingLineupStrength };
  }

  /**
   * Calcula o fator de vantagem do confronto direto
   */
  static calculateHeadToHeadFactor(
    homeWins: number,
    draws: number,
    awayWins: number
  ): { headToHeadWinRate: number; homeAdvantageMultiplier: number } {
    const totalMatches = homeWins + draws + awayWins;
    if (totalMatches === 0) {
      return { headToHeadWinRate: 0.5, homeAdvantageMultiplier: 1.0 };
    }

    const headToHeadWinRate = homeWins / totalMatches;
    
    // Vantagem de casa é mais pronunciada em confrontos históricos
    let homeAdvantageMultiplier = 1.0;
    if (headToHeadWinRate > 0.6) {
      homeAdvantageMultiplier = 1.2; // Forte domínio em casa
    } else if (headToHeadWinRate > 0.5) {
      homeAdvantageMultiplier = 1.1; // Leve vantagem
    } else if (headToHeadWinRate < 0.3) {
      homeAdvantageMultiplier = 0.9; // Desvantagem histórica
    }

    return { headToHeadWinRate, homeAdvantageMultiplier };
  }

  /**
   * Calcula o impacto do clima
   */
  static calculateWeatherImpact(
    weatherCondition: ContextualFactors["weatherCondition"],
    humidity: number
  ): { weatherImpactFactor: number; description: string } {
    let weatherImpactFactor = 1.0;
    let description = "Condições normais";

    switch (weatherCondition) {
      case "clear":
        weatherImpactFactor = 1.0;
        description = "Céu limpo - Condições ideais";
        break;
      case "rainy":
        weatherImpactFactor = 0.95; // Chuva reduz o jogo aéreo
        description = "Chuva - Redução de jogo aéreo e escanteios";
        break;
      case "snowy":
        weatherImpactFactor = 0.85; // Neve reduz drasticamente a qualidade
        description = "Neve - Qualidade de jogo significativamente reduzida";
        break;
      case "windy":
        weatherImpactFactor = 0.92; // Vento afeta passes longos
        description = "Vento - Afeta passes longos e finalizações";
        break;
      case "extreme":
        weatherImpactFactor = 0.75; // Condições extremas
        description = "Condições extremas - Jogo muito afetado";
        break;
    }

    // Umidade extrema afeta a performance
    if (humidity > 85) {
      weatherImpactFactor *= 0.95;
      description += " (Umidade extrema)";
    } else if (humidity < 30) {
      weatherImpactFactor *= 0.98;
      description += " (Umidade muito baixa)";
    }

    return { weatherImpactFactor: Math.min(1.2, Math.max(0.8, weatherImpactFactor)), description };
  }

  /**
   * Calcula o fator de forma recente
   */
  static calculateRecentFormFactor(
    consecutiveWins: number,
    consecutiveLosses: number,
    goalsFor: number,
    goalsAgainst: number,
    lastFiveMatches: number[] // Array de resultados (1=vitória, 0=empate, -1=derrota)
  ): number {
    let formFactor = 1.0;

    // Vitórias consecutivas aumentam confiança
    if (consecutiveWins > 0) {
      formFactor += consecutiveWins * 0.08;
    }

    // Derrotas consecutivas reduzem confiança
    if (consecutiveLosses > 0) {
      formFactor -= consecutiveLosses * 0.1;
    }

    // Diferença de gols (saldo ofensivo)
    const goalDifference = goalsFor - goalsAgainst;
    if (goalDifference > 10) {
      formFactor *= 1.15;
    } else if (goalDifference < -10) {
      formFactor *= 0.85;
    }

    // Média dos últimos 5 jogos
    if (lastFiveMatches.length > 0) {
      const avgLastFive = lastFiveMatches.reduce((a, b) => a + b, 0) / lastFiveMatches.length;
      formFactor *= (1.0 + avgLastFive * 0.1);
    }

    return Math.min(1.3, Math.max(0.7, formFactor));
  }

  /**
   * Calcula o fator de pressão psicológica
   */
  static calculatePressureFactor(
    isHomeTeam: boolean,
    crowdSize: number,
    isPlayoff: boolean,
    pointsGap: number // Diferença de pontos para o líder
  ): { pressureFactor: number; crowdEffect: number } {
    let pressureFactor = 1.0;
    let crowdEffect = 1.0;

    // Efeito da torcida em casa
    if (isHomeTeam) {
      crowdEffect = 1.05 + (crowdSize / 100000) * 0.05; // Até 1.1 com estádio cheio
      pressureFactor *= crowdEffect;
    } else {
      crowdEffect = 0.95; // Pressão adversária
      pressureFactor *= crowdEffect;
    }

    // Pressão de playoff
    if (isPlayoff) {
      pressureFactor *= 1.15;
    }

    // Pressão por luta pelo título ou fuga do rebaixamento
    if (Math.abs(pointsGap) <= 5) {
      pressureFactor *= 1.1;
    }

    return {
      pressureFactor: Math.min(1.2, Math.max(0.8, pressureFactor)),
      crowdEffect: Math.min(1.1, Math.max(0.95, crowdEffect)),
    };
  }

  /**
   * Integra todos os fatores contextuais em um multiplicador final
   */
  static calculateTotalContextualMultiplier(factors: ContextualFactors): number {
    let totalMultiplier = 1.0;

    // Aplicar todos os fatores com pesos (Média Ponderada)
    totalMultiplier = 
      (factors.motivationFactor * 0.20) + 
      (factors.injuryImpactFactor * 0.20) + 
      (factors.homeAdvantageMultiplier * 0.10) + 
      (factors.headToHeadWinRate * 0.10) + 
      (factors.weatherImpactFactor * 0.10) + 
      (factors.recentFormFactor * 0.20) + 
      (factors.pressureFactor * 0.10);

    // Normalizar para evitar distorções extremas
    return Math.min(1.4, Math.max(0.6, totalMultiplier));
  }
}
