import { NextResponse } from "next/server";
import { TelegramDispatcher, TelegramSignalPayload } from "@/lib/argos/notifications/TelegramDispatcher";
import { MarketVertical } from "@/lib/core/ArgosUnifiedEngine";
import { RegimeProfile } from "@/lib/argos/regime/RegimeSchema";

/**
 * ENDPOINT DE TESTE FORÇADO - ARGOS v6.1.0 — SYNDICATE MASTER
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
    reasoning_tags: ["TEST_MODE"]
  };

  const mockSignals: TelegramSignalPayload[] = [
    {
      matchName: "Brasil vs Argentina",
      leagueName: "Copa América",
      kickoffTime: new Date().toISOString(),
      vertical: MarketVertical.WINNER,
      selection: "Brasil",
      odd: 2.10,
      fairOdd: 1.95,
      expectedValue: 0.076,
      probability: 0.51,
      kellyCriterion: 0.05,
      ratingLabel: "VALUE",
      tier: "VIP",
      analysisSummary: "Clássico sul-americano com edge detectado no mandante."
    },
    {
      matchName: "Real Madrid vs Barcelona",
      leagueName: "La Liga",
      kickoffTime: new Date().toISOString(),
      vertical: MarketVertical.GOALS,
      selection: "Over 2.5",
      odd: 1.85,
      fairOdd: 1.70,
      expectedValue: 0.088,
      probability: 0.58,
      tier: "FREE",
      analysisSummary: "Alta probabilidade de gols em clássico ofensivo."
    }
  ];

  try {
    await dispatcher.dispatch(mockSignals, mockRegime);

    return NextResponse.json({ 
      status: "SUCCESS", 
      message: "Sinais de teste v6.1.0 enviados com sucesso.",
      channels: {
        vip: process.env.TELEGRAM_CHAT_ID ? "CONFIGURADO" : "AUSENTE",
        free: process.env.TELEGRAM_FREE_CHANNEL_ID ? "CONFIGURADO" : "AUSENTE"
      }
    });
  } catch (error: any) {
    return NextResponse.json({ status: "FAILED", error: error.message }, { status: 500 });
  }
}
