
import { ArgosUnifiedEngine, MarketVertical } from "../core/ArgosUnifiedEngine";
import { ContextualFactorsEngine, ContextualFactors } from "../core/ContextualFactorsEngine";

async function runDeepAnalysis() {
    console.log("=== ARGOS DEEP ANALYSIS - 06/2026 ===");

    // JOGO 1: BRASILEIRÃO SÉRIE B - Fortaleza x América-MG (18/06/2026)
    // Contexto: Série B, Arena Castelão, briga pelo G4.
    const jogo1Context: ContextualFactors = {
        motivationFactor: ContextualFactorsEngine.calculateMotivationFactor(false, 3, 1, 75), // Início/Meio de campeonato, briga G4
        isLifeOrDeathMatch: false,
        keyInjuriesCount: 2,
        injuryImpactFactor: 0.93,
        startingLineupStrength: 0.95,
        headToHeadWinRate: 0.55,
        homeAdvantageMultiplier: 1.15, // Castelão lotado
        weatherCondition: "clear",
        weatherImpactFactor: 1.0,
        humidity: 70,
        recentFormFactor: 1.1, // Fortaleza vem bem
        consecutiveWins: 2,
        consecutiveLosses: 0,
        pressureFactor: 1.05,
        crowdEffect: 1.1
    };

    // JOGO 2: COPA DO MUNDO - Portugal x RD Congo (17/06/2026)
    // Contexto: Estreia na Copa, última Copa do CR7, pressão máxima.
    const jogo2Context: ContextualFactors = {
        motivationFactor: 1.25, // Estreia em Copa
        isLifeOrDeathMatch: true, // Copa é sempre alta pressão
        keyInjuriesCount: 0,
        injuryImpactFactor: 1.0,
        startingLineupStrength: 1.1,
        headToHeadWinRate: 0.9, // Portugal muito superior
        homeAdvantageMultiplier: 1.0, // Campo neutro (Houston)
        weatherCondition: "extreme", // Calor de Houston em Junho
        weatherImpactFactor: 0.85,
        humidity: 80,
        recentFormFactor: 1.2,
        consecutiveWins: 4,
        consecutiveLosses: 0,
        pressureFactor: 1.2,
        crowdEffect: 1.0
    };

    // JOGO 3: PLAYOFF LIGA PORTUGAL (Decisão) - Farense x Belenenses (Final Playoff)
    // Contexto: Decisão de acesso/manutenção. Tensão total.
    const jogo3Context: ContextualFactors = {
        motivationFactor: 1.3, // Jogo do ano
        isLifeOrDeathMatch: true,
        keyInjuriesCount: 1,
        injuryImpactFactor: 0.95,
        startingLineupStrength: 1.0,
        headToHeadWinRate: 0.5,
        homeAdvantageMultiplier: 1.2, // Estádio do Algarve sob pressão
        weatherCondition: "rainy", // Previsão de chuva
        weatherImpactFactor: 0.9,
        humidity: 85,
        recentFormFactor: 0.8, // Farense vem de derrotas
        consecutiveWins: 0,
        consecutiveLosses: 3,
        pressureFactor: 1.25,
        crowdEffect: 1.1
    };

    const jogos = [
        { name: "Fortaleza x América-MG (Série B)", context: jogo1Context, type: "SERIE_B" },
        { name: "Portugal x RD Congo (Copa do Mundo)", context: jogo2Context, type: "WORLD_CUP" },
        { name: "Farense x Belenenses (Playoff Decisão)", context: jogo3Context, type: "DECISION" }
    ];

    jogos.forEach(jogo => {
        console.log(`\nAnalisando: ${jogo.name}`);
        const multiplier = ContextualFactorsEngine.calculateTotalContextualMultiplier(jogo.context);
        console.log(`Multiplicador Contextual: ${multiplier.toFixed(2)}`);

        // Simulação de Matrizes Realistas
        let homeProb = 0.45;
        let drawProb = 0.25;
        let homeOdds = 1.95;
        let drawOdds = 3.40;
        let awayOdds = 4.50;

        if (jogo.type === "WORLD_CUP") {
            homeProb = 0.75; // Portugal favorito
            homeOdds = 1.30;
            drawOdds = 5.50;
            awayOdds = 12.00;
        } else if (jogo.type === "DECISION") {
            homeProb = 0.40; // Equilíbrio total
            homeOdds = 2.40;
            drawOdds = 3.10;
            awayOdds = 3.10;
        }

        const adjustedHomeProb = Math.min(0.95, homeProb * multiplier);
        const analysisInput = {
            matchId: jogo.name,
            winnerMatrix: {
                home: { label: "Home", probability: adjustedHomeProb, impliedOdds: homeOdds },
                draw: { label: "Draw", probability: drawProb, impliedOdds: drawOdds },
                away: { label: "Away", probability: Math.max(0.05, 1 - adjustedHomeProb - drawProb), impliedOdds: awayOdds }
            },
            goalsMatrix: {
                over25: { label: "Over 2.5", probability: 0.52 * multiplier, impliedOdds: 2.10 }
            },
            cardsMatrix: {
                over45: { label: "Over 4.5 Cards", probability: (jogo.type === "DECISION" ? 0.65 : 0.35) * multiplier, impliedOdds: 1.85 }
            },
            cornersMatrix: {
                over95: { label: "Over 9.5 Corners", probability: 0.55, impliedOdds: 1.90 }
            }
        };

        const result = ArgosUnifiedEngine.analyze(analysisInput);
        
        console.log(`Sinais Encontrados: ${result.signals_found}`);
        result.approved_markets.forEach((sig: any) => {
            const isVIP = sig.ev > 0.08 && sig.adjustedProbability > 0.6;
            console.log(`- Mercado: ${sig.market} | EV: ${(sig.ev * 100).toFixed(2)}% | Prob: ${(sig.adjustedProbability * 100).toFixed(2)}% | TIER: ${isVIP ? "VIP" : "FREE"}`);
        });

        if (result.approved_markets.length === 0 || !result.approved_markets.some((s:any) => s.ev > 0.08)) {
            console.log("STATUS: Sem Oportunidade VIP (Baixa confiança ou EV insuficiente)");
        }
    });
}

runDeepAnalysis();
