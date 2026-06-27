import { TelegramDispatcher, TelegramSignalPayload } from "../lib/argos/notifications/TelegramDispatcher";
import { MarketVertical } from "../lib/core/ArgosUnifiedEngine";
import { RegimeProfile, MarketRegime } from "../lib/argos/regime/RegimeSchema";

/**
 * SCRIPT DE TESTE FORÇADO v6.1.0 — SYNDICATE MASTER
 * Execução via ts-node para validação rápida de canais.
 */
async function runTest() {
    console.log("🚀 Iniciando Teste de Disparo Forçado do Argos v6.1.0...");
    
    const dispatcher = new TelegramDispatcher();
    
    const mockRegime: RegimeProfile = {
        regime: MarketRegime.NORMAL,
        confidence: 0.95,
        model_bias: 0,
        variance_multiplier: 1.0,
        reasoning_tags: ["MANUAL_TEST"],
        explanation: "Teste manual de despacho v6.1.0"
    };

    const mockSignals: TelegramSignalPayload[] = [
        {
            matchName: "Flamengo vs Palmeiras",
            leagueName: "Brasileirão",
            kickoffTime: new Date().toISOString(),
            vertical: MarketVertical.WINNER,
            selection: "Flamengo",
            odd: 1.95,
            fairOdd: 1.80,
            expectedValue: 0.08,
            probability: 0.55,
            kellyCriterion: 0.04,
            ratingLabel: "VALUE",
            tier: "VIP",
            analysisSummary: "Duelo de elite com valor no mandante."
        },
        {
            matchName: "Man City vs Liverpool",
            leagueName: "Premier League",
            kickoffTime: new Date().toISOString(),
            vertical: MarketVertical.GOALS,
            selection: "Over 2.5",
            odd: 1.75,
            fairOdd: 1.60,
            expectedValue: 0.09,
            probability: 0.62,
            tier: "FREE",
            analysisSummary: "Alta probabilidade de gols em jogo aberto."
        }
    ];

    console.log("📦 Despachando sinais de teste v6.1.0...");
    await dispatcher.dispatch(mockSignals, mockRegime);
    console.log("✅ Teste concluído. Verifique os canais do Telegram.");
}

runTest().catch(console.error);
