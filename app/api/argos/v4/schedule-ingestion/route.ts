import { NextResponse } from "next/server";
import { DailyIngestionScheduler } from "@/lib/argos/ingestion/DailyIngestionScheduler";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Endpoint para disparar a curadoria diária de jogos (Fase 5)
 */
export async function GET(request: Request) {
  try {
    // 1. Segurança: Validar x-api-key (Necessário para Vercel Cron)
    const authHeader = request.headers.get("Authorization");
    const apiKey = request.headers.get("x-api-key") || (authHeader ? authHeader.replace("Bearer ", "") : null);
    
    if (!apiKey || apiKey !== process.env.ARGOS_API_KEY) {
      return NextResponse.json({ error: "Unauthorized: Invalid API Key" }, { status: 401 });
    }

    // 2. Otimização: O Scheduler já possui lógica de isAlreadyEnqueued
    // para evitar consultas redundantes no Supabase/API Football.
    const scheduler = new DailyIngestionScheduler();
    const result = await scheduler.scheduleDailyIngestion();

    return NextResponse.json({
      ...result,
      timestamp: new Date().toISOString(),
      status: "SUCCESS"
    });
  } catch (error: any) {
    console.error("[Schedule Ingestion API] Error:", error.message);
    return NextResponse.json({ status: "FAILED", error: error.message }, { status: 500 });
  }
}
