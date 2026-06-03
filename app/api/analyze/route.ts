import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ArgosOrchestrator } from "../../../lib/argos/orchestrator/ArgosOrchestrator";


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

export async function POST(request: Request) {
  const startedAt = Date.now();
  const audits: ScenarioAudit[] = [];

  try {
    let payload: MatchContextInput;

    try {
      payload = await request.json();
    } catch {
      throw new Error("Payload JSON invalido ou ausente no corpo da requisicao POST.");
    }

    const t0 = Date.now();

    // 1. ENGINE
    const output = ArgosUnifiedEngine.analyze(payload);
    const approved = output.approved_markets ?? [];

    // 2. SUPABASE INIT (SINGLE SOURCE OF TRUTH)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Variáveis de ambiente do Supabase ausentes.");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // 3. PERSISTÊNCIA (ÚNICA)
    await supabase
      .from("argos_processed_signals")
      .upsert(
        {
          match_id: payload.matchId,
          league_id: payload.leagueId,
          engine_version: "v1",
          fingerprint: output.fingerprint ?? `${payload.matchId}-v1`,
          signals_found: approved.length,
          total_exposure: output.total_exposure ?? 0,
          approved_markets: approved,
          analyzed_at: new Date().toISOString()
        },
        {
          onConflict: "match_id,fingerprint"
        }
      );

    // 4. AUDIT
    audits.push({
      scenarioId: payload.matchId,
      status: "SUCCESS",
      executionTimeMs: Date.now() - t0
    });

    // 5. RESPONSE
    return NextResponse.json(
      {
        status: "success",
        environment: "vercel-nodejs",
        execution: {
          totalExecutionTimeMs: Date.now() - startedAt,
          auditFailures: 0
        },
        analysis: output,
        internalAudit: audits
      },
      { status: 200 }
    );

  } catch (fatal: any) {
    return NextResponse.json(
      {
        status: "failed",
        error: fatal instanceof Error ? fatal.message : "UNKNOWN_FATAL_ERROR",
        executionTimeMs: Date.now() - startedAt
      },
      { status: 400 }
    );
  }
}
