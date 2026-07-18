import { NextRequest, NextResponse } from "next/server";
import { ArgosMasterOrchestrator } from "@/lib/argos/orchestrator/ArgosMasterOrchestrator";

/**
 * ARGOS v6.0.0 — SYNDICATE MASTER API
 * Endpoint unificado para processamento de sinais via Single-Pass.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { matchId, rawData } = body;

    if (!matchId || !rawData) {
      return NextResponse.json({ error: "matchId and rawData are required" }, { status: 400 });
    }

    // Executa o Orquestrador Mestre
    const result = await ArgosMasterOrchestrator.run(matchId, rawData);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[API-v6] Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ 
    status: "ONLINE", 
    version: "6.0.0-MASTER",
    engine: "Syndicate Master Edition"
  });
}
