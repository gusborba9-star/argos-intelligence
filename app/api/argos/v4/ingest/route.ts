import { NextResponse } from "next/server";
import { PropLineIngestionWorker } from "@/lib/workers/PropLineIngestionWorker";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ARGOS V4 INGEST ENDPOINT
 * - dispara worker real
 * - usado por cron (Supabase ou externo)
 * - protegido por API KEY
 */
export async function GET(request: Request) {
  const start = Date.now();

  // AUTH CHECK (crítico para cron e ReqBin)
  const auth = request.headers.get("x-argos-key");

  if (auth !== process.env.ARGOS_API_KEY) {
    return NextResponse.json(
      { error: "Unauthorized: Missing authentication" },
      { status: 401 }
    );
  }

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
