import { NextResponse } from "next/server";
import { telegramDispatcher } from "@/lib/argos/notifications/TelegramDispatcher";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = request.headers.get("x-argos-key");
  if (auth !== process.env.ARGOS_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const testSignals = [
      {
        matchName: "TESTE DE SISTEMA | Argos v6.1.1",
        leagueName: "Pipeline Validation League",
        kickoffTime: new Date().toISOString(),
        vertical: "WINNER",
        selection: "Argos Intelligence",
        odd: 2.50,
        fairOdd: 1.80,
        expectedValue: 0.38,
        probability: 0.85,
        kellyCriterion: 0.15,
        ratingLabel: "ELITE",
        analysisSummary: "Este é um sinal de teste gerado para validar o pipeline completo (Ingestão -> Engine -> Telegram). Se você está vendo isso, o despacho está FUNCIONANDO.",
        tier: "FREE" as const
      },
      {
        matchName: "TESTE VIP | Argos v6.1.1",
        leagueName: "Pipeline Validation League",
        kickoffTime: new Date().toISOString(),
        vertical: "GOALS",
        selection: "Over 2.5 Goals",
        odd: 2.10,
        fairOdd: 1.60,
        expectedValue: 0.31,
        probability: 0.75,
        kellyCriterion: 0.12,
        ratingLabel: "ELITE",
        analysisSummary: "Validação do canal VIP. Pipeline Syndicate Master Edition operando em regime de alta performance.",
        tier: "VIP" as const
      }
    ];

    await telegramDispatcher.dispatch(testSignals);

    return NextResponse.json({
      status: "success",
      message: "Sinais de teste disparados para os canais FREE e VIP",
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
