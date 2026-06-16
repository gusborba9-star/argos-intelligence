// ============================================================
// TELEMETRY SERVICE v5.0 — ADVANCED MONITORING
// Telemetria de performance, erros e discrepâncias de dados
// ============================================================

export interface TelemetryEvent {
  timestamp: number;
  eventType: 
    | "SIMULATION_START" 
    | "SIMULATION_END" 
    | "ERROR" 
    | "ANOMALY" 
    | "CACHE_HIT" 
    | "CACHE_MISS" 
    | "ANTI_FRAGILITY_TRIGGER"
    | "SECURITY_ALERT"
    | "PAYMENT_CONFIRMED"
    | "PAYMENT_ERROR"
    | "PAYMENT_EXPIRED"
    | "WEBHOOK_ERROR"
    | "MODEL_RECALIBRATION"
    | "CONSENSUS_VOTING"
    | "FAILOVER_EXECUTED"
    | "MAINTENANCE_ALERT";
  matchId: string;
  leagueId?: string;
  vertical?: string;
  duration?: number;
  metadata?: Record<string, any>;
}

export interface PerformanceMetrics {
  matchId: string;
  totalExecutionTimeMs: number;
  dataIngestionTimeMs: number;
  simulationTimeMs: number;
  persistenceTimeMs: number;
  cacheHitRate: number;
  anomaliesDetected: number;
}

export class TelemetryService {
  private events: TelemetryEvent[] = [];
  private performanceMetrics: Map<string, PerformanceMetrics> = new Map();
  private readonly MAX_EVENTS = 10000; // Manter apenas os últimos 10k eventos em memória

  /**
   * Registra um evento de telemetria
   */
  recordEvent(event: Omit<TelemetryEvent, "timestamp">): void {
    const telemetryEvent: TelemetryEvent = {
      ...event,
      timestamp: Date.now(),
    };

    this.events.push(telemetryEvent);

    // Manter apenas os últimos MAX_EVENTS
    if (this.events.length > this.MAX_EVENTS) {
      this.events.shift();
    }

    // Log em tempo real para eventos críticos
    const criticalEvents: Array<TelemetryEvent["eventType"]> = ["ERROR", "ANOMALY", "ANTI_FRAGILITY_TRIGGER", "SECURITY_ALERT", "PAYMENT_ERROR", "WEBHOOK_ERROR", "MAINTENANCE_ALERT"];
    if (criticalEvents.includes(event.eventType)) {
      console.warn(`[TelemetryService] ${event.eventType}:`, telemetryEvent);
    }
  }

  /**
   * Registra métricas de performance para um jogo
   */
  recordPerformanceMetrics(metrics: PerformanceMetrics): void {
    this.performanceMetrics.set(metrics.matchId, metrics);

    // Log de performance
    console.log(`[TelemetryService] Performance Metrics for ${metrics.matchId}:`, {
      totalExecutionTimeMs: metrics.totalExecutionTimeMs,
      dataIngestionTimeMs: metrics.dataIngestionTimeMs,
      simulationTimeMs: metrics.simulationTimeMs,
      persistenceTimeMs: metrics.persistenceTimeMs,
      cacheHitRate: `${(metrics.cacheHitRate * 100).toFixed(2)}%`,
      anomaliesDetected: metrics.anomaliesDetected,
    });
  }

  /**
   * Retorna estatísticas de eventos
   */
  getEventStatistics(): {
    totalEvents: number;
    errorCount: number;
    anomalyCount: number;
    antiFragilityTriggers: number;
    cacheHitRate: number;
  } {
    const errorCount = this.events.filter((e) => e.eventType === "ERROR").length;
    const anomalyCount = this.events.filter((e) => e.eventType === "ANOMALY").length;
    const antiFragilityTriggers = this.events.filter((e) => e.eventType === "ANTI_FRAGILITY_TRIGGER").length;
    const cacheHits = this.events.filter((e) => e.eventType === "CACHE_HIT").length;
    const cacheMisses = this.events.filter((e) => e.eventType === "CACHE_MISS").length;
    const totalCacheEvents = cacheHits + cacheMisses;

    return {
      totalEvents: this.events.length,
      errorCount,
      anomalyCount,
      antiFragilityTriggers,
      cacheHitRate: totalCacheEvents > 0 ? cacheHits / totalCacheEvents : 0,
    };
  }

  /**
   * Retorna as métricas de performance para um jogo
   */
  getPerformanceMetrics(matchId: string): PerformanceMetrics | undefined {
    return this.performanceMetrics.get(matchId);
  }

  /**
   * Retorna todos os eventos de um tipo específico
   */
  getEventsByType(eventType: TelemetryEvent["eventType"]): TelemetryEvent[] {
    return this.events.filter((e) => e.eventType === eventType);
  }

  /**
   * Retorna os últimos N eventos
   */
  getRecentEvents(limit: number = 100): TelemetryEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Limpa todos os eventos (útil para testes)
   */
  clearEvents(): void {
    this.events = [];
    this.performanceMetrics.clear();
  }
}

// Singleton global
export const telemetryService = new TelemetryService();
