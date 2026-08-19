import { NextResponse } from "next/server";
import { getSupabaseClient } from "@/lib/core/SupabaseClient";
import { verifySignalProvenance, SignalProvenanceSnapshot } from "@/lib/argos/provenance/SignalProvenance";

/**
 * ARGOS v6.5 — PROVENANCE REPLAY
 * Verifies that a published signal's immutable snapshot still hashes to the
 * ledger value. This is an audit/reproducibility endpoint, not a prediction
 * endpoint and never recalculates a signal's probability or EV.
 */
export async function GET(req: Request) {
  const key = req.headers.get("x-api-key") || new URL(req.url).searchParams.get("key");
  if (key !== process.env.ARGOS_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const signalId = new URL(req.url).searchParams.get("signalId");
  if (!signalId) {
    return NextResponse.json({ error: "signalId is required" }, { status: 400 });
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from("argos_signal_ledger")
      .select("id, provenance_hash, provenance_snapshot, model_version, analysis_timestamp")
      .eq("id", signalId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Signal not found" }, { status: 404 });
    if (!data.provenance_snapshot || !data.provenance_hash) {
      return NextResponse.json({
        signalId,
        replayable: false,
        reason: "PROVENANCE_NOT_AVAILABLE",
      }, { status: 409 });
    }

    const replayable = verifySignalProvenance(
      data.provenance_snapshot as SignalProvenanceSnapshot,
      data.provenance_hash
    );

    return NextResponse.json({
      signalId,
      replayable,
      provenanceHash: data.provenance_hash,
      modelVersion: data.model_version,
      analysisTimestamp: data.analysis_timestamp,
      status: replayable ? "PROVENANCE_VERIFIED" : "PROVENANCE_MISMATCH",
    }, { status: replayable ? 200 : 409 });
  } catch (error: any) {
    console.error("[ReplaySignal] Error:", error.message);
    return NextResponse.json({ error: "Replay verification failed" }, { status: 500 });
  }
}
