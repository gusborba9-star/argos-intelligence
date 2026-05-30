import { NextResponse } from "next/server";
import { ArgosUnifiedEngine, MatchContextInput } from "@/lib/ArgosUnifiedEngine";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ScenarioMetrics {
  approvedMarkets: number;
  vetoedMarkets: number;
  profitableOpportunities: number;
  submarketOpportunities: number;
}

interface ScenarioAudit {
  scenarioId: string;
  status: "SUCCESS" | "FAILED";
  executionTimeMs: number;
  error?: string;
}

// ============================================================
// HANDLER DEFINTIVO (SUPORTA POST COM DADOS REAIS OU FALLBACK DE TESTE)
// ============================================================

export async function POST(request: Request) {
  const startedAt = Date.now();
  const audits: ScenarioAudit[] = [];

  const metrics: ScenarioMetrics = {
    approvedMarkets: 0,
    vetoedMarkets: 0,
    profitableOpportunities: 0,
    submarketOpportunities: 0
  };

  try {
    // 1. Captura o payload real enviado. Se vier vazio, o bloco catch interno assume o controle
    let payload: MatchContextInput;
    try {
      payload = await request.json();
    } catch {
      throw new Error("Payload JSON invalido ou ausente no corpo da requisicao POST.");
    }

    const t0 = Date.now();
    
    // 2. Executa a análise profunda através do motor matemático estático
    const output = ArgosUnifiedEngine.analyze(payload);

    // 3. Processamento de Métricas Operacionais de Sucesso
    const approved = output.approved_markets ?? [];
    
    audits.push({
      scenarioId: payload.matchId,
      status: "SUCCESS",
      executionTimeMs: Date.now() - t0
    });

    return NextResponse.json({
      status: "success",
      environment: "vercel-nodejs",
      execution: {
        totalExecutionTimeMs: Date.now() - startedAt,
        auditFailures: 0
      },
      analysis: output,
      internalAudit: audits
    }, { status: 200 });

  } catch (fatal: any) {
    const message = fatal instanceof Error ? fatal.message : "UNKNOWN_FATAL_ERROR";

    return NextResponse.json(
      {
        status: "failed",
        error: message,
        executionTimeMs: Date.now() - startedAt
      },
      { status: 400 } // Retorna Bad Request para o script de automação saber que enviou dados inválidos
    );
  }
}
