// ============================================================
// CIRCUIT BREAKER v5.0 — UNBREAKABLE SYSTEM RESILIENCE
// Isolamento de falhas e garantia de 99.99% SLA
// ============================================================

export enum CircuitState {
  CLOSED = "CLOSED", // Operando normalmente
  OPEN = "OPEN", // Falha detectada, rejeitando requisições
  HALF_OPEN = "HALF_OPEN", // Testando recuperação
}

export interface CircuitBreakerConfig {
  name: string;
  failureThreshold: number; // Número de falhas antes de abrir
  successThreshold: number; // Número de sucessos para fechar
  timeout: number; // Tempo em ms antes de tentar recuperação
  resetTimeout: number; // Tempo em ms para resetar contadores
}

export interface CircuitBreakerMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  rejectedRequests: number;
  lastFailureTime?: number;
  lastSuccessTime?: number;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private rejectedCount: number = 0;
  private lastFailureTime?: number;
  private lastSuccessTime?: number;
  private nextAttemptTime: number = 0;
  private config: CircuitBreakerConfig;
  private metrics: CircuitBreakerMetrics;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      rejectedRequests: 0,
    };
  }

  /**
   * Executa uma função com proteção de circuit breaker
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.metrics.totalRequests++;

    // Se o circuito está aberto, rejeitar requisição
    if (this.state === CircuitState.OPEN) {
      // Se passou o timeout, tentar recuperação
      if (Date.now() >= this.nextAttemptTime) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        console.log(`[CircuitBreaker] ${this.config.name} - Transição para HALF_OPEN`);
      } else {
        this.metrics.rejectedRequests++;
        throw new Error(`[CircuitBreaker] ${this.config.name} - Circuit is OPEN. Rejecting request.`);
      }
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
      throw error;
    }
  }

  /**
   * Registra um sucesso
   */
  private recordSuccess(): void {
    this.metrics.successfulRequests++;
    this.lastSuccessTime = Date.now();

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      console.log(`[CircuitBreaker] ${this.config.name} - Success in HALF_OPEN: ${this.successCount}/${this.config.successThreshold}`);

      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.failureCount = 0;
        this.successCount = 0;
        console.log(`[CircuitBreaker] ${this.config.name} - Transição para CLOSED`);
      }
    } else if (this.state === CircuitState.CLOSED) {
      this.failureCount = Math.max(0, this.failureCount - 1); // Reduzir contador de falhas
    }
  }

  /**
   * Registra uma falha
   */
  private recordFailure(): void {
    this.metrics.failedRequests++;
    this.lastFailureTime = Date.now();
    this.failureCount++;

    console.warn(`[CircuitBreaker] ${this.config.name} - Failure recorded: ${this.failureCount}/${this.config.failureThreshold}`);

    if (this.state === CircuitState.HALF_OPEN) {
      // Se falhar em HALF_OPEN, voltar para OPEN
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.config.timeout;
      console.error(`[CircuitBreaker] ${this.config.name} - Transição para OPEN (timeout: ${this.config.timeout}ms)`);
    } else if (this.state === CircuitState.CLOSED && this.failureCount >= this.config.failureThreshold) {
      // Se atingir limite de falhas, abrir circuito
      this.state = CircuitState.OPEN;
      this.nextAttemptTime = Date.now() + this.config.timeout;
      console.error(`[CircuitBreaker] ${this.config.name} - Transição para OPEN (limite de falhas atingido)`);
    }
  }

  /**
   * Retorna o estado atual do circuito
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Retorna as métricas do circuito
   */
  getMetrics(): CircuitBreakerMetrics {
    return {
      ...this.metrics,
      lastFailureTime: this.lastFailureTime,
      lastSuccessTime: this.lastSuccessTime,
    };
  }

  /**
   * Reseta o circuito manualmente
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.rejectedCount = 0;
    this.nextAttemptTime = 0;
    console.log(`[CircuitBreaker] ${this.config.name} - Reset manual`);
  }
}

/**
 * Pool de Circuit Breakers para gerenciar múltiplas dependências
 */
export class CircuitBreakerPool {
  private breakers: Map<string, CircuitBreaker> = new Map();

  /**
   * Registra um novo circuit breaker
   */
  register(config: CircuitBreakerConfig): CircuitBreaker {
    const breaker = new CircuitBreaker(config);
    this.breakers.set(config.name, breaker);
    return breaker;
  }

  /**
   * Recupera um circuit breaker por nome
   */
  get(name: string): CircuitBreaker | undefined {
    return this.breakers.get(name);
  }

  /**
   * Retorna todas as métricas
   */
  getAllMetrics(): Record<string, CircuitBreakerMetrics> {
    const metrics: Record<string, CircuitBreakerMetrics> = {};
    for (const [name, breaker] of this.breakers) {
      metrics[name] = breaker.getMetrics();
    }
    return metrics;
  }

  /**
   * Retorna o status geral de saúde
   */
  getHealthStatus(): { healthy: boolean; openCircuits: string[] } {
    const openCircuits: string[] = [];
    for (const [name, breaker] of this.breakers) {
      if (breaker.getState() === CircuitState.OPEN) {
        openCircuits.push(name);
      }
    }
    return {
      healthy: openCircuits.length === 0,
      openCircuits,
    };
  }
}

// Singleton global
export const circuitBreakerPool = new CircuitBreakerPool();
