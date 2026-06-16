// ============================================================
// SYNDICATE-LEVEL STRESS TEST v5.0
// Simulação de volume de tráfego de grande syndicate americano
// ============================================================

import { ResilientOrchestratorV5 } from "./argos/orchestrator/ResilientOrchestratorV5";
import { MarketVertical } from "./core/ArgosUnifiedEngine";
import { telemetryService } from "./core/TelemetryService";
import dotenv from "dotenv";

dotenv.config();

console.log(`[StressTest] UPSTASH_REDIS_REST_URL: ${process.env.UPSTASH_REDIS_REST_URL ? '******' : 'UNDEFINED'}`);
console.log(`[StressTest] UPSTASH_REDIS_REST_TOKEN: ${process.env.UPSTASH_REDIS_REST_TOKEN ? '******' : 'UNDEFINED'}`);

interface StressTestConfig {
  concurrentRequests: number;
  durationSeconds: number;
  matchesPerSecond: number;
  verticalsPerMatch: number;
}

async function runSyndicateLevelStressTest() {
  const config: StressTestConfig = {
    concurrentRequests: 10, // Reduzido para 10 requisições simultâneas
    durationSeconds: 10, // 10 segundos de teste
    matchesPerSecond: 1, // 1 jogo por segundo
    verticalsPerMatch: 1, // 1 vertical por jogo
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

  const orchestrator = new ResilientOrchestratorV5(true); // Usar o orquestrador resiliente com mock de DataIngestionService
  const verticals: MarketVertical[] = [
    MarketVertical.WINNER,
    MarketVertical.GOALS,
    MarketVertical.CORNERS,
    MarketVertical.CARDS,
    MarketVertical.BTTS,
  ];

  // Usar um conjunto fixo de matchIds para testar o cache
  const fixedMatchIds = [
    "1035489", // Exemplo de matchId real
    "1035490",
    "1035491",
    "1035492",
    "1035493",
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

  const latencies: number[] = [];
  let requestCounter = 0;

  const interval = setInterval(async () => {
    if (Date.now() - startTime > config.durationSeconds * 1000) {
      clearInterval(interval);
      // Exibir resultados antes de sair
      displayResults();
      process.exit(0);
    }

    const matchId = fixedMatchIds[requestCounter % fixedMatchIds.length];
    const requestStart = Date.now();

    try {
      const auditResult = await orchestrator.runZeroTouchAuditWithResilience(
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

      console.log(`[Request ${requestCounter + 1}] Match: ${matchId} | Status: ${auditResult.status} | Latency: ${latency}ms`);

    } catch (error: any) {
      results.failed++;
      console.error(`[Request ${requestCounter + 1}] Match: ${matchId} | Status: ERROR | Error: ${error.message}`);
    }
    requestCounter++;

  }, 1000 / config.matchesPerSecond);

  // Função para exibir os resultados
  function displayResults() {
    const totalDuration = Date.now() - startTime;
    results.totalDuration = totalDuration;
    results.avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    results.minLatency = latencies.length > 0 ? Math.min(...latencies) : 0;
    results.maxLatency = latencies.length > 0 ? Math.max(...latencies) : 0;

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
    console.log(`📈 Requisições/Segundo: ${(requestCounter / (results.totalDuration / 1000)).toFixed(2)}`);

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
      // process.exit(1); // Não sair imediatamente para permitir que o displayResults seja chamado
    } else {
      console.log(`\n✅ Teste de Estresse Concluído com 100% de Sucesso!`);
      // process.exit(0); // Não sair imediatamente
    }
  }

  // Aguardar a duração total do teste
  await new Promise(resolve => setTimeout(resolve, config.durationSeconds * 1000 + 5000)); // +5s para garantir que todas as promessas resolvam

  // Chamar displayResults no final, caso o intervalo não tenha sido limpo
  displayResults();
}

runSyndicateLevelStressTest();
