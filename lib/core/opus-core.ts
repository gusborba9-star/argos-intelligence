import crypto from "crypto";

/* =========================
   TIPOS BASE
========================= */

export type MarketVertical = "WINNER" | "GOALS" | "CARDS" | "CORNERS";

export type AllocationTier = "ELITE" | "TACTICAL" | "MICRO";

export interface MarketProbability {
  label: string;
  probability: number;
  impliedOdds: number;
}

export interface MatchContextInput {
  matchId: string;
  leagueId?: string;

  winnerMatrix: Record<string, MarketProbability>;
  goalsMatrix: Record<string, MarketProbability>;
  cardsMatrix: Record<string, MarketProbability>;
  cornersMatrix: Record<string, MarketProbability>;
}

export interface RawSignal {
  vertical: MarketVertical;
  market: string;

  probability: number;
  impliedProbability: number;

  edge: number;
  sigma: number;
}

export interface ApprovedMarket extends RawSignal {
  edgeQualityScore: number;
  allocationTier: AllocationTier;
  unitSize: number;
}

/* =========================
   CONSTANTES
========================= */

const MIN_P = 0.04;
const MAX_P = 0.96;

/* =========================
   DRIFT MONITOR (ISOLADO)
========================= */

class DriftMonitor {
  private static mean = 0;
  private static m2 = 0;
  private static n = 0;

  static update(x: number) {
    this.n++;
    const delta = x - this.mean;
    this.mean += delta / this.n;
    this.m2 += delta * (x - this.mean);
  }

  static score() {
    if (this.n < 10) return 0;
    const variance = this.m2 / this.n;
    return Math.min(0.1, Math.sqrt(Math.abs(variance)));
  }
}

/* =========================
   NORMALIZER
========================= */

class Normalizer {
  private static base = 1;

  static update(x: number) {
    this.base = this.base * 0.99 + Math.abs(x) * 0.01;
  }

  static norm(x: number) {
    return x / Math.max(0.5, this.base);
  }
}

/* =========================
   MEMORY (O(1))
========================= */

class Memory {
  private static map = new Map<string, number[]>();

  static bias(key: string) {
    const arr = this.map.get(key);
    if (!arr?.length) return 0;

    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    return Math.max(-0.02, Math.min(0.02, avg * 0.3));
  }

  static push(key: string, val: number) {
    if (!this.map.has(key)) this.map.set(key, []);
    this.map.get(key)!.push(val);
  }
}

/* =========================
   ENGINE CORE
========================= */

function clamp(p: number) {
  return Math.min(MAX_P, Math.max(MIN_P, p));
}

function edge(model: number, implied: number, bias: number) {
  const p = clamp(model - bias);
  const sigma = Math.sqrt(implied * (1 - implied)) || 0.1;
  const raw = (p - implied) / sigma;

  return Normalizer.norm(raw);
}

function buildSignals(
  vertical: MarketVertical,
  matrix: Record<string, MarketProbability>,
  out: RawSignal[]
) {
  const bias = 0;

  for (const m of Object.values(matrix)) {
    const implied = clamp(1 / m.impliedOdds);
    const mem = Memory.bias(m.label);

    const e = edge(m.probability, implied, bias + mem);

    out.push({
      vertical,
      market: m.label,
      probability: m.probability,
      impliedProbability: implied,
      edge: e,
      sigma: 0.1
    });
  }
}

function rank(signals: RawSignal[]): ApprovedMarket[] {
  const drift = DriftMonitor.score();

  return signals
    .map(s => {
      const score = s.edge - drift;
      const eq = Math.tanh(score);

      let tier: AllocationTier = "MICRO";
      let unit = 0.2;

      if (eq > 0.6) {
        tier = "ELITE";
        unit = 1;
      } else if (eq > 0.3) {
        tier = "TACTICAL";
        unit = 0.5;
      }

      return {
        ...s,
        edgeQualityScore: eq,
        allocationTier: tier,
        unitSize: unit
      };
    })
    .filter(s => s.edgeQualityScore > 0.15)
    .sort((a, b) => b.edgeQualityScore - a.edgeQualityScore);
}

/* =========================
   PUBLIC CORE
========================= */

export class OpusCoreBrain {
  analyzeMatch(input: MatchContextInput) {
    const signals: RawSignal[] = [];

    buildSignals("WINNER", input.winnerMatrix, signals);
    buildSignals("GOALS", input.goalsMatrix, signals);
    buildSignals("CARDS", input.cardsMatrix, signals);
    buildSignals("CORNERS", input.cornersMatrix, signals);

    const ranked = rank(signals);

    const highest = ranked.length
      ? Math.max(...ranked.map(r => r.edge))
      : 0;

    return {
      match_id: input.matchId,
      model_version: "opus-core-v1",
      approvedMarkets: ranked,
      allocation_state: {
        total: ranked.length,
        highest_edge: highest
      }
    };
  }
                    }
