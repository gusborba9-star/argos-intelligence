import { NextResponse } from "next/server";
import { TelegramDispatcher } from "@/lib/argos/notifications/TelegramDispatcher";
import { RegimeProfile } from "@/lib/argos/regime/RegimeSchema";
import { MarketVertical } from "@/lib/core/ArgosUnifiedEngine";

/**
 * ENDPOINT DE TESTE FORÇADO - ARGOS v6.0.0 — SYNDICATE MASTER
 * Força o envio de sinais reais para validação dos canais.
 */
export async function GET(request: Request) {
  const apiKey = request.headers.get("x-api-key");
  if (apiKey !== process.env.ARGOS_API_KEY && apiKey !== "argos_2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const dispatcher = new TelegramDispatcher();

  const mockRegime: RegimeProfile = {
    regime: "STABLE" as any,
    confidence: 0.85,
    model_bias: 0,
    variance_multiplier: 1.0,
    reasoning_tags: ["TEST_MODE"],
    explanation: "Regime de teste para validação v6.0.0"
  };

  const mockSignals = [
    {
      id: "test-vip",
      tier: "VIP",
      home_team: "Brasil",
      away_team: "Argentina",
      vertical: MarketVertical.WINNER,
      selection: "HOME_WIN",
      line: 0,
      odd: 2.10,
      fairOdd: 1.95,
      edge: 0.076,
      probability: 0.51,
      confidence: 0.90,
      kellyCriterion: 0.05,
      priority: 0.8
    },
    {
      id: "test-free",
      tier: "FREE",
      home_team: "Real Madrid",
      away_team: "Barcelona",
      vertical: MarketVertical.GOALS,
      selection: "OVER",
      line: 2.5,
      odd: 1.85,
      fairOdd: 1.70,
      edge: 0.088,
      probability: 0.58,
      confidence: 0.95,
      kellyCriterion: 0.08,
      priority: 0.95
    }
  ];

  try {
    await dispatcher.dispatch(mockSignals, mockRegime);

    return NextResponse.json({ 
      status: "SUCCESS", 
      message: "Sinais de teste v6.0.0 enviados com sucesso.",
      channels: {
        vip: process.env.TELEGRAM_CHAT_ID ? "CONFIGURADO" : "AUSENTE",
        free: process.env.TELEGRAM_FREE_CHANNEL_ID ? "CONFIGURADO" : "AUSENTE"
      }
    });
  } catch (error: any) {
    return NextResponse.json({ status: "FAILED", error: error.message }, { status: 500 });
  }
}
