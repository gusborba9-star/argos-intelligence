import {
  ArgosUnifiedEngine,
  MatchContextInput
} from "./core/ArgosUnifiedEngine";
// ============================================================
// SCRIPT DE SIMULAÇÃO OPERACIONAL (SANDBOX DE TESTE)
// ============================================================

function executarSimulacao() {
  console.log("🚀 [TEST-ARGOS] Iniciando varredura de teste no motor v3.1...\n");

  // Cenário 1: Jogo do Brasileirão (Deve aplicar redução em gols)
  const jogoBrasil: MatchContextInput = {
    matchId: "MOCK_FLAMENGO_PALMEIRAS",
    leagueId: "BRASILEIRAO",
    winnerMatrix: {
      home: { label: "HOME_WIN", probability: 0.45, impliedOdds: 2.10 },
      away: { label: "AWAY_WIN", probability: 0.28, impliedOdds: 3.40 }
    },
    goalsMatrix: {
      over: { label: "OVER_2_5", probability: 0.55, impliedOdds: 1.95 } // EV Inicial Positivo
    },
    cardsMatrix: {},
    cornersMatrix: {}
  };

  // Cenário 2: Jogo da Libertadores (Deve aplicar ganho em cartões)
  const jogoLiberta: MatchContextInput = {
    matchId: "MOCK_BOCA_RIVER",
    leagueId: "LIBERTADORES",
    winnerMatrix: {},
    goalsMatrix: {},
    cardsMatrix: {
      over: { label: "CARDS_OVER_5_5", probability: 0.60, impliedOdds: 1.80 } // EV Inicial Positivo
    },
    cornersMatrix: {}
  };

  console.log("------------------------------------------------------------");
  console.log("⚙️ Executando Análise: Flamengo vs Palmeiras (Série A)");
  const resultadoBrasil = ArgosUnifiedEngine.analyze(jogoBrasil);
  console.log(JSON.stringify(resultadoBrasil, null, 2));

  console.log("\n------------------------------------------------------------");
  console.log("⚙️ Executando Análise: Boca Juniors vs River Plate (Libertadores)");
  const resultadoLiberta = ArgosUnifiedEngine.analyze(jogoLiberta);
  console.log(JSON.stringify(resultadoLiberta, null, 2));
  console.log("------------------------------------------------------------\n");
  
  console.log("🎯 [TEST-ARGOS] Simulação finalizada com sucesso.");
}

// Executa a simulação se disparado diretamente
executarSimulacao();
