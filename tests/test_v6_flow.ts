import { ArgosMasterOrchestrator } from "../lib/argos/orchestrator/ArgosMasterOrchestrator";

// Mock de payload da PropLine para teste
const mockRawData = {
  id: "test_match_123",
  home_team: "Flamengo",
  away_team: "Palmeiras",
  commence_time: new Date(Date.now() + 3600000).toISOString(),
  league_id: 71,
  sport_title: "Brazil - Serie A",
  bookmakers: [
    {
      key: "pinnacle",
      title: "Pinnacle",
      markets: [
        {
          key: "h2h",
          outcomes: [
            { name: "Home", price: 2.10 },
            { name: "Draw", price: 3.40 },
            { name: "Away", price: 3.80 }
          ]
        },
        {
          key: "totals",
          outcomes: [
            { name: "Over", price: 1.95, point: 2.5 },
            { name: "Under", price: 1.95, point: 2.5 }
          ]
        }
      ]
    }
  ]
};

async function test() {
  console.log("🧪 Iniciando teste do Fluxo Mestre Argos v6...");
  try {
    const result = await ArgosMasterOrchestrator.run("test_match_123", mockRawData);
    console.log("✅ Resultado do Teste:", JSON.stringify(result, null, 2));
  } catch (error: any) {
    console.error("❌ Erro no Teste:", error.message);
  }
}

test();
