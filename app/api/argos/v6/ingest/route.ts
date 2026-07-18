import { NextResponse } from "next/server";
import { DailyIngestionScheduler } from "@/lib/argos/ingestion/DailyIngestionScheduler";

/**
 * ARGOS v6.0.0 — DISCOVERY & INGESTION
 * Endpoint acionado por CRON para descobrir e enfileirar jogos de elite.
 */
export async function GET(req: Request) {
  try {
    // Proteção básica via API Key (opcional, mas recomendada)
    const { searchParams } = new URL(req.url);
    const key = searchParams.get("key");
    if (key !== process.env.PROPLINE_API_KEY) {
      // return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const scheduler = new DailyIngestionScheduler();
    const result = await scheduler.scheduleDailyIngestion();

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[Ingest-v6] Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
