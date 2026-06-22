// ============================================================
// PROPLINE MIGRATION BRIDGE v5.0
// Configuração centralizada da API PropLine
// ============================================================

export interface PropLineConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
  maxDailyRequests: number;
  circuitBreakerThresholds: {
    failureThreshold: number;
    successThreshold: number;
    resetTimeout: number;
  };
}

/**
 * Provê uma fonte única de verdade para todas as configurações da PropLine API
 * Facilita transições futuras de provedores
 */
export class PropLineConfigManager {
  private static instance: PropLineConfigManager;
  private config: PropLineConfig;

  private constructor() {
    this.config = {
      baseUrl: "https://api.prop-line.com/v1",
      apiKey: process.env.PROPLINE_API_KEY || "",
      timeout: 15000,
      maxDailyRequests: 100,
      circuitBreakerThresholds: {
        failureThreshold: 5,
        successThreshold: 3,
        resetTimeout: 300000,
      },
    };

    if (!this.config.apiKey) {
      console.warn(
        "[PropLineConfigManager] ⚠️ PROPLINE_API_KEY não configurada. Sistema pode não funcionar corretamente."
      );
    }
  }

  public static getInstance(): PropLineConfigManager {
    if (!PropLineConfigManager.instance) {
      PropLineConfigManager.instance = new PropLineConfigManager();
    }
    return PropLineConfigManager.instance;
  }

  public getConfig(): PropLineConfig {
    return this.config;
  }

  public getBaseUrl(): string {
    return this.config.baseUrl;
  }

  public getApiKey(): string {
    return this.config.apiKey;
  }

  public getHeaders(): { "X-API-Key": string } {
    return {
      "X-API-Key": this.config.apiKey,
    };
  }

  /**
   * Valida que a configuração está completa e válida
   */
  public validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.config.apiKey || this.config.apiKey.trim() === "") {
      errors.push("PROPLINE_API_KEY não configurada");
    }

    if (!this.config.baseUrl.startsWith("https://")) {
      errors.push("Base URL deve usar HTTPS");
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

export const propLineConfig = PropLineConfigManager.getInstance();
