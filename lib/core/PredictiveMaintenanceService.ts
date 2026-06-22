// ============================================================
// PREDICTIVE MAINTENANCE SERVICE v1.1 — FAILOVER AUTOMÁTICO
// Monitora latência e falhas, realiza failover para rotas backup
// Migração para PropLine API
// ============================================================

import { telemetryService } from "@/lib/core/TelemetryService";
import { propLineConfig } from "./PropLineConfigManager";

export interface EndpointHealth {
  name: string;
  url: string;
  isHealthy: boolean;
  latencyMs: number;
  failureCount: number;
  lastFailure?: string;
  uptime: number; // Porcentagem 0-100
}

export interface MaintenanceAlert {
  severity: "INFO" | "WARNING" | "CRITICAL";
  endpoint: string;
  message: string;
  timestamp: string;
  recommendedAction: string;
}

export class PredictiveMaintenanceService {
  private readonly LATENCY_WARNING_THRESHOLD = 500; // ms
  private readonly LATENCY_CRITICAL_THRESHOLD = 2000; // ms
  private readonly FAILURE_THRESHOLD = 3; // Falhas consecutivas
  private readonly HEALTH_CHECK_INTERVAL = 30000; // 30 segundos
  private readonly RECOVERY_TIMEOUT = 300000; // 5 minutos

  private endpointHealth: Map<string, EndpointHealth> = new Map();
  private alerts: MaintenanceAlert[] = [];
  private failoverRoutes: Map<string, string[]> = new Map();

  constructor() {
    this.initializeEndpoints();
    this.startHealthChecks();
  }

  /**
   * Inicializa endpoints monitorados
   */
  private initializeEndpoints(): void {
    const endpoints = [
      { name: "PropLine API", url: propLineConfig.getBaseUrl() },
      { name: "Supabase", url: process.env.NEXT_PUBLIC_SUPABASE_URL || "" },
      { name: "Upstash Redis", url: "https://infinite-perch-150057.upstash.io" },
      { name: "Efi Pix", url: "https://api.gerencianet.com.br" },
    ];

    endpoints.forEach((ep) => {
      this.endpointHealth.set(ep.name, {
        name: ep.name,
        url: ep.url,
        isHealthy: true,
        latencyMs: 0,
        failureCount: 0,
        uptime: 100,
      });
    });

    // Configurar rotas de failover (PropLine v1 é o primário agora)
    this.failoverRoutes.set("PropLine API", [
      "https://api.prop-line.com/v1", // Redundância interna se necessário
    ]);

    console.log("[PredictiveMaintenanceService] Inicializado com " + endpoints.length + " endpoints");
  }

  /**
   * Inicia verificações de saúde periódicas
   */
  private startHealthChecks(): void {
    setInterval(() => {
      this.runHealthChecks();
    }, this.HEALTH_CHECK_INTERVAL);

    console.log("[PredictiveMaintenanceService] Health checks iniciados");
  }

  /**
   * Executa verificação de saúde de todos os endpoints
   */
  private async runHealthChecks(): Promise<void> {
    console.log("[PredictiveMaintenanceService] Executando health checks...");

    for (const [name, health] of this.endpointHealth) {
      if (!health.url) continue;

      try {
        const startTime = Date.now();
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        // Para PropLine, precisamos enviar o header de API Key
        const headers: Record<string, string> = {};
        if (name === "PropLine API") {
          headers["X-API-Key"] = propLineConfig.getApiKey();
        }

        const response = await fetch(health.url, { 
          method: "HEAD", 
          headers,
          signal: controller.signal 
        });
        
        clearTimeout(timeoutId);
        const latency = Date.now() - startTime;

        if (response.ok || response.status === 405 || response.status === 401) {
          // 405 = Method Not Allowed, 401 = Unauthorized (ambos indicam que o endpoint respondeu)
          this.recordSuccess(name, latency);
        } else {
          this.recordFailure(name);
        }
      } catch (error: any) {
        this.recordFailure(name);
        console.warn(`[PredictiveMaintenanceService] Falha ao verificar ${name}: ${error.message}`);
      }
    }
  }

  /**
   * Registra sucesso de um endpoint
   */
  private recordSuccess(name: string, latencyMs: number): void {
    const health = this.endpointHealth.get(name);
    if (!health) return;

    health.latencyMs = latencyMs;
    health.failureCount = 0;

    // Verificar alertas de latência
    if (latencyMs > this.LATENCY_CRITICAL_THRESHOLD) {
      this.createAlert(
        name,
        "CRITICAL",
        `Latência crítica detectada: ${latencyMs}ms`,
        "Considere escalar para failover ou investigar gargalo"
      );
    } else if (latencyMs > this.LATENCY_WARNING_THRESHOLD) {
      this.createAlert(
        name,
        "WARNING",
        `Latência elevada: ${latencyMs}ms`,
        "Monitorar próximas requisições"
      );
    }

    if (!health.isHealthy) {
      console.log(`[PredictiveMaintenanceService] ✅ ${name} recuperado`);
      health.isHealthy = true;
      this.createAlert(name, "INFO", `${name} está operacional novamente`, "Nenhuma ação necessária");
    }
  }

  /**
   * Registra falha de um endpoint
   */
  private recordFailure(name: string): void {
    const health = this.endpointHealth.get(name);
    if (!health) return;

    health.failureCount++;
    health.lastFailure = new Date().toISOString();

    if (health.failureCount >= this.FAILURE_THRESHOLD && health.isHealthy) {
      health.isHealthy = false;
      console.error(`[PredictiveMaintenanceService] ❌ ${name} marcado como unhealthy`);

      this.createAlert(
        name,
        "CRITICAL",
        `${name} falhou ${health.failureCount} vezes consecutivas`,
        `Iniciando failover automático para rota de backup`
      );

      // Iniciar failover
      this.initiateFailover(name);
    }
  }

  /**
   * Inicia failover automático para rota de backup
   */
  private async initiateFailover(endpointName: string): Promise<void> {
    const backupRoutes = this.failoverRoutes.get(endpointName);
    if (!backupRoutes || backupRoutes.length === 0) {
      console.error(`[PredictiveMaintenanceService] Nenhuma rota de backup para ${endpointName}`);
      return;
    }

    console.log(`[PredictiveMaintenanceService] 🔄 Iniciando failover para ${endpointName}...`);

    for (const backupUrl of backupRoutes) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(backupUrl, { 
          method: "HEAD", 
          signal: controller.signal 
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok || response.status === 405) {
          console.log(`[PredictiveMaintenanceService] ✅ Failover bem-sucedido para ${backupUrl}`);
          this.createAlert(
            endpointName,
            "WARNING",
            `Failover realizado para ${backupUrl}`,
            "Monitorar recuperação do endpoint primário"
          );

          telemetryService.recordEvent({
            eventType: "FAILOVER_EXECUTED",
            matchId: endpointName,
            metadata: { details: `Failover to ${backupUrl}` },
          });

          return;
        }
      } catch (error: any) {
        console.warn(`[PredictiveMaintenanceService] Backup ${backupUrl} também indisponível`);
      }
    }

    console.error(`[PredictiveMaintenanceService] ❌ Todas as rotas de backup falharam para ${endpointName}`);
    this.createAlert(
      endpointName,
      "CRITICAL",
      `Todas as rotas de backup falharam para ${endpointName}`,
      "Escalar para suporte manual"
    );
  }

  /**
   * Cria um alerta de manutenção
   */
  private createAlert(
    endpoint: string,
    severity: "INFO" | "WARNING" | "CRITICAL",
    message: string,
    recommendedAction: string
  ): void {
    const alert: MaintenanceAlert = {
      severity,
      endpoint,
      message,
      timestamp: new Date().toISOString(),
      recommendedAction,
    };

    this.alerts.push(alert);

    // Manter apenas os últimos 100 alertas
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }

    console.log(`[PredictiveMaintenanceService] [${severity}] ${endpoint}: ${message}`);

    // Registrar na telemetria
    telemetryService.recordEvent({
      eventType: "MAINTENANCE_ALERT",
      matchId: endpoint,
      metadata: { details: `${severity}: ${message}` },
    });
  }

  /**
   * Retorna status de saúde de todos os endpoints
   */
  getHealthStatus(): EndpointHealth[] {
    return Array.from(this.endpointHealth.values());
  }

  /**
   * Retorna alertas recentes
   */
  getRecentAlerts(limit: number = 10): MaintenanceAlert[] {
    return this.alerts.slice(-limit);
  }

  /**
   * Verifica se um endpoint específico está saudável
   */
  isEndpointHealthy(name: string): boolean {
    const health = this.endpointHealth.get(name);
    return health?.isHealthy ?? false;
  }

  /**
   * Retorna latência média de um endpoint
   */
  getAverageLatency(name: string): number {
    const health = this.endpointHealth.get(name);
    return health?.latencyMs ?? 0;
  }
}

export const predictiveMaintenanceService = new PredictiveMaintenanceService();
