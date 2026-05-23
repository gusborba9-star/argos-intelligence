import crypto from "crypto";

// ============================================================
// L0 — CONSTANTES FUNDAMENTAIS (IMMUTABLE CORE)
// ============================================================

export const BASE_MIN_EDGE = 0.055;
export const SUBMARKET_HUNT_DISCOUNT = 0.82;
export const MAX_CLUSTER_EXPOSURE = 1.5;
export const TOP_K_PER_VERTICAL = 2;
export const GLOBAL_QUANT_SCALE = 0.28;
export const KELLY_FRACTION = 0.25;

export const MIN_IMPLIED_PROBABILITY = 0.04;
export const MAX_IMPLIED_PROBABILITY = 0.96;

// ============================================================
// L0.1 — BIAS HISTÓRICO FIXO (NÃO ADAPTATIVO EM RUNTIME)
// ============================================================

export const HISTORICAL_VERTICAL_BIAS: Record<MarketVertical, number> = {
  WINNER: 0.0,
  GOALS: -0.022,
  CARDS: 0.012,
  CORNERS: -0.01
};

// ============================================================
// L0.2 — DRIFT OBSERVER (READ-ONLY SAFE, SEM IMPACTO NO CORE)
// ============================================================

export class DriftMonitor {
  private static mean = 0;
  private static m2 = 0;
  private static n = 0;

  public static update(edge: number): void {
    this.n++;
    const delta = edge - this.mean;
    this.mean += delta / this.n;
    const delta2 = edge - this.mean;
    this.m2 += delta * delta2;
  }

  public static getDriftScore(): number {
    if (this.n < 15) return 0;

    const variance = this.m2 / Math.max(1, this.n);
    const std = Math.sqrt(Math.abs(variance));

    // clamp rígido evita degradação de score em alta volatilidade estrutural
    return Math.min(0.12, std * 0.18);
  }
}

// ============================================================
// L0.3 — NORMALIZADOR GLOBAL (ANTI-COLAPSO NUMÉRICO)
// ============================================================

export class GlobalEdgeNormalizer {
  private static baseline = 1.0;

  public static update(rawEdge: number): void {
    const signal = Math.min(5, Math.abs(rawEdge)); // anti-explosão
    this.baseline = this.baseline * 0.995 + signal * 0.005;
  }

  public static normalize(edge: number): number {
    const safe = Math.max(0.5, this.baseline);
    const normalized = edge / safe;

    // clamp estatístico final (proteção contra outliers extremos)
    return Math.max(-5, Math.min(5, normalized));
  }
}

// ============================================================
// L0.4 — MEMÓRIA ADAPTATIVA SEGURA (SHARDED + SERVERLESS SAFE)
// ============================================================

interface EdgeMemoryRecord {
  market: string;
  vertical: MarketVertical;
  edge: number;
  realizedEdge?: number;
  error: number;
  timestamp: number;
}

// SHARDING SIMPLES → evita hot map único global
const MEMORY_SHARDS: Map<number, Map<string, EdgeMemoryRecord[]>> = new Map();

function getShard(market: string): Map<string, EdgeMemoryRecord[]> {
  const shardId = Math.abs(hashString(market)) % 16;

  if (!MEMORY_SHARDS.has(shardId)) {
    MEMORY_SHARDS.set(shardId, new Map());
  }

  return MEMORY_SHARDS.get(shardId)!;
}

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return h;
}

export class EdgeMemoryStore {
  private static total = 0;
  private static readonly MAX = 30000;
  private static readonly TTL = 7 * 86400000;

  public static push(r: EdgeMemoryRecord): void {
    const shard = getShard(r.market);

    if (!shard.has(r.market)) shard.set(r.market, []);
    shard.get(r.market)!.push(r);

    this.total++;
    if (this.total > this.MAX) this.prune();
  }

  public static getBiasAdjustment(market: string): number {
    const shard = getShard(market);
    const arr = shard.get(market);
    if (!arr?.length) return 0;

    const now = Date.now();

    let sum = 0;
    let count = 0;

    // O(n local shard, nunca global)
    for (const r of arr) {
      if (now - r.timestamp < this.TTL) {
        sum += r.error;
        count++;
      }
    }

    if (!count) return 0;

    const avg = sum / count;
    return Math.max(-0.03, Math.min(0.03, avg * 0.35));
  }

  public static registerOutcome(
    market: string,
    predictedEdge: number,
    realizedEdge: number,
    vertical: MarketVertical
  ): void {
    const error = realizedEdge - predictedEdge;

    this.push({
      market,
      vertical,
      edge: predictedEdge,
      realizedEdge,
      error,
      timestamp: Date.now()
    });

    DriftMonitor.update(predictedEdge);
    GlobalEdgeNormalizer.update(predictedEdge);
  }

  private static prune(): void {
    const now = Date.now();

    for (const shard of MEMORY_SHARDS.values()) {
      for (const [k, v] of shard.entries()) {
        const filtered = v.filter(x => now - x.timestamp < this.TTL);
        if (filtered.length) shard.set(k, filtered);
        else shard.delete(k);
      }
    }

    this.total = 0;
    for (const shard of MEMORY_SHARDS.values()) {
      for (const v of shard.values()) {
        this.total += v.length;
      }
    }
  }
}

// ============================================================
// TIPOS (CONTRATO ESTÁVEL)
// ============================================================

export type MarketVertical = "WINNER" | "GOALS" | "CARDS" | "CORNERS";
export type AllocationTier = "ELITE" | "TACTICAL" | "MICRO" | "FULL_VETO";

export interface MarketProbability {
  label: string;
  probability: number;
  impliedOdds: number;
}

export interface MatchContextInput {
  matchId: string;
  leagueId?: string;
  winnerMatrix: any;
  goalsMatrix: any;
  cardsMatrix: any;
  cornersMatrix: any;
}

export interface RawSignal {
  vertical: MarketVertical;
  market: string;
  probability: number;
  probabilityAdjusted: number;
  impliedOdds: number;
  impliedProbability: number;
  edge: number;
  expectedValue: number;
  sigma: number;
}

export interface ApprovedMarket extends RawSignal {
  edgeQualityScore: number;
  allocationTier: AllocationTier;
  unitSize: number;
  confidence: number;
  kelly: number;
}

export interface PredictionAuditOutput {
  match_id: string;
  prediction_hash: string;
  model_version: string;
  allocation_state: {
    total_approved_markets: number;
    highest_detected_edge: number;
    highest_edge_quality_score: number;
    total_unit_exposure: number;
  };
  approvedMarkets: ApprovedMarket[];
  created_at: string;
}

// ============================================================
// L1 — CANONICALIZATION (DETERMINISTIC SAFE)
// ============================================================

function canonicalMarketVector(input: any): MarketProbability[] {
  if (!input || typeof input !== "object") return [];

  const out: MarketProbability[] = [];

  for (const v of Object.values(input)) {
    if (!v || typeof v !== "object") continue;

    const p = (v as any).probability;
    const o = (v as any).impliedOdds;
    const l = (v as any).label;

    if (typeof p !== "number" || typeof o !== "number") continue;

    out.push({
      label: String(l ?? "UNKNOWN"),
      probability: Math.min(0.99, Math.max(0.01, p)),
      impliedOdds: Math.max(1.01, o)
    });
  }

  return out.sort((a, b) => a.label.localeCompare(b.label));
}

// ============================================================
// L2 — HASH DETERMINISTIC
// ============================================================

function generateDeterministicHash(
  matchId: string,
  leagueId: string | undefined,
  winner: MarketProbability[],
  goals: MarketProbability[],
  cards: MarketProbability[],
  corners: MarketProbability[]
): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ matchId, leagueId, winner, goals, cards, corners }))
    .digest("hex");
}

// ============================================================
// L3 — EDGE ENGINE (STABLE + SAFE)
// ============================================================

function computeEdge(modelProb: number, impliedProb: number, bias: number) {
  const adjusted = Math.min(
    MAX_IMPLIED_PROBABILITY,
    Math.max(MIN_IMPLIED_PROBABILITY, modelProb - bias)
  );

  const sigma = Math.max(0.04, Math.sqrt(impliedProb * (1 - impliedProb)));

  const raw = (adjusted - impliedProb) / sigma;

  const edge = GlobalEdgeNormalizer.normalize(raw);

  return { edge, sigma, adjustedProb: adjusted };
}

// ============================================================
// L4 — EXTRACTION
// ============================================================

function extractSignals(
  vertical: MarketVertical,
  markets: MarketProbability[],
  pool: RawSignal[]
): void {
  const bias = HISTORICAL_VERTICAL_BIAS[vertical];

  for (const m of markets) {
    const implied = Math.max(
      MIN_IMPLIED_PROBABILITY,
      Math.min(MAX_IMPLIED_PROBABILITY, 1 / m.impliedOdds)
    );

    const memoryBias = EdgeMemoryStore.getBiasAdjustment(m.label);

    const { edge, sigma, adjustedProb } = computeEdge(
      m.probability,
      implied,
      bias + memoryBias
    );

    pool.push({
      vertical,
      market: m.label,
      probability: m.probability,
      probabilityAdjusted: adjustedProb,
      impliedOdds: m.impliedOdds,
      impliedProbability: implied,
      edge,
      expectedValue: edge * sigma,
      sigma
    });
  }
}

// ============================================================
// L5 — KELLY
// ============================================================

function computeKelly(p: number, odds: number): number {
  const b = odds - 1;
  if (b <= 0) return 0;

  const k = ((p * b - (1 - p)) / b) * KELLY_FRACTION;
  return Math.max(0, Math.min(KELLY_FRACTION, k));
}

// ============================================================
// L6 — RANKING (DRIFT SAFE)
// ============================================================

function rankSignals(signals: RawSignal[]): ApprovedMarket[] {
  const drift = DriftMonitor.getDriftScore();

  return signals
    .map(s => {
      const confidence = Math.tanh(Math.abs(s.edge));

      const score =
        s.edge * 0.5 +
        s.expectedValue * 0.3 +
        confidence * 0.2 -
        drift;

      const eqs = Math.tanh(score / GLOBAL_QUANT_SCALE);

      let tier: AllocationTier = "MICRO";
      let unit = 0.25;

      if (eqs > 0.7) {
        tier = "ELITE";
        unit = 1;
      } else if (eqs > 0.4) {
        tier = "TACTICAL";
        unit = 0.5;
      }

      return {
        ...s,
        edgeQualityScore: Number(eqs.toFixed(6)),
        allocationTier: tier,
        unitSize: unit,
        confidence: Number(confidence.toFixed(6)),
        kelly: computeKelly(s.probabilityAdjusted, s.impliedOdds)
      };
    })
    .filter(s => s.edgeQualityScore > 0.2)
    .sort((a, b) => b.edgeQualityScore - a.edgeQualityScore);
}

// ============================================================
// L7 — LIMITADOR DE EXPOSIÇÃO (SAFE)
// ============================================================

function limitExposure(markets: ApprovedMarket[]): ApprovedMarket[] {
  const out: ApprovedMarket[] = [];
  let exposure = 0;

  for (const m of markets) {
    if (exposure + m.unitSize > MAX_CLUSTER_EXPOSURE) continue;
    out.push(m);
    exposure += m.unitSize;
  }

  return out;
}

// ============================================================
// 🚀 ORQUESTRADOR FINAL (PRODUCTION HARDENED)
// ============================================================

export class OpusCoreBrain {
  private readonly MODEL_VERSION = "ARGOS_CORE_v13_PROD_HARDENED";

  public analyzeMatch(input: MatchContextInput): PredictionAuditOutput {
    const winner = canonicalMarketVector(input.winnerMatrix);
    const goals = canonicalMarketVector(input.goalsMatrix);
    const cards = canonicalMarketVector(input.cardsMatrix);
    const corners = canonicalMarketVector(input.cornersMatrix);

    const signals: RawSignal[] = [];

    if (winner.length) extractSignals("WINNER", winner, signals);
    if (goals.length) extractSignals("GOALS", goals, signals);
    if (cards.length) extractSignals("CARDS", cards, signals);
    if (corners.length) extractSignals("CORNERS", corners, signals);

    const ranked = rankSignals(signals);
    const finalMarkets = limitExposure(ranked);

    // HARD SAFE GUARD (zero NaN / -Infinity / undefined propagation)
    const highestEdge =
      finalMarkets.length > 0
        ? Math.max(...finalMarkets.map(m => m.edge))
        : 0;

    const highestEQ =
      finalMarkets.length > 0
        ? Math.max(...finalMarkets.map(m => m.edgeQualityScore))
        : 0;

    const totalExposure = finalMarkets.reduce((a, b) => a + b.unitSize, 0);

    return {
      match_id: input.matchId,

      prediction_hash: generateDeterministicHash(
        input.matchId,
        input.leagueId,
        winner,
        goals,
        cards,
        corners
      ),

      model_version: this.MODEL_VERSION,

      allocation_state: {
        total_approved_markets: finalMarkets.length,
        highest_detected_edge: Number(highestEdge.toFixed(6)),
        highest_edge_quality_score: Number(highestEQ.toFixed(6)),
        total_unit_exposure: Number(totalExposure.toFixed(4))
      },

      approvedMarkets: finalMarkets,
      created_at: new Date().toISOString()
    };
  }

  public registerOutcomeFeedback(
    market: string,
    predictedEdge: number,
    realizedEdge: number,
    vertical: MarketVertical
  ): void {
    EdgeMemoryStore.registerOutcome(
      market,
      predictedEdge,
      realizedEdge,
      vertical
    );
  }
                    }
