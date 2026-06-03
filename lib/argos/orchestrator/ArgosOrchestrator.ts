import { createClient } from "@supabase/supabase-js";
import { ArgosUnifiedEngine, MatchContextInput, MarketVertical } from "@/lib/ArgosUnifiedEngine";

// ============================================================
// ARGOS ORCHESTRATOR v4.0
// Ensemble Control • Drift Aware • Calibration Layer
// Stateless Core + Stateful Intelligence Layer
// ============================================================

/**
 * PESOS DINÂMICOS DO ENSEMBLE
 * (serão ajustados pelo learning loop futuramente)
 */
const MODEL_WEIGHTS = {
  BASE: 0.55,
  CONSERVATIVE: 0.30,
  AGGRESSIVE: 0.15
} as const;

type ModelType = keyof typeof MODEL_WEIGHTS;

interface OrchestrationResult {
  match_id: string;
  engine_version: string;
  fingerprint: string;
  signals_found: number;
  approved_markets: any[];
  total_exposure: number;
  drift_score: number;
  confidence_score: number;
  analyzed_at: string;
}

// ============================================================
// DRIFT TRACKING (SIMPLIFICADO INICIAL)
// ============================================================
function computeDrift(signals: any[]): number {
  if (!signals.length) return 0;

  const evs = signals.map(s => s.economicEV);
  const avg = evs.reduce((a, b) => a + b, 0) / evs.length;

  const variance =
    evs.reduce((acc, v) => acc + Math.pow(v - avg, 2), 0) / evs.length;

  // normalização simples
  return Math.min(1, Math.sqrt(variance));
}

// ============================================================
// CALIBRATION SCORE
// ============================================================
function computeConfidence(signals: any[]): number {
  if (!signals.length) return 0;

  const evSum = signals.reduce((acc, s) => acc + s.economicEV, 0);
  const avgEV = evSum / signals.length;

  // penaliza EV muito disperso ou baixo
  const stability = 1 - computeDrift(signals);

  return Math.max(0, Math.min(1, avgEV * 5 * stability));
}

// ============================================================
// ENSEMBLE FUSION (SEM RECOMPUTE DO CORE)
// ============================================================
function fuseEnsemble(signals: any[]): any[] {
  const grouped: Record<string, any[]> = {};

  for (const s of signals) {
    const key = `${s.vertical}:${s.market}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(s);
  }

  const output: any[] = [];

  for (const key in grouped) {
    const list = grouped[key];

    let weightedEV = 0;
    let weightSum = 0;

    for (const s of list) {
      const model = (s.model ?? "BASE") as ModelType;
      const w = MODEL_WEIGHTS[model] ?? 0.5;

      weightedEV += s.economicEV * w;
      weightSum += w;
    }

    const base = list[0];

    output.push({
      ...base,
      economicEV: weightedEV / weightSum,
      modelConsensusSize: list.length
    });
  }

  return output;
}

// ============================================================
// FINAL PORTFOLIO SELECTION
// ============================================================
function buildPortfolio(signals: any[]) {
  const sorted = [...signals].sort((a, b) => b.economicEV - a.economicEV);

  const selected: any[] = [];
  const exposureByVertical: Record<string, number> = {};

  let totalExposure = 0;

  for (const s of sorted) {
    const v = s.vertical;

    if (!exposureByVertical[v]) exposureByVertical[v] = 0;
    if (exposureByVertical[v] >= 4) continue;

    const baseSize =
      s.economicEV > 0.07 ? 1.0 :
      s.economicEV > 0.03 ? 0.5 : 0.25;

    const unit = baseSize * 0.12;

    if (totalExposure + unit > 2.5) continue;

    selected.push({
      ...s,
      unitSize: Number(unit.toFixed(4))
    });

    exposureByVertical[v]++;
    totalExposure += unit;
  }

  return selected;
}

// ============================================================
// ORCHESTRATOR
// ============================================================
export class ArgosOrchestrator {
  private supabase;

  constructor() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    this.supabase = createClient(url, key);
  }

  // ========================================================
  // MAIN PIPELINE
  // ========================================================
  async analyze(input: MatchContextInput): Promise<OrchestrationResult> {
    const start = Date.now();

    // 1. CORE ENGINE (single execution only)
    const coreOutput = ArgosUnifiedEngine.analyze(input);

    const baseSignals = coreOutput.approved_markets ?? [];

    // 2. ENSEMBLE TAGGING (sem recalcular core)
    const expanded = baseSignals.flatMap((s: any) => ([
      { ...s, model: "BASE" },
      { ...s, model: "CONSERVATIVE" },
      { ...s, model: "AGGRESSIVE" }
    ]));

    // 3. CONSENSUS FUSION
    const fused = fuseEnsemble(expanded);

    // 4. DRIFT + CALIBRATION
    const drift = computeDrift(fused);
    const confidence = computeConfidence(fused);

    // 5. FINAL PORTFOLIO
    const portfolio = buildPortfolio(fused);

    const totalExposure = portfolio.reduce((a, b) => a + (b.unitSize || 0), 0);

    // 6. PERSISTÊNCIA (SINGLE WRITE)
    await this.supabase.from("argos_processed_signals").upsert({
      match_id: input.matchId,
      league_id: input.leagueId,
      engine_version: "v4.0_orchestrated",
      fingerprint: coreOutput.fingerprint,
      signals_found: portfolio.length,
      approved_markets: portfolio,
      total_exposure: totalExposure,
      drift_score: drift,
      confidence_score: confidence,
      analyzed_at: new Date().toISOString()
    });

    // 7. OUTPUT FINAL
    return {
      match_id: input.matchId,
      engine_version: "v4.0_orchestrated",
      fingerprint: coreOutput.fingerprint,
      signals_found: portfolio.length,
      approved_markets: portfolio,
      total_exposure: Number(totalExposure.toFixed(4)),
      drift_score: Number(drift.toFixed(4)),
      confidence_score: Number(confidence.toFixed(4)),
      analyzed_at: new Date().toISOString()
    };
  }
}
