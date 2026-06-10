import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const diagnostics: any = {
    env: {
      hasUrl: !!supabaseUrl,
      hasServiceKey: !!supabaseKey,
      hasAnonKey: !!anonKey,
      url: supabaseUrl ? `${supabaseUrl.substring(0, 15)}...` : "MISSING",
      keyPrefix: supabaseKey ? `${supabaseKey.substring(0, 10)}...` : "MISSING",
    },
    tests: {}
  };

  try {
    if (!supabaseUrl || !supabaseKey) {
      throw new Error("Variáveis de ambiente do Supabase ausentes.");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Teste 1: Conectividade Simples (Health Check)
    const startTime = Date.now();
    const { data: health, error: healthError } = await supabase
      .from("argos_signal_ledger")
      .select("count", { count: "exact", head: true });

    diagnostics.tests.connection = {
      status: healthError ? "FAILED" : "SUCCESS",
      time: `${Date.now() - startTime}ms`,
      error: healthError ? {
        message: healthError.message,
        code: healthError.code,
        details: healthError.details,
        hint: healthError.hint
      } : null
    };

    // Teste 2: Escrita (Dry Run / Rollback se possível, mas aqui apenas tentamos uma inserção de teste)
    const { error: writeError } = await supabase
      .from("argos_signal_ledger")
      .insert({
        match_id: "debug_test",
        signal_type: "NOISE",
        vertical: "WINNER",
        market: "DEBUG",
        probability: 0,
        expected_value: 0,
        regime: "DEBUG",
        confidence: 0,
        created_at: new Date().toISOString()
      });

    diagnostics.tests.write = {
      status: writeError ? "FAILED" : "SUCCESS",
      error: writeError ? {
        message: writeError.message,
        code: writeError.code,
        details: writeError.details,
        hint: writeError.hint
      } : null
    };

    return NextResponse.json(diagnostics);

  } catch (error: any) {
    return NextResponse.json({
      status: "CRITICAL_FAILURE",
      error: error.message,
      diagnostics
    }, { status: 500 });
  }
}
