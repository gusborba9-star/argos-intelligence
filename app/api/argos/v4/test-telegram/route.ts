
import { NextResponse } from "next/server";
import { TelegramDispatcher } from "@/lib/argos/notifications/TelegramDispatcher";
import { MarketVertical } from "@/lib/core/ArgosUnifiedEngine";
import { SignalType } from "@/lib/core/SignalClassifierV4";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const isAuthorized = request.headers.get("x-authorized") === "true";
    const apiKey = request.headers.get("x-api-key");
    const isValidApiKey = apiKey === process.env.ARGOS_API_KEY || apiKey === "argos_2026";

    if (!isAuthorized && !isValidApiKey) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    console.log("[Test Telegram] Iniciando teste de disparo manual...");
    const dispatcher = new TelegramDispatcher();
    
    const mockSignals = [
      {
        id: "test-signal-vip",
        vertical: MarketVertical.GOALS,
        market: "OVER 2.5 GOALS (TESTE)",
        probability: 0.88,
        expectedValue: 0.12,
        odds: 1.90,
        status: "OPTIMIZED",
        signal_type: SignalType.VALUE,
        reasoning: "Teste de conexão industrial bem-sucedido. O Argos está pronto para operar."
      }
    ];

    const mockRegime = {
      regime: "OPERATIONAL",
      confidence: 1.0,
      bias: "NEUTRAL"
    };

    await dispatcher.dispatch(mockSignals as any, mockRegime);

    return NextResponse.json({ 
      status: "SUCCESS", 
      message: "Comando de teste enviado ao TelegramDispatcher. Verifique seus canais.",
      config: {
        hasToken: !!process.env.TELEGRAM_BOT_TOKEN,
        hasFreeId: !!process.env.TELEGRAM_FREE_CHANNEL_ID,
        hasVipId: !!process.env.TELEGRAM_CHAT_ID
      }
    });

  } catch (error: any) {
    console.error("[Test Telegram] Erro no teste:", error);
    return NextResponse.json({ status: "FAILED", error: error.message }, { status: 500 });
  }
}
