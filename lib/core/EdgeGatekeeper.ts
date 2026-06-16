// ============================================================
// EDGE GATEKEEPER v5.0 — TIER-BASED ACCESS CONTROL
// Validação rigorosa de tier e segmentação de dados na Edge
// ============================================================

export enum UserTier {
  FREE = "FREE",
  PRO = "PRO",
  VIP = "VIP",
}

export enum MarketVerticalAccess {
  // Free Tier - Apenas Validation (Alta Probabilidade, EV Neutro)
  WINNER = "WINNER",
  GOALS = "GOALS",
  
  // Pro Tier - Value Markets (EV+)
  CORNERS = "CORNERS",
  CARDS = "CARDS",
  SHOTS = "SHOTS",
  
  // VIP Tier - Premium Markets
  BTTS = "BTTS",
  HANDICAP = "HANDICAP",
  FOULS = "FOULS",
  TACKLES = "TACKLES",
  SHOTS_ON_TARGET = "SHOTS_ON_TARGET",
}

export const TIER_VERTICAL_MAP: Record<UserTier, MarketVerticalAccess[]> = {
  [UserTier.FREE]: [
    MarketVerticalAccess.WINNER,
    MarketVerticalAccess.GOALS,
  ],
  [UserTier.PRO]: [
    MarketVerticalAccess.WINNER,
    MarketVerticalAccess.GOALS,
    MarketVerticalAccess.CORNERS,
    MarketVerticalAccess.CARDS,
    MarketVerticalAccess.SHOTS,
  ],
  [UserTier.VIP]: [
    MarketVerticalAccess.WINNER,
    MarketVerticalAccess.GOALS,
    MarketVerticalAccess.CORNERS,
    MarketVerticalAccess.CARDS,
    MarketVerticalAccess.SHOTS,
    MarketVerticalAccess.BTTS,
    MarketVerticalAccess.HANDICAP,
    MarketVerticalAccess.FOULS,
    MarketVerticalAccess.TACKLES,
    MarketVerticalAccess.SHOTS_ON_TARGET,
  ],
};

export const MINIMUM_EV_BY_TIER: Record<UserTier, number> = {
  [UserTier.FREE]: 0.0, // Validation markets (EV neutro)
  [UserTier.PRO]: 0.03, // EV+ markets
  [UserTier.VIP]: 0.01, // Qualquer EV positivo
};

export interface GatekeeperContext {
  userId: string;
  userTier: UserTier;
  requestedVerticals: string[];
  minEV?: number;
}

export interface GatekeeperDecision {
  allowed: boolean;
  approvedVerticals: string[];
  reason: string;
  timestamp: number;
}

export class EdgeGatekeeper {
  /**
   * Valida acesso a verticais específicas baseado no tier do usuário
   */
  static validateAccess(context: GatekeeperContext): GatekeeperDecision {
    const timestamp = Date.now();
    const userTier = context.userTier || UserTier.FREE;
    const allowedVerticals = TIER_VERTICAL_MAP[userTier];
    const minEV = context.minEV ?? MINIMUM_EV_BY_TIER[userTier];

    // Filtrar verticais solicitadas com base no tier
    const approvedVerticals = context.requestedVerticals.filter((vertical) =>
      allowedVerticals.includes(vertical as MarketVerticalAccess)
    );

    if (approvedVerticals.length === 0) {
      return {
        allowed: false,
        approvedVerticals: [],
        reason: `Tier ${userTier} não tem acesso às verticais solicitadas. Verticais permitidas: ${allowedVerticals.join(", ")}`,
        timestamp,
      };
    }

    return {
      allowed: true,
      approvedVerticals,
      reason: `Acesso concedido para ${approvedVerticals.length} vertical(is). Tier: ${userTier}. Min EV: ${minEV}`,
      timestamp,
    };
  }

  /**
   * Filtra sinais baseado no tier do usuário
   */
  static filterSignalsByTier(signals: any[], userTier: UserTier): any[] {
    const allowedVerticals = TIER_VERTICAL_MAP[userTier];
    const minEV = MINIMUM_EV_BY_TIER[userTier];

    return signals.filter((signal) => {
      // Verificar se a vertical é permitida
      if (!allowedVerticals.includes(signal.vertical)) {
        return false;
      }

      // Verificar se o EV mínimo é atingido
      if (signal.expectedValue < minEV) {
        return false;
      }

      // Free tier: apenas Validation (alta probabilidade, EV neutro)
      if (userTier === UserTier.FREE) {
        if (signal.status !== "OPTIMIZED" || signal.probability < 0.65) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Calcula o Kelly Criterion baseado no tier (VIP recebe sugestões mais agressivas)
   */
  static calculateKellyStake(
    probability: number,
    odds: number,
    bankroll: number,
    userTier: UserTier
  ): number {
    // Fórmula de Kelly: (bp - q) / b, onde b = odds - 1, p = probabilidade, q = 1 - p
    const b = odds - 1;
    const q = 1 - probability;
    let kellyFraction = (b * probability - q) / b;

    // Aplicar fração de Kelly baseada no tier (fractional Kelly para segurança)
    const kellyMultiplier = userTier === UserTier.VIP ? 0.5 : userTier === UserTier.PRO ? 0.25 : 0.1;
    kellyFraction *= kellyMultiplier;

    // Garantir que o stake não seja negativo ou excessivo
    kellyFraction = Math.max(0, Math.min(0.05, kellyFraction)); // Max 5% do bankroll

    return bankroll * kellyFraction;
  }

  /**
   * Gera um token de autorização para a Edge (JWT-like)
   */
  static generateAuthToken(userId: string, userTier: UserTier, expiresIn: number = 3600): string {
    const payload = {
      userId,
      userTier,
      issuedAt: Date.now(),
      expiresAt: Date.now() + expiresIn * 1000,
    };

    // Em produção, usar JWT real com chave secreta
    return Buffer.from(JSON.stringify(payload)).toString("base64");
  }

  /**
   * Valida um token de autorização
   */
  static validateAuthToken(token: string): { valid: boolean; payload?: any; reason?: string } {
    try {
      const payload = JSON.parse(Buffer.from(token, "base64").toString("utf-8"));

      if (payload.expiresAt < Date.now()) {
        return { valid: false, reason: "Token expirado" };
      }

      return { valid: true, payload };
    } catch (error) {
      return { valid: false, reason: "Token inválido" };
    }
  }
}
