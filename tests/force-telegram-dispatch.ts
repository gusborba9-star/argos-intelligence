
import { TelegramDispatcher } from "../lib/argos/notifications/TelegramDispatcher";
import { MarketVertical } from "../lib/core/ArgosUnifiedEngine";
import { SignalType } from "../lib/core/SignalClassifierV4";

async function runTest() {
    console.log("🚀 Iniciando Teste de Disparo Forçado do Argos...");
    
    const dispatcher = new TelegramDispatcher();
    
    // Simulação de sinais que devem passar nos filtros
    const mockSignals = [
        {
            id: "test-vip-1",
            vertical: MarketVertical.GOALS,
            market: "OVER 2.5 GOALS",
            probability: 0.85,
            expectedValue: 0.15,
            odds: 1.95,
            status: "OPTIMIZED",
            signal_type: SignalType.VALUE,
            confidence_score: 0.90
        },
        {
            id: "test-free-1",
            vertical: MarketVertical.WINNER,
            market: "HOME WIN",
            probability: 0.75,
            expectedValue: -0.05,
            odds: 1.65,
            status: "HEDGED",
            signal_type: SignalType.VALIDATION,
            confidence_score: 0.85
        }
    ];

    const mockRegime = {
        regime: "AGGRESSIVE",
        confidence: 0.88,
        bias: "BULLISH",
        description: "Teste de Sistema Argos - Fluxo Operacional Validado"
    };

    console.log("📦 Despachando sinais de teste...");
    await dispatcher.dispatch(mockSignals as any, mockRegime);
    console.log("✅ Teste concluído. Verifique os canais do Telegram.");
}

runTest().catch(console.error);
