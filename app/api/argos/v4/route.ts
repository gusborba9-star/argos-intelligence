import { NextResponse } from "next/server";
import { ArgosOrchestratorV4, AuditPayload } from "@/lib/argos/orchestrator/ArgosOrchestratorV4";
import { RAGContextEngine } from "@/lib/argos/regime/RAGContextEngine";
import { RegimeEngineV4 } from "@/lib/argos/regime/RegimeEngineV4";
import { ModelFactory } from "@/lib/core/ModelFactory";

// ============================================================
// ARGOS API v4.2 — INDUSTRIAL AUDIT ENDPOINT
// Endpoint consolidado para auditoria massiva multi-vertical
// ============================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    
    // Se o payload tiver 'action', tratamos como chamada interna do Orchestrator (legado/modular)
    if (body.action) {
      const { action, payload } = body;
      const googleKey = process.env.GOOGLE_API_KEY!;
      
      switch (action) {
        case 'retrieve_context':
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
          const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
          const ragEngine = new RAGContextEngine(supabaseUrl, supabaseKey, googleKey);
          const context = await ragEngine.retrieveContext(payload.matchId);
          return NextResponse.json({ context_evidence: context });

        case 'classify_regime':
          const regimeEngine = new RegimeEngineV4(googleKey);
          const regime = await regimeEngine.analyze(payload);
          return NextResponse.json(regime);

        case 'run_monte_carlo':
          const mc = ModelFactory.runMonteCarlo(payload.metrics, payload.regime, payload.iterations, payload.marketType);
          return NextResponse.json(mc);
          
        default:
          return NextResponse.json({ error: "Ação modular inválida" }, { status: 400 });
      }
    }

    // Fluxo Principal v4.2: Auditoria Massiva Direta
    const payload: AuditPayload = body;
    if (!payload.matchId || !payload.requestedVerticals) {
      return NextResponse.json({ error: "Payload de auditoria inválido" }, { status: 400 });
    }

    const orchestrator = new ArgosOrchestratorV4();
    const result = await orchestrator.runAudit(payload);

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("[Argos API v4.2] Fatal Error:", error);
    return NextResponse.json({ 
      status: "FAILED", 
      error: error.message 
    }, { status: 500 });
  }
}
