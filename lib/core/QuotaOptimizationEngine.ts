// ============================================================
// QUOTA OPTIMIZATION ENGINE v1.0 — BOOTSTRAP STRATEGY
// Gerencia as 100 chamadas diárias da API Football com máxima eficiência
// Prioriza ligas elite e oportunidades de alta assertividade
// ============================================================

export interface QuotaAllocation {
  league: string;
  leagueId: number;
  priority: number; // 1-10 (10 = máxima prioridade)
  allocatedCalls: number;
  usedCalls: number;
  remainingCalls: number;
  expectedOpportunities: number; // Estimativa de sinais gerados
}

export interface DailyQuotaStatus {
  date: string;
  totalDailyQuota: number;
  usedToday: number;
  remainingToday: number;
  allocationsByLeague: QuotaAllocation[];
  nbaStandbyActivated: boolean;
  nbaQuotaUsed: number;
}

export class QuotaOptimizationEngine {
  private readonly TOTAL_DAILY_QUOTA = 100;
  private readonly ELITE_LEAGUES = [
    { id: 39, name: "Premier League", priority: 10, expectedOpportunities: 15 },
    { id: 140, name: "La Liga", priority: 10, expectedOpportunities: 14 },
    { id: 78, name: "Bundesliga", priority: 10, expectedOpportunities: 13 },
    { id: 135, name: "Serie A", priority: 10, expectedOpportunities: 12 },
    { id: 61, name: "Ligue 1", priority: 9, expectedOpportunities: 11 },
    { id: 71, name: "Brasileirão Série A", priority: 9, expectedOpportunities: 10 },
    { id: 2, name: "Champions League", priority: 10, expectedOpportunities: 20 },
    { id: 307, name: "Saudi Pro League", priority: 8, expectedOpportunities: 8 },
    { id: 128, name: "Liga Argentina", priority: 7, expectedOpportunities: 7 },
  ];

  private readonly NBA_CONFIG = {
    id: "nba",
    name: "NBA",
    priority: 3, // Baixa prioridade, ativado apenas em standby
    expectedOpportunities: 25,
    standbyThreshold: 0.3, // Ativar se oportunidades de futebol caírem abaixo de 30%
  };

  private quotaStatus: DailyQuotaStatus;
  private lastResetDate: string = "";

  constructor() {
    this.quotaStatus = this.initializeDailyQuota();
  }

  /**
   * Inicializa a alocação diária de quota
   */
  private initializeDailyQuota(): DailyQuotaStatus {
    const today = new Date().toISOString().split("T")[0];

    // Calcular alocação baseada em prioridade
    const totalPriority = this.ELITE_LEAGUES.reduce((sum, league) => sum + league.priority, 0);
    const allocationsByLeague: QuotaAllocation[] = this.ELITE_LEAGUES.map((league) => ({
      league: league.name,
      leagueId: league.id,
      priority: league.priority,
      allocatedCalls: Math.ceil((league.priority / totalPriority) * this.TOTAL_DAILY_QUOTA * 0.85), // 85% para futebol
      usedCalls: 0,
      remainingCalls: Math.ceil((league.priority / totalPriority) * this.TOTAL_DAILY_QUOTA * 0.85),
      expectedOpportunities: league.expectedOpportunities,
    }));

    return {
      date: today,
      totalDailyQuota: this.TOTAL_DAILY_QUOTA,
      usedToday: 0,
      remainingToday: this.TOTAL_DAILY_QUOTA,
      allocationsByLeague,
      nbaStandbyActivated: false,
      nbaQuotaUsed: 0,
    };
  }

  /**
   * Reseta a quota se o dia mudou
   */
  private checkAndResetQuota(): void {
    const today = new Date().toISOString().split("T")[0];
    if (this.lastResetDate !== today) {
      this.quotaStatus = this.initializeDailyQuota();
      this.lastResetDate = today;
      console.log("[QuotaOptimizationEngine] ✅ Quota diária resetada para", today);
    }
  }

  /**
   * Aloca uma chamada para uma liga específica
   * Retorna true se a alocação foi bem-sucedida, false se quota esgotada
   */
  public allocateCall(leagueId: number): boolean {
    this.checkAndResetQuota();

    const leagueAllocation = this.quotaStatus.allocationsByLeague.find((a) => a.leagueId === leagueId);
    if (!leagueAllocation) {
      console.warn(`[QuotaOptimizationEngine] Liga ${leagueId} não encontrada na alocação.`);
      return false;
    }

    if (leagueAllocation.remainingCalls <= 0) {
      console.warn(`[QuotaOptimizationEngine] Quota esgotada para ${leagueAllocation.league}`);
      return false;
    }

    if (this.quotaStatus.remainingToday <= 0) {
      console.warn("[QuotaOptimizationEngine] Quota diária total esgotada. Ativando NBA Standby...");
      this.activateNBAStandby();
      return false;
    }

    leagueAllocation.usedCalls++;
    leagueAllocation.remainingCalls--;
    this.quotaStatus.usedToday++;
    this.quotaStatus.remainingToday--;

    console.log(
      `[QuotaOptimizationEngine] Chamada alocada para ${leagueAllocation.league}. Restante: ${leagueAllocation.remainingCalls}/${this.quotaStatus.remainingToday}`
    );

    return true;
  }

  /**
   * Ativa o módulo NBA se a demanda de futebol cair abaixo do threshold
   */
  private activateNBAStandby(): void {
    const totalFootballOpportunities = this.quotaStatus.allocationsByLeague.reduce(
      (sum, a) => sum + (a.expectedOpportunities * a.usedCalls) / (a.allocatedCalls || 1),
      0
    );

    const opportunityRate = totalFootballOpportunities / (this.quotaStatus.usedToday || 1);

    if (opportunityRate < this.NBA_CONFIG.standbyThreshold) {
      console.log(
        `[QuotaOptimizationEngine] 🏀 NBA Standby Ativado! Taxa de oportunidades de futebol: ${(opportunityRate * 100).toFixed(2)}%`
      );
      this.quotaStatus.nbaStandbyActivated = true;
    }
  }

  /**
   * Aloca uma chamada para NBA (apenas se standby ativado)
   */
  public allocateNBACall(): boolean {
    this.checkAndResetQuota();

    if (!this.quotaStatus.nbaStandbyActivated) {
      console.warn("[QuotaOptimizationEngine] NBA Standby não ativado. Prioridade: Futebol.");
      return false;
    }

    if (this.quotaStatus.remainingToday <= 0) {
      console.warn("[QuotaOptimizationEngine] Quota diária total esgotada.");
      return false;
    }

    this.quotaStatus.nbaQuotaUsed++;
    this.quotaStatus.usedToday++;
    this.quotaStatus.remainingToday--;

    console.log(`[QuotaOptimizationEngine] 🏀 Chamada NBA alocada. Restante: ${this.quotaStatus.remainingToday}`);

    return true;
  }

  /**
   * Retorna o status atual da quota
   */
  public getQuotaStatus(): DailyQuotaStatus {
    this.checkAndResetQuota();
    return { ...this.quotaStatus };
  }

  /**
   * Retorna a liga com maior prioridade e quota disponível
   */
  public getNextPriorityLeague(): QuotaAllocation | null {
    this.checkAndResetQuota();

    const availableLeagues = this.quotaStatus.allocationsByLeague.filter((a) => a.remainingCalls > 0);

    if (availableLeagues.length === 0) {
      return null;
    }

    // Ordenar por prioridade e retornar a primeira
    return availableLeagues.sort((a, b) => b.priority - a.priority)[0];
  }

  /**
   * Retorna estatísticas de eficiência
   */
  public getEfficiencyMetrics(): {
    quotaUtilization: number; // Percentual de quota usada
    opportunitiesPerCall: number; // Média de oportunidades por chamada
    nbaStandbyStatus: boolean;
    recommendedAction: string;
  } {
    this.checkAndResetQuota();

    const quotaUtilization = (this.quotaStatus.usedToday / this.TOTAL_DAILY_QUOTA) * 100;
    const totalExpectedOpportunities = this.quotaStatus.allocationsByLeague.reduce((sum, a) => sum + a.expectedOpportunities, 0);
    const opportunitiesPerCall = totalExpectedOpportunities / (this.quotaStatus.usedToday || 1);

    let recommendedAction = "Continue with Elite Leagues";
    if (this.quotaStatus.remainingToday < 10) {
      recommendedAction = "Quota running low - Prepare for NBA Standby";
    }
    if (this.quotaStatus.nbaStandbyActivated) {
      recommendedAction = "NBA Standby Active - Monitor football opportunities";
    }

    return {
      quotaUtilization,
      opportunitiesPerCall,
      nbaStandbyStatus: this.quotaStatus.nbaStandbyActivated,
      recommendedAction,
    };
  }

  /**
   * Log detalhado de quota (para debugging)
   */
  public logQuotaStatus(): void {
    this.checkAndResetQuota();

    console.log("\n╔════════════════════════════════════════════════════════╗");
    console.log("║     QUOTA OPTIMIZATION ENGINE — DAILY STATUS         ║");
    console.log("╚════════════════════════════════════════════════════════╝");
    console.log(`📅 Data: ${this.quotaStatus.date}`);
    console.log(`📊 Quota Total: ${this.quotaStatus.usedToday}/${this.TOTAL_DAILY_QUOTA} usadas`);
    console.log(`⚽ Ligas Elite: ${this.quotaStatus.allocationsByLeague.map((a) => `${a.league} (${a.usedCalls}/${a.allocatedCalls})`).join(" | ")}`);
    console.log(`🏀 NBA Standby: ${this.quotaStatus.nbaStandbyActivated ? "✅ ATIVO" : "❌ Inativo"}`);
    console.log(`📈 Eficiência: ${this.getEfficiencyMetrics().opportunitiesPerCall.toFixed(2)} oportunidades/chamada`);
    console.log("");
  }
}

// Singleton global
export const quotaOptimizationEngine = new QuotaOptimizationEngine();
