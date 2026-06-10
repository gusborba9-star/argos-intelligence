import { ArgosOrchestratorV4 } from "./argos/orchestrator/ArgosOrchestratorV4";
import dotenv from "dotenv";

// ============================================================
// ARGOS STRESS TEST v4.5
// Simula 50 requisições simultâneas para validar escalabilidade
// ============================================================

dotenv.config();

async function runStressTest() {
  const orchestrator = new ArgosOrchestratorV4();
  const CONCURRENT_REQUESTS = 50;
  const matchId = "test_match_stress_" + Date.now();
  const verticals = ["WINNER", "GOALS", "CORNERS", "CARDS", "BTTS"];

  console.log(`🚀 Iniciando Teste de Estresse: ${CONCURRENT_REQUESTS} requisições simultâneas...`);
  const startTime = Date.now();

  const requests = Array.from({ length: CONCURRENT_REQUESTS }).map((_, i) => {
    // Simulamos diferentes jogos ou o mesmo jogo para testar o cache
    const id = i % 5 === 0 ? matchId : `${matchId}_${i}`;
    return orchestrator.runZeroTouchAudit(id, verticals);
  });

  const results = await Promise.allSettled(requests);

  const succeeded = results.filter(r => r.status === "fulfilled").length;
  const failed = results.filter(r => r.status === "rejected").length;
  const totalTime = Date.now() - startTime;

  console.log("\n--- RESULTADOS DO TESTE DE ESTRESSE ---");
  console.log(`Sucessos: ${succeeded}`);
  console.log(`Falhas: ${failed}`);
  console.log(`Tempo Total: ${totalTime}ms`);
  console.log(`Média por Requisição: ${(totalTime / CONCURRENT_REQUESTS).toFixed(2)}ms`);
  console.log("---------------------------------------\n");

  if (failed > 0) {
    console.error("❌ Teste falhou: Houve erros durante o processamento simultâneo.");
    process.exit(1);
  } else {
    console.log("✅ Teste concluído com 100% de consistência!");
    process.exit(0);
  }
}

runStressTest();
