import { NextResponse } from "next/server";
import { ArgosOrchestrator } from "../../../lib/argos/orchestrator/ArgosOrchestrator";

/**
 * ORCHESTRATE API ROUTE
 * Interface de entrada para o motor de orquestração Argos
 * Rota otimizada para ingestão direta e processamento de sinal
 */

export async function GET() {
  return NextResponse.json({ 
    status: "ok",
    version: "4.0",
    engine: "ArgosUnifiedEngine" 
  });
}

export async function POST(req: Request) {
  try {
    // Parsing otimizado do payload de entrada
    const body = await req.json();

    if (!body || !body.matchId) {
      return NextResponse.json(
        { error: "Invalid payload: matchId is required" }, 
        { status: 400 }
      );
    }

    // Instanciação e execução do orquestrador
    const orchestrator = new ArgosOrchestrator();
    const result = await orchestrator.analyze(body);

    // Retorno estruturado com alta performance
    return NextResponse.json(result, {
      headers: {
        "Content-Type": "application/json",
        "X-Engine-Version": "4.0_orchestrated"
      }
    });

  } catch (error: any) {
    console.error("Orchestration Error:", error);
    return NextResponse.json(
      { 
        error: "Orchestration process failed", 
        details: error.message 
      }, 
      { status: 500 }
    );
  }
}
