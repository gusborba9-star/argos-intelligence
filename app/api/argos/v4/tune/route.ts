import { NextResponse } from "next/server";
import { AutoTuningEngine } from "@/lib/core/AutoTuningEngine";
import { MarketRegime } from "@/lib/argos/regime/RegimeSchema";

// ============================================================
// ARGOS API v4.3 — AUTO-TUNING ENDPOINT
// Endpoint para consulta de ajustes autônomos de modelo
// ============================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const leagueId = searchParams.get("leagueId");
    const regime = searchParams.get("regime");

    if (!leagueId || !regime) {
      return NextResponse.json({ error: "Parâmetros leagueId e regime são obrigatórios." }, { status: 400 });
    }

    const tuner = new AutoTuningEngine();
    const tuningResult = await tuner.tuneRegimeParameters(leagueId, regime as MarketRegime);

    return NextResponse.json(tuningResult);
  } catch (error: any) {
    console.error("[Argos API v4.3] Tuning Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
