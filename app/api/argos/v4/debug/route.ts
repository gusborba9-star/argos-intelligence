import { NextResponse } from "next/server";
import { getSupabaseClient, getSanitizedSupabaseUrl } from "@/lib/core/SupabaseClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  const sanitizedUrl = rawUrl ? getSanitizedSupabaseUrl(rawUrl) : "MISSING";

  const diagnostics: any = {
    env: {
      hasUrl: !!rawUrl,
      hasServiceKey: !!supabaseKey,
      rawUrl: rawUrl ? `${rawUrl.substring(0, 20)}...` : "MISSING",
      sanitizedUrl: `${sanitizedUrl.substring(0, 20)}...`,
      isDifferent: rawUrl !== sanitizedUrl
    },
    tests: {}
  };

  try {
    const supabase = getSupabaseClient();

    // Teste 1: Conectividade Simples
    const startTime = Date.now();
    const { error: healthError } = await supabase
      .from("argos_signal_ledger")
      .select("count", { count: "exact", head: true });

    diagnostics.tests.connection = {
      status: healthError ? "FAILED" : "SUCCESS",
      time: `${Date.now() - startTime}ms`,
      error: healthError ? {
        message: healthError.message,
        code: healthError.code,
        details: healthError.details
      } : null
    };

    // Teste 2: Escrita de Debug
    const { error: writeError } = await supabase
      .from("argos_signal_ledger")
      .insert({
        match_id: "debug_test_v4.5.2",
        signal_type: "NOISE",
        vertical: "WINNER",
        market: "DEBUG_SANITIZED",
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
        details: writeError.details
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
