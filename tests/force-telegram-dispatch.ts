import { TelegramDispatcher } from "../lib/argos/notifications/TelegramDispatcher";
import { RegimeProfile } from "../lib/argos/regime/RegimeSchema";
import { MarketVertical } from "../lib/core/ArgosUnifiedEngine";

/**
 * SCRIPT DE TESTE FORÇADO v6.0.0 — SYNDICATE MASTER
 * Execução via ts-node para validação rápida de canais.
 */
async function runTest() {
    console.log("🚀 Iniciando Teste de Disparo Forçado do Argos v6.0.0...");
    
    const dispatcher = new TelegramDispatcher();
    
    const mockRegime: RegimeProfile = {
        regime: "STABLE" as any,
        confidence: 0.95,
        model_bias: 0,
        variance_multiplier: 1.0,
        reasoning_tags: ["MANUAL_TEST"],
        explanation: "Teste manual de despacho v6.0.0"
    };

    const mockSignals = [
        {
            id: "test-vip-manual",
            tier: "VIP",
            home_team: "Flamengo",
            away_team: "Palmeiras",
            vertical: MarketVertical.WINNER,
            selection: "HOME_WIN",
            line: 0,
            odd: 1.95,
            fairOdd: 1.80,
            edge: 0.08,
            probability: 0.55,
            confidence: 0.90,
            kellyCriterion: 0.04
        },
        {
            id: "test-free-manual",
            tier: "FREE",
            home_team: "Man City",
            away_team: "Liverpool",
            vertical: MarketVertical.GOALS,
            selection: "OVER",
            line: 2.5,
            odd: 1.75,
            fairOdd: 1.60,
            edge: 0.09,
            probability: 0.62,
            confidence: 0.92,
            kellyCriterion: 0.06
        }
    ];

    console.log("📦 Despachando sinais de teste v6.0.0...");
    await dispatcher.dispatch(mockSignals, mockRegime);
    console.log("✅ Teste concluído. Verifique os canais do Telegram.");
}

runTest().catch(console.error);
