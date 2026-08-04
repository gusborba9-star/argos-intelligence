import { NextResponse } from "next/server";
import { DailyIngestionScheduler } from "@/lib/argos/ingestion/DailyIngestionScheduler";

export const maxDuration = 60;

/**
 * ARGOS v6 — COLETA DE HISTÓRICO REAL
 * Separado da rota de ingest de propósito: antes competiam pelo mesmo
 * orçamento de tempo dentro do mesmo loop sequencial, e a coleta de
 * histórico nunca chegava a rodar (a rota estourava o timeout antes).
 */
export async function GET(req: Request) {
  const key = req.headers.get("x-api-key") || new URL(req.url).searchParams.get("key");
  if (key !== process.env.ARGOS_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const scheduler = new DailyIngestionScheduler();
    const result = await scheduler.collectHistoricalScores();
    return NextResponse.json({ status: "SUCCESS", ...result });
  } catch (error: any) {
    console.error("[CollectScores] Erro:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
