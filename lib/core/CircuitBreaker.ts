// ============================================================
// CIRCUIT BREAKER v5.0 — RESILIENT POOL MANAGEMENT
// Proteção contra cascata de falhas na PropLine API
// ============================================================

export enum CircuitState {
  CLOSED = 'CLOSED',      // Normal operation
  OPEN = 'OPEN',          // Failing, reject requests
  HALF_OPEN = 'HALF_OPEN' // Testing if service recovered
}

export interface CircuitBreakerConfig {
  failureThreshold: number;  // Falhas antes de abrir
  successThreshold: number;  // Sucessos antes de fechar
  resetTimeout: number;      // Tempo em ms antes de tentar recuperar
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime: number = 0;
  private config: CircuitBreakerConfig;

  constructor(config: CircuitBreakerConfig) {
    this.config = config;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() - this.lastFailureTime > this.config.resetTimeout) {
        this.state = CircuitState.HALF_OPEN;
        this.successCount = 0;
        console.log('[CircuitBreaker] Tentando recuperação (HALF_OPEN)');
      } else {
        throw new Error('[CircuitBreaker] Circuit is OPEN - request rejected');
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.failureCount = 0;
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.config.successThreshold) {
        this.state = CircuitState.CLOSED;
        console.log('[CircuitBreaker] Recuperado - Circuit CLOSED');
      }
    }
  }

  private onFailure(): void {
    this.lastFailureTime = Date.now();
    
    if (this.state === CircuitState.HALF_OPEN) {
      this.state = CircuitState.OPEN;
      console.error('[CircuitBreaker] Falha durante recuperação - reabrindo circuit');
      return;
    }

    this.failureCount++;
    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.OPEN;
      console.error(`[CircuitBreaker] Limite de falhas atingido (${this.failureCount}) - abrindo circuit`);
    }
  }

  getState(): CircuitState {
    return this.state;
  }
}

export const circuitBreakerPool = new Map<string, CircuitBreaker>();

export function getCircuitBreaker(key: string, config: CircuitBreakerConfig): CircuitBreaker {
  if (!circuitBreakerPool.has(key)) {
    circuitBreakerPool.set(key, new CircuitBreaker(config));
  }
  return circuitBreakerPool.get(key)!;
}
