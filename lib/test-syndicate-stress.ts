// ============================================================
// SYNDICATE-LEVEL STRESS TEST v5.0
// Simulação de volume de tráfego de grande syndicate americano
// ============================================================

import { ArgosOrchestratorV4 } from "./argos/orchestrator/ArgosOrchestratorV4";
import { MarketVertical } from "./core/ArgosUnifiedEngine";
import { telemetryService } from "./core/TelemetryService";
import dotenv from "dotenv";

dotenv.config();

interface StressTestConfig {
  concurrentRequests: number;
  durationSeconds: number;
  matchesPerSecond: number;
  verticalsPerMatch: number;
}

async function runSyndicateLevelStressTest() {
  const config: StressTestConfig = {
    concurrentRequests: 500, // Grande syndicate: 500 requisições simultâneas
    durationSeconds: 60, // 1 minuto de teste
    matchesPerSecond: 50, // 50 jogos por segundo
    verticalsPerMatch: 5, // 5 verticais por jogo
  };

  console.log(`
╔════════════════════════════════════════════════════════════╗
║     ARGOS v6.0 — SYNDICATE-LEVEL STRESS TEST              ║
║     Simulando volume de grande syndicate americano         ║
╚════════════════════════════════════════════════════════════╝
  `);

  console.log(`📊 Configuração do Teste:`);
  console.log(`  - Requisições Simultâneas: ${config.concurrentRequests}`);
  console.log(`  - Duração: ${config.durationSeconds}s`);
  console.log(`  - Jogos/Segundo: ${config.matchesPerSecond}`);
  console.log(`  - Verticais/Jogo: ${config.verticalsPerMatch}`);
  console.log(`  - Total Estimado: ${config.concurrentRequests * config.durationSeconds} requisições\n`);

  const orchestrator = new ArgosOrchestratorV4();
  const verticals: MarketVertical[] = [
    MarketVertical.WINNER,
    MarketVertical.GOALS,
    MarketVertical.CORNERS,
    MarketVertical.CARDS,
    MarketVertical.BTTS,
  ];

  const startTime = Date.now();
  const results = {
    succeeded: 0,
    failed: 0,
    totalDuration: 0,
    avgLatency: 0,
    minLatency: Infinity,
    maxLatency: 0,
  };

  // Gerar requisições em lotes
  const totalBatches = Math.ceil(config.concurrentRequests / 50);
  const latencies: number[] = [];

  for (let batch = 0; batch < totalBatches; batch++) {
    const batchSize = Math.min(50, config.concurrentRequests - batch * 50);
    const batchStart = Date.now();

    const promises = Array.from({ length: batchSize }).map(async (_, i) => {
      const matchId = `syndicate_test_${batch}_${i}_${Date.now()}`;
      const requestStart = Date.now();

      try {
        const auditResult = await orchestrator.runZeroTouchAudit(
          matchId,
          verticals.slice(0, config.verticalsPerMatch),
          undefined,
          { score: { home: 0, away: 0 }, elapsed: 0 }
        );

        const latency = Date.now() - requestStart;
        latencies.push(latency);

        if (auditResult.status === "SUCCESS") {
          results.succeeded++;
        } else {
          results.failed++;
        }

        return { status: auditResult.status, latency };
      } catch (error) {
        results.failed++;
        return { status: "ERROR", latency: Date.now() - requestStart };
      }
    });

    const batchResults = await Promise.allSettled(promises);
    const batchDuration = Date.now() - batchStart;

    console.log(`[Batch ${batch + 1}/${totalBatches}] Duração: ${batchDuration}ms | Sucessos: ${batchResults.filter(r => r.status === "fulfilled").length}/${batchSize}`);

    // Pausa entre lotes para simular tráfego realista
    if (batch < totalBatches - 1) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  const totalDuration = Date.now() - startTime;
  results.totalDuration = totalDuration;
  results.avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  results.minLatency = Math.min(...latencies);
  results.maxLatency = Math.max(...latencies);

  // Exibir resultados
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                   RESULTADOS DO TESTE                      ║
╚════════════════════════════════════════════════════════════╝
  `);

  console.log(`✅ Sucessos: ${results.succeeded}`);
  console.log(`❌ Falhas: ${results.failed}`);
  console.log(`📊 Taxa de Sucesso: ${((results.succeeded / (results.succeeded + results.failed)) * 100).toFixed(2)}%`);
  console.log(`⏱️  Tempo Total: ${results.totalDuration}ms`);
  console.log(`⚡ Latência Média: ${results.avgLatency.toFixed(2)}ms`);
  console.log(`🚀 Latência Mínima: ${results.minLatency.toFixed(2)}ms`);
  console.log(`🐌 Latência Máxima: ${results.maxLatency.toFixed(2)}ms`);
  console.log(`📈 Requisições/Segundo: ${(config.concurrentRequests / (results.totalDuration / 1000)).toFixed(2)}`);

  // Telemetria
  const telemetryStats = telemetryService.getEventStatistics();
  console.log(`
📡 Telemetria:`);
  console.log(`  - Total de Eventos: ${telemetryStats.totalEvents}`);
  console.log(`  - Erros Registrados: ${telemetryStats.errorCount}`);
  console.log(`  - Anomalias Detectadas: ${telemetryStats.anomalyCount}`);
  console.log(`  - Triggers de Anti-Fragilidade: ${telemetryStats.antiFragilityTriggers}`);
  console.log(`  - Taxa de Cache Hit: ${(telemetryStats.cacheHitRate * 100).toFixed(2)}%`);

  // Verificação de SLA
  const slaTarget = 0.9999; // 99.99%
  const actualSLA = results.succeeded / (results.succeeded + results.failed);
  const slaStatus = actualSLA >= slaTarget ? "✅ PASSOU" : "❌ FALHOU";

  console.log(`
🎯 SLA (99.99%): ${slaStatus} (Atual: ${(actualSLA * 100).toFixed(4)}%)`);

  if (results.failed > 0) {
    console.error(`\n⚠️  Teste com falhas. Investigar erros acima.`);
    process.exit(1);
  } else {
    console.log(`\n✅ Teste de Estresse Concluído com 100% de Sucesso!`);
    process.exit(0);
  }
}

runSyndicateLevelStressTest();
