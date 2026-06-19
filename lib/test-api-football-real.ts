// ============================================================
// REAL API FOOTBALL TEST v1.2
// Valida a ingestão de dados reais em tempo real (LIVE)
// ============================================================

import { DataIngestionService } from "./core/DataIngestionService";
import { FeatureEngine } from "./core/FeatureEngine";
import dotenv from "dotenv";

dotenv.config();

async function testRealApiFootball() {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║     ARGOS v7.0 — REAL API FOOTBALL TEST (LIVE)            ║
║     Validando dados reais em tempo real                    ║
╚════════════════════════════════════════════════════════════╝
  `);

  const ingestionService = new DataIngestionService();
  
  try {
    // Usar o ID do jogo live encontrado via curl: Fortaleza EC vs America Mineiro
    const targetMatchId = "1520725";
    console.log(`\n🚀 Iniciando ingestão completa para o jogo LIVE ID: ${targetMatchId}...`);
    
    const ingestedData = await ingestionService.ingest(targetMatchId, true);
    const features = FeatureEngine.generateFeatureVector(ingestedData);
    
    console.log(`✅ Ingestão Concluída com Sucesso!`);
    console.log(`📊 Métricas Ingeridas (via FeatureEngine):`);
    console.log(`   - Home (xG): ${features.homeMetrics.goals.toFixed(2)}`);
    console.log(`   - Away (xG): ${features.awayMetrics.goals.toFixed(2)}`);
    console.log(`   - Referee Strictness: ${features.externalFactors.refereeStrictness}`);
    console.log(`   - League ID: ${ingestedData.leagueId}`);
    
    console.log(`\n✅ Teste de API Football Real Finalizado.`);
  } catch (error: any) {
    console.error(`\n❌ Erro no teste de API Real:`, error.message);
  }
}

testRealApiFootball();
