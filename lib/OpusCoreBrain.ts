import crypto from "crypto";

// ============================================================
// L0 — CONSTANTES E PARÂMETROS INSTITUCIONAIS
// ============================================================

export const BASE_MIN_EDGE = 0.035;
export const SUBMARKET_HUNT_DISCOUNT = 0.72;
export const MAX_CLUSTER_EXPOSURE = 1.5;
export const TOP_K_PER_VERTICAL = 3;
export const GLOBAL_QUANT_SCALE = 0.15;
export const KELLY_FRACTION = 0.25;

// Hard institutional cap
export const MAX_EFFECTIVE_KELLY_POSITION = 0.08;

export const MIN_IMPLIED_PROBABILITY = 0.04;
export const MAX_IMPLIED_PROBABILITY = 0.96;

export const MARKET_STRUCTURAL_RELIABILITY: Record<MarketVertical, number> = {
  WINNER: 1.0,
  GOALS: 0.92,
  CARDS: 0.78,
  CORNERS: 0.70
};

export const HISTORICAL_VERTICAL_BIAS: Record<MarketVertical, number> = {
  WINNER: 0.0,
  GOALS: -0.022,
  CARDS: 0.012,
  CORNERS: -0.01
};

// ============================================================
// L0.1 — DRIFT MONITOR
// ============================================================

export class DriftMonitor {
  private static meanError = 0;
  private static m2Error = 0;
  private static directionalMisalignments = 0;
  private static n = 0;

  public static update(
    error: number,
    predictedEdge: number,
    realizedEdge: number
  ): void {
    this.n++;

    const delta = error - this.meanError;
    this.meanError += delta / this.n;

    const delta2 = error - this.meanError;
    this.m2Error += delta * delta2;

    if (
      (predictedEdge > 0 && realizedEdge <= 0) ||
      (predictedEdge < 0 && realizedEdge >= 0)
    ) {
      this.directionalMisalignments++;
    }
  }

  public static getDriftScore(): number {
    if (this.n < 15) return 0;

    const variance = this.m2Error / Math.max(1, this.n);
    const std = Math.sqrt(Math.abs(variance));
    const directionalRatio = this.directionalMisalignments / this.n;

    return Math.min(0.25, (std * 0.18) + (directionalRatio * 0.12));
  }

  public static getConfidenceMultiplier(): number {
    const drift = this.getDriftScore();
    return Math.max(0.75, 1 - drift * 0.5);
  }
}

// ============================================================
// L0.2 — MEMORY STORE
// ============================================================

interface EdgeMemoryRecord {
  market: string;
  vertical: MarketVertical;
  edge: number;
  realizedEdge?: number;
  error: number;
  timestamp: number;
}

const MEMORY_SHARDS: Map<number, Map<string, EdgeMemoryRecord[]>> = new Map();

function hashString(str: string): number {
  let h = 0;

  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }

  return h;
}

function getShard(market: string): Map<string, EdgeMemoryRecord[]> {
  const shardId = Math.abs(hashString(market)) % 16;

  if (!MEMORY_SHARDS.has(shardId)) {
    MEMORY_SHARDS.set(shardId, new Map());
  }

  return MEMORY_SHARDS.get(shardId)!;
}

export class EdgeMemoryStore {
  private static total = 0;
  private static readonly MAX = 30000;

  // ~8 dias meia vida
  private static readonly LAMBDA = 0.00000001157;

  public static push(record: EdgeMemoryRecord): void {
    const shard = getShard(record.market);

    if (!shard.has(record.market)) {
      shard.set(record.market, []);
    }

    shard.get(record.market)!.push(record);

    this.total++;

    if (this.total > this.MAX) {
      this.prune();
    }
  }

  public static getBiasAdjustment(market: string): number {
    const shard = getShard(market);
    const arr = shard.get(market);

    if (!arr?.length) return 0;

    const now = Date.now();

    let weightedSum = 0;
    let totalWeight = 0;

    for (const r of arr) {
      const age = now - r.timestamp;
      const weight = Math.exp(-this.LAMBDA * age);

      weightedSum += r.error * weight;
      totalWeight += weight;
    }

    if (totalWeight < 0.1) return 0;

    const avgWeightedError = weightedSum / totalWeight;

    return Math.max(-0.03, Math.min(0.03, avgWeightedError * 0.35));
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

    DriftMonitor.update(error, predictedEdge, realizedEdge);
  }

  private static prune(): void {
    const now = Date.now();
    const cutoff = 14 * 86400000;

    for (const shard of MEMORY_SHARDS.values()) {
      for (const [k, v] of shard.entries()) {
        const filtered = v.filter(x => now - x.timestamp < cutoff);

        if (filtered.length) shard.set(k, filtered);
        else shard.delete(k);
      }
    }

    this.total = 0;

    for (const shard of MEMORY_SHARDS.values()) {
      for (const arr of shard.values()) {
        this.total += arr.length;
      }
    }
  }
}

// ============================================================
// L0.3 — LATENT FACTORS
// ============================================================

export interface MarketLatentFactors {
  goalFactor: number;
  tempoFactor: number;
  aggressionFactor: number;
}

function clamp(min: number, v: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

function extractLineValue(label: string): number | null {
  const normalized = label.replace(",", ".");

  const match = normalized.match(/(\d+\.?\d*)/);

  if (!match) return null;

  return Number(match[1]);
}

function deriveLatentFactors(
  marketLabel: string,
  vertical: MarketVertical
): MarketLatentFactors {
  const label = marketLabel.toUpperCase();

  let goalFactor = 0;
  let tempoFactor = 0;
  let aggressionFactor = 0;

  const line = extractLineValue(label);

  if (vertical === "GOALS") {
    const isUnder =
      label.includes("UNDER") ||
      label.includes("MENOS") ||
      label.includes("BTTS_NO") ||
      label.includes("AMBAS_NAO");

    const magnitude = line
      ? clamp(0.25, 1.15 - line / 4.5, 0.95)
      : 0.75;

    goalFactor = isUnder ? -magnitude : magnitude;
    tempoFactor = isUnder ? -magnitude * 0.8 : magnitude * 0.8;
  }

  else if (vertical === "WINNER") {
    if (
      label === "X" ||
      label.includes("DRAW") ||
      label.includes("EMPATE")
    ) {
      goalFactor = -0.45;
      tempoFactor = -0.75;
    } else {
      goalFactor = 0.22;
      tempoFactor = 0.30;
    }
  }

  else if (vertical === "CARDS") {
    const isUnder =
      label.includes("UNDER") ||
      label.includes("MENOS");

    const magnitude = line
      ? clamp(0.20, line / 6.5, 0.95)
      : 0.70;

    aggressionFactor = isUnder ? -magnitude : magnitude;
    tempoFactor = isUnder ? 0.15 : -0.35;
  }

  else if (vertical === "CORNERS") {
    const isUnder =
      label.includes("UNDER") ||
      label.includes("MENOS");

    const magnitude = line
      ? clamp(0.20, line / 12.5, 0.90)
      : 0.60;

    tempoFactor = isUnder ? -magnitude : magnitude;
    goalFactor = isUnder ? -magnitude * 0.5 : magnitude * 0.5;
  }

  return {
    goalFactor,
    tempoFactor,
    aggressionFactor
  };
}

// ============================================================
// TYPES
// ============================================================

export type MarketVertical =
  | "WINNER"
  | "GOALS"
  | "CARDS"
  | "CORNERS";

export type AllocationTier =
  | "ELITE"
  | "TACTICAL"
  | "MICRO"
  | "FULL_VETO";

export type GameRegime =
  | "TRUNCATED"
  | "EXPLOSIVE"
  | "BALANCED";

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

  economicEV: number;
  statisticalEdge: number;
  normalizedEdgeScore: number;

  sigma: number;

  liquidityScore: number;
  latentFactors: MarketLatentFactors;
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
    detected_regime: GameRegime;
    regime_intensity: number;
    mean_absolute_edge: number;
  };

  approvedMarkets: ApprovedMarket[];
  created_at: string;
}
  // ============================================================
// L1 — CANONICALIZATION
// ============================================================

function canonicalMarketVector(input: any): MarketProbability[] {
  if (!input || typeof input !== "object") {
    return [];
  }

  const out: MarketProbability[] = [];

  for (const v of Object.values(input)) {
    if (!v || typeof v !== "object") continue;

    const p = (v as any).probability;
    const o = (v as any).impliedOdds;
    const l = (v as any).label;

    if (
      typeof p !== "number" ||
      typeof o !== "number"
    ) {
      continue;
    }

    out.push({
      label: String(l ?? "UNKNOWN"),
      probability: clamp(0.01, p, 0.99),
      impliedOdds: Math.max(1.01, o)
    });
  }

  return out.sort((a, b) => a.label.localeCompare(b.label));
}

// ============================================================
// L2 — HASH
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
    .update(
      JSON.stringify({
        matchId,
        leagueId,
        winner,
        goals,
        cards,
        corners
      })
    )
    .digest("hex");
}

// ============================================================
// L2.5 — REGIME DETECTOR
// ============================================================

interface RegimeAnalysisResult {
  regime: GameRegime;
  intensity: number;
}

function detectGameRegime(
  winnerMarkets: MarketProbability[],
  goalsMarkets: MarketProbability[],
  cardsMarkets: MarketProbability[],
  cornersMarkets: MarketProbability[]
): RegimeAnalysisResult {
  let under25Prob = 0.5;
  let over25Prob = 0.5;
  let bttsNoProb = 0.5;
  let drawProb = 0.33;
  let cardsIntensity = 0.5;
  let cornersIntensity = 0.5;

  const over25 = goalsMarkets.find(m =>
    m.label.toUpperCase().includes("OVER_25") ||
    m.label.toUpperCase().includes("OVER 2.5")
  );

  const under25 = goalsMarkets.find(m =>
    m.label.toUpperCase().includes("UNDER_25") ||
    m.label.toUpperCase().includes("UNDER 2.5")
  );

  if (over25) {
    over25Prob = over25.probability;
    under25Prob = 1 - over25Prob;
  }

  else if (under25) {
    under25Prob = under25.probability;
    over25Prob = 1 - under25Prob;
  }

  const bttsNo = goalsMarkets.find(m =>
    m.label.toUpperCase().includes("BTTS_NO") ||
    m.label.toUpperCase().includes("AMBAS_NAO")
  );

  const bttsYes = goalsMarkets.find(m =>
    m.label.toUpperCase().includes("BTTS_YES") ||
    m.label.toUpperCase().includes("AMBAS_SIM")
  );

  if (bttsNo) {
    bttsNoProb = bttsNo.probability;
  }

  else if (bttsYes) {
    bttsNoProb = 1 - bttsYes.probability;
  }

  const draw = winnerMarkets.find(m =>
    m.label.toUpperCase() === "X" ||
    m.label.toUpperCase() === "DRAW" ||
    m.label.toUpperCase() === "EMPATE"
  );

  if (draw) {
    drawProb = draw.probability;
  }

  const highCards = cardsMarkets.find(m =>
    m.label.toUpperCase().includes("OVER_45") ||
    m.label.toUpperCase().includes("OVER 4.5")
  );

  if (highCards) {
    cardsIntensity = highCards.probability;
  }

  const highCorners = cornersMarkets.find(m =>
    m.label.toUpperCase().includes("OVER_105") ||
    m.label.toUpperCase().includes("OVER 10.5")
  );

  if (highCorners) {
    cornersIntensity = highCorners.probability;
  }

  const truncationInteraction =
    under25Prob *
    bttsNoProb *
    drawProb;

  const truncationScore =
    under25Prob * 0.25 +
    bttsNoProb * 0.20 +
    drawProb * 0.15 +
    truncationInteraction * 0.30 +
    cardsIntensity * 0.10 -
    cornersIntensity * 0.10;

  if (truncationScore > 0.55) {
    const intensity = clamp(
      0,
      (truncationScore - 0.55) / 0.45,
      1
    );

    return {
      regime: "TRUNCATED",
      intensity
    };
  }

  if (over25Prob > 0.58 && truncationScore < 0.38) {
    const intensity = clamp(
      0,
      (0.38 - truncationScore) / 0.38,
      1
    );

    return {
      regime: "EXPLOSIVE",
      intensity
    };
  }

  return {
    regime: "BALANCED",
    intensity: 0
  };
}

// ============================================================
// L2.6 — MARKET EFFICIENCY CURVE
// ============================================================

function calculateMarketEfficiencyPenalty(
  impliedOdds: number
): number {
  const k = 0.8;
  const x0 = 4.5;
  const maxPenalty = 0.24;

  const sigmoid = 1 / (1 + Math.exp(-k * (impliedOdds - x0)));

  return sigmoid * maxPenalty;
}

// ============================================================
// L2.7 — LIQUIDITY MODEL
// ============================================================

function getLiquidityScore(
  vertical: MarketVertical,
  impliedOdds: number
): number {
  let base = 1;

  if (vertical === "GOALS") base = 0.92;
  if (vertical === "CARDS") base = 0.72;
  if (vertical === "CORNERS") base = 0.66;

  const oddsPenalty = clamp(
    0.70,
    1 - ((impliedOdds - 2) * 0.04),
    1
  );

  return clamp(0.35, base * oddsPenalty, 1);
}

// ============================================================
// L2.8 — SIGMA DECOMPOSITION
// ============================================================

function computeDecomposedSigma(
  impliedProb: number,
  vertical: MarketVertical,
  regimeIntensity: number
): number {
  const marketVariance = impliedProb * (1 - impliedProb);

  let modelVariance = 0.02;

  if (vertical === "CORNERS") modelVariance = 0.06;
  if (vertical === "CARDS") modelVariance = 0.08;

  const regimeVariance = 0.04 * regimeIntensity;

  const totalVariance =
    marketVariance +
    modelVariance +
    regimeVariance;

  return Math.max(0.04, Math.sqrt(totalVariance));
}

// ============================================================
// L3 — EDGE ENGINE
// ============================================================

function softsign(x: number): number {
  return x / (1 + Math.abs(x));
}

function computeInstitutionalEdge(
  modelProb: number,
  impliedProb: number,
  bias: number,
  impliedOdds: number,
  vertical: MarketVertical,
  regimeIntensity: number
) {
  const adjustedProb = clamp(
    MIN_IMPLIED_PROBABILITY,
    modelProb - bias,
    MAX_IMPLIED_PROBABILITY
  );

  const sigma = computeDecomposedSigma(
    impliedProb,
    vertical,
    regimeIntensity
  );

  const economicEV = adjustedProb * impliedOdds - 1;

  const statisticalEdge =
    (adjustedProb - impliedProb) / sigma;

  let normalizedEdgeScore = softsign(statisticalEdge * 0.45);

  const liquidityScore = getLiquidityScore(
    vertical,
    impliedOdds
  );

  const efficiencyPenalty = calculateMarketEfficiencyPenalty(
    impliedOdds
  );

  normalizedEdgeScore *= (1 - efficiencyPenalty);

  const calibratedEV = economicEV;

  return {
    adjustedProb,
    sigma,
    liquidityScore,
    economicEV: calibratedEV,
    statisticalEdge,
    normalizedEdgeScore
  };
}

// ============================================================
// L4 — SIGNAL EXTRACTION
// ============================================================

function extractSignals(
  vertical: MarketVertical,
  markets: MarketProbability[],
  regimeIntensity: number,
  pool: RawSignal[]
): void {
  const bias = HISTORICAL_VERTICAL_BIAS[vertical];

  for (const m of markets) {
    if (
      m.impliedOdds > 15 ||
      m.impliedOdds < 1.01
    ) {
      continue;
    }

    const impliedProbability = clamp(
      MIN_IMPLIED_PROBABILITY,
      1 / m.impliedOdds,
      MAX_IMPLIED_PROBABILITY
    );

    const memoryBias = EdgeMemoryStore.getBiasAdjustment(m.label);

    const {
      adjustedProb,
      sigma,
      liquidityScore,
      economicEV,
      statisticalEdge,
      normalizedEdgeScore
    } = computeInstitutionalEdge(
      m.probability,
      impliedProbability,
      bias + memoryBias,
      m.impliedOdds,
      vertical,
      regimeIntensity
    );

    const latentFactors = deriveLatentFactors(
      m.label,
      vertical
    );

    pool.push({
      vertical,
      market: m.label,
      probability: m.probability,
      probabilityAdjusted: adjustedProb,
      impliedOdds: m.impliedOdds,
      impliedProbability,
      economicEV,
      statisticalEdge,
      normalizedEdgeScore,
      sigma,
      liquidityScore,
      latentFactors
    });
  }
               
}
  // ============================================================
// L5 — KELLY
// ============================================================

function computeKelly(
  probability: number,
  odds: number
): number {
  const b = odds - 1;

  if (b <= 0) return 0;

  const k = (
    (probability * b - (1 - probability)) / b
  ) * KELLY_FRACTION;

  return clamp(0, k, KELLY_FRACTION);
}

// ============================================================
// L6 — RANKING
// ============================================================

export const MIN_EDGE_SCORE: Record<MarketVertical, number> = {
  WINNER: 0.06,
  GOALS: 0.025,
  CARDS: 0.02,
  CORNERS: 0.015
};

function rankSignals(
  signals: RawSignal[],
  regimeInfo: RegimeAnalysisResult
): ApprovedMarket[] {
  const driftMultiplier = DriftMonitor.getConfidenceMultiplier();

  return signals
    .map(signal => {
      let regimeMultiplier = 1;

      if (
        regimeInfo.regime === "TRUNCATED" &&
        signal.latentFactors.goalFactor < 0
      ) {
        regimeMultiplier =
          1 + regimeInfo.intensity * 0.35;
      }

      else if (
        regimeInfo.regime === "EXPLOSIVE" &&
        signal.latentFactors.goalFactor > 0
      ) {
        regimeMultiplier =
          1 + regimeInfo.intensity * 0.35;
      }

      const confidenceBase = Math.tanh(
        Math.abs(signal.normalizedEdgeScore)
      );

      const confidence = confidenceBase;

      const score = (
        Math.max(0, signal.normalizedEdgeScore) * 0.40 +
        Math.max(0, signal.economicEV) * 0.40 +
        confidence * 0.20
      ) * regimeMultiplier;

      let eqs = softsign(score / GLOBAL_QUANT_SCALE);

      eqs *= MARKET_STRUCTURAL_RELIABILITY[signal.vertical];
      eqs *= driftMultiplier;

      const kelly = computeKelly(
        signal.probabilityAdjusted,
        signal.impliedOdds
      );

      let tier: AllocationTier = "MICRO";
      let unit = 0.06;

      if (eqs > 0.60) {
        tier = "ELITE";
        unit = 1.0;
      }

      else if (eqs > 0.32) {
        tier = "TACTICAL";
        unit = 0.5;
      }

      return {
        ...signal,
        edgeQualityScore: Number(eqs.toFixed(6)),
        allocationTier: tier,
        unitSize: unit,
        confidence: Number(confidence.toFixed(6)),
        kelly
      };
    })

    .filter(signal =>
  signal.economicEV > 0 &&
  signal.edgeQualityScore > MIN_EDGE_SCORE[signal.vertical] * 0.65
)

    .sort((a, b) =>
      b.edgeQualityScore - a.edgeQualityScore
    );
}

// ============================================================
// L6.5 — VECTORIAL CORRELATION
// ============================================================

function getVectorialCorrelationPenalty(
  marketA: ApprovedMarket,
  marketB: ApprovedMarket
): number {
  if (
    marketA.market === marketB.market &&
    marketA.vertical === marketB.vertical
  ) {
    return 0;
  }

  const fA = marketA.latentFactors;
  const fB = marketB.latentFactors;

  const dotProduct =
    (fA.goalFactor * fB.goalFactor) +
    (fA.tempoFactor * fB.tempoFactor) +
    (fA.aggressionFactor * fB.aggressionFactor);

  if (dotProduct > 0.28) {
    return Math.min(0.45, dotProduct * 0.38);
  }

  return 0;
}

// ============================================================
// L7 — MARKET SELECTION
// ============================================================

function selectMarkets(
  markets: ApprovedMarket[]
): ApprovedMarket[] {
  const selected: ApprovedMarket[] = [];

  let exposure = 0;

  const verticalCounts: Record<MarketVertical, number> = {
    WINNER: 0,
    GOALS: 0,
    CARDS: 0,
    CORNERS: 0
  };

  const driftMultiplier = DriftMonitor.getConfidenceMultiplier();

  for (const layer of [1, 2]) {
    for (const market of markets) {
      if (
        selected.some(
          s =>
            s.market === market.market &&
            s.vertical === market.vertical
        )
      ) {
      continue;
      }

      let maxCorrelationRisk = 0;

      for (const selectedMarket of selected) {
        const penalty = getVectorialCorrelationPenalty(
          market,
          selectedMarket
        );

        if (penalty > maxCorrelationRisk) {
          maxCorrelationRisk = penalty;
        }
      }

      const effectiveEdge =
        market.economicEV * (1 - maxCorrelationRisk);

      const adaptiveMinEdge = BASE_MIN_EDGE * 0.85;

      const shrinkedProbability =
        market.impliedProbability +
        (
          market.probabilityAdjusted - market.impliedProbability
        ) * driftMultiplier;

      const cleanBayesianKelly = computeKelly(
        shrinkedProbability,
        market.impliedOdds
      );

      let robustKelly =
        cleanBayesianKelly *
        market.confidence *
        MARKET_STRUCTURAL_RELIABILITY[market.vertical] *
        market.liquidityScore;

      robustKelly *= (1 - maxCorrelationRisk);

      let effectiveKellyDamping = robustKelly;

      effectiveKellyDamping = Math.min(
        effectiveKellyDamping,
        MAX_EFFECTIVE_KELLY_POSITION
      );

      const adjustedUnitSize =
        market.unitSize * effectiveKellyDamping;

      if (layer === 1) {
        if (
          effectiveEdge >= adaptiveMinEdge &&
          verticalCounts[market.vertical] < TOP_K_PER_VERTICAL
        ) {
          if (
            exposure + adjustedUnitSize <=
            MAX_CLUSTER_EXPOSURE
          ) {
            selected.push({
              ...market,
              unitSize: Number(adjustedUnitSize.toFixed(4)),
              kelly: Number(robustKelly.toFixed(6))
            });

            verticalCounts[market.vertical]++;
            exposure += adjustedUnitSize;
          }
        }
      }

      else {
        if (
          exposure < 0.4 &&
          market.economicEV > 0.01 &&
          market.confidence > 0.15
        ) {
          if (
            effectiveEdge > 0 &&
            verticalCounts[market.vertical] < TOP_K_PER_VERTICAL
          ) {
            if (
              exposure + adjustedUnitSize <=
              MAX_CLUSTER_EXPOSURE
            ) {
              selected.push({
                ...market,
                unitSize: Number(adjustedUnitSize.toFixed(4)),
                kelly: Number(robustKelly.toFixed(6))
              });

              verticalCounts[market.vertical]++;
              exposure += adjustedUnitSize;
            }
          }
        }
      }
    }
  }

  return selected.sort(
  (a, b) => b.edgeQualityScore - a.edgeQualityScore
);
}
// ============================================================
// ORCHESTRATOR
// ============================================================

  export class OpusCoreBrain {
  private readonly MODEL_VERSION =
    "ARGOS_CORE_v19_FULLY_INSTITUTIONAL_ENGINE";

  public analyzeMatch(
    input: MatchContextInput
  ): PredictionAuditOutput {
    const winner = canonicalMarketVector(input.winnerMatrix);
    const goals = canonicalMarketVector(input.goalsMatrix);
    const cards = canonicalMarketVector(input.cardsMatrix);
    const corners = canonicalMarketVector(input.cornersMatrix);

    const regimeInfo = detectGameRegime(
      winner,
      goals,
      cards,
      corners
    );

    const signals: RawSignal[] = [];

    if (winner.length) {
      extractSignals(
        "WINNER",
        winner,
        regimeInfo.intensity,
        signals
      );
    }

    if (goals.length) {
      extractSignals(
        "GOALS",
        goals,
        regimeInfo.intensity,
        signals
      );
    }

    if (cards.length) {
      extractSignals(
        "CARDS",
        cards,
        regimeInfo.intensity,
        signals
      );
    }

    if (corners.length) {
      extractSignals(
        "CORNERS",
        corners,
        regimeInfo.intensity,
        signals
      );
    }

    const totalSignalsCount = signals.length;

    let meanAbsoluteEdge = 0;

    if (totalSignalsCount > 0) {
      const sumAbsoluteEdge = signals.reduce(
        (acc, curr) => acc + Math.abs(curr.economicEV),
        0
      );

      meanAbsoluteEdge = sumAbsoluteEdge / totalSignalsCount;
    }

    const isUltraEfficientMarketDispersal =
      meanAbsoluteEdge < 0.008 &&
      totalSignalsCount > 0;

    let finalMarkets: ApprovedMarket[] = [];

    if (!isUltraEfficientMarketDispersal) {
      const ranked = rankSignals(signals, regimeInfo);
      finalMarkets = selectMarkets(ranked);
    }

    const highestEdge =
      finalMarkets.length > 0
        ? Math.max(...finalMarkets.map(m => m.economicEV))
        : 0;

    const highestEQ =
      finalMarkets.length > 0
        ? Math.max(...finalMarkets.map(m => m.edgeQualityScore))
        : 0;

    const totalExposure = finalMarkets.reduce(
      (acc, curr) => acc + curr.unitSize,
      0
    );

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

        highest_detected_edge: Number(
          highestEdge.toFixed(6)
        ),

        highest_edge_quality_score: Number(
          highestEQ.toFixed(6)
        ),

        total_unit_exposure: Number(
          totalExposure.toFixed(4)
        ),

        detected_regime: regimeInfo.regime,

        regime_intensity: Number(
          regimeInfo.intensity.toFixed(4)
        ),

        mean_absolute_edge: Number(
          meanAbsoluteEdge.toFixed(6)
        )
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
