import { NextResponse } from 'next/server';
import { RAGContextEngine } from '@/lib/argos/regime/RAGContextEngine';
import { RegimeEngineV4 } from '@/lib/argos/regime/RegimeEngineV4';
import { ModelFactory } from '@/lib/core/ModelFactory';
import { ArgosOrchestratorV4 } from '@/lib/argos/orchestrator/ArgosOrchestratorV4';

// ============================================================
// ARGOS v4.0 — UNIFIED API ROUTE (VERCEL COMPATIBLE)
// Consolidando MCP e Orchestrator em um único endpoint
// ============================================================

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, payload } = body;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const googleKey = process.env.GOOGLE_API_KEY!;

    // Instanciar engines
    const ragEngine = new RAGContextEngine(supabaseUrl, supabaseKey, googleKey);
    const regimeEngine = new RegimeEngineV4(googleKey);
    const orchestrator = new ArgosOrchestratorV4(`https://${req.headers.get('host')}/api/argos/v4`);

    switch (action) {
      case 'audit':
        // Executa o pipeline completo v4.0
        const auditResult = await orchestrator.runAudit(payload);
        return NextResponse.json(auditResult);

      case 'retrieve_context':
        const context = await ragEngine.retrieveContext(payload.matchId, payload.leagueId);
        return NextResponse.json({ context_evidence: JSON.stringify(context) });

      case 'classify_regime':
        const regime = await regimeEngine.analyze(payload);
        return NextResponse.json(regime);

      case 'run_monte_carlo':
        const mc = ModelFactory.runMonteCarlo(payload.baseOutput, payload.iterations, payload.varianceMultiplier);
        return NextResponse.json(mc);

      default:
        return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Argos API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
