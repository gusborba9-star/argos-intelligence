import { NextResponse } from "next/server";
import { DailyIngestionScheduler } from "@/lib/argos/ingestion/DailyIngestionScheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Endpoint para disparar a curadoria diária de jogos (Fase 5)
 */
export async function GET(request: Request) {
  try {
    const apiKey = request.headers.get("x-api-key");
    if (!apiKey || apiKey !== process.env.ARGOS_API_KEY) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const scheduler = new DailyIngestionScheduler();
    const result = await scheduler.scheduleDailyIngestion();

    return NextResponse.json({
      status: "SUCCESS",
      ...result
    });
  } catch (error: any) {
    console.error("[Schedule Ingestion API] Error:", error.message);
    return NextResponse.json({ status: "FAILED", error: error.message }, { status: 500 });
  }
}
