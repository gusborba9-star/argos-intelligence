import { NextResponse } from "next/server";
import { PropLineIngestionWorker } from "@/lib/workers/PropLineIngestionWorker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ARGOS V4 INGEST ENDPOINT
 * - dispara worker real
 * - usado por cron (Supabase ou externo)
 * - não depende de estado externo
 */
export async function GET() {
  const start = Date.now();

  try {
    const worker = new PropLineIngestionWorker();

    await worker.run();

    return NextResponse.json({
      status: "success",
      layer: "argos-v4-ingestion",
      executionTimeMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Argos V4 Ingest] Fatal error:", error?.message);

    return NextResponse.json(
      {
        status: "error",
        message: error?.message || "unknown_error",
      },
      { status: 500 }
    );
  }
}
