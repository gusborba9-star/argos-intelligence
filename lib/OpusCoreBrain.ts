import crypto from "crypto";

// ============================================================
// L0 — CONSTANTES E PARÂMETROS INSTITUCIONAIS
// ============================================================

export const BASE_MIN_EDGE = 0.018;
export const SUBMARKET_HUNT_DISCOUNT = 0.72;
export const MAX_CLUSTER_EXPOSURE = 1.5;
export const TOP_K_PER_VERTICAL = 3;
export const GLOBAL_QUANT_SCALE = 0.07;
export const KELLY_FRACTION = 0.25;

export const MAX_EFFECTIVE_KELLY_POSITION = 0.08;

export const MIN_IMPLIED_PROBABILITY = 0.04;
export const MAX_IMPLIED_PROBABILITY = 0.96;

export const MARKET_STRUCTURAL_RELIABILITY: Record<MarketVertical, number> = {
  WINNER: 1.0,
  GOALS: 0.92,
  CARDS: 0.86,
CORNERS: 0.82
};

export const HISTORICAL_VERTICAL_BIAS: Record<MarketVertical, number> = {
  WINNER: 0.0,
  GOALS: -0.022,
  CARDS: 0.012,
  CORNERS: -0.01
};

// ============================================================
// L0.A — LEAGUE PERSONALITY PRIORS
// Identidade estrutural por liga — aprendizado offline.
// Motor usa esses priors até ter memória real suficiente (n >= 30).
// Após n >= 30 por liga, pesos são substituídos pelo aprendizado real.
// ============================================================

export interface LeagueProfile {
  varianceMultiplier: number;   // > 1 = mais imprevisível
  underBias: number;            // positivo = favorece under
  cardsBias: number;            // positivo = mais cartões
  cornersBias: number;          // positivo = mais escanteios
  homeAdvantageFactor: number;  // 1.0 = neutro, > 1 = casa domina
}

export const LEAGUE_PROFILES: Record<string, LeagueProfile> = {
  BRASILEIRAO:    { varianceMultiplier: 1.15, underBias: -0.04, cardsBias: 0.08,  cornersBias: 0.02,  homeAdvantageFactor: 1.12 },
  LIBERTADORES:   { varianceMultiplier: 1.20, underBias: -0.06, cardsBias: 0.12,  cornersBias: -0.02, homeAdvantageFactor: 1.18 },
  SUL_AMERICANA:  { varianceMultiplier: 1.10, underBias: -0.03, cardsBias: 0.09,  cornersBias: 0.00,  homeAdvantageFactor: 1.14 },
  PREMIER_LEAGUE: { varianceMultiplier: 1.05, underBias: 0.02,  cardsBias: 0.00,  cornersBias: 0.05,  homeAdvantageFactor: 1.05 },
  CHAMPIONS:      { varianceMultiplier: 1.08, underBias: 0.01,  cardsBias: 0.03,  cornersBias: 0.03,  homeAdvantageFactor: 1.08 },
  BUNDESLIGA:     { varianceMultiplier: 1.08, underBias: -0.08, cardsBias: -0.02, cornersBias: 0.08,  homeAdvantageFactor: 1.06 },
  SERIE_A:        { varianceMultiplier: 0.95, underBias: 0.10,  cardsBias: 0.05,  cornersBias: -0.04, homeAdvantageFactor: 1.04 },
  LA_LIGA:        { varianceMultiplier: 1.02, underBias: 0.04,  cardsBias: 0.02,  cornersBias: 0.03,  homeAdvantageFactor: 1.06 },
  LIGUE_1:        { varianceMultiplier: 1.06, underBias: 0.00,  cardsBias: 0.04,  cornersBias: 0.02,  homeAdvantageFactor: 1.08 },
  BRASILEIRAO_B:  { varianceMultiplier: 1.18, underBias: -0.02, cardsBias: 0.10,  cornersBias: 0.04,  homeAdvantageFactor: 1.15 },
  DEFAULT:        { varianceMultiplier: 1.00, underBias: 0.00,  cardsBias: 0.00,  cornersBias: 0.00,  homeAdvantageFactor: 1.00 },
};

// ============================================================
// L0.B — EXTRA-FIELD CONTEXT WEIGHTS
// Fatores fora de campo que afetam o comportamento da partida.
// O motor lê esses fatores e adjusts edge/confiança por vertical.
// Gradativamente substituídos por aprendizado real.
// ============================================================

export interface ExtraFieldContext {
  // Pressão contextual — opcionais para retrocompatibilidade
  isDecisiveMatch?: boolean;      // Final, semifinal, decisão de título/rebaixamento
  isClassico?: boolean;           // Clássico regional — alta variância emocional
  isDerby?: boolean;              // Derby local — cartões elevados, compressão tática
  isNeutralVenue?: boolean;       // Campo neutro — anula home advantage

  // Condições operacionais
  travelFatigue?: number;         // 0-1: fadiga de viagem do visitante (voo longo, fuso)
  altitudeFactor?: number;        // 0-1: altitude da partida (ex: La Paz = 1.0)
  weatherSeverity?: number;       // 0-1: condições climáticas adversas (chuva forte, vento)

  // Estado dos times
  homeRestDays?: number;          // Dias desde última partida
  awayRestDays?: number;
  homeInjuryLoad?: number;        // 0-1: carga de desfalques (0 = sem desfalques)
  awayInjuryLoad?: number;
  homeFormStreak?: number;        // -5 a +5: sequência recente (neg = derrotas)
  awayFormStreak?: number;

  // Contexto de mercado
  marketSuspicion?: number;       // 0-1: suspeita de manipulação (odds anômalas)
  publicOverreaction?: number;    // 0-1: mercado reagindo exageradamente a um fator
}

// Impacto dos fatores extra-campo por vertical
// Positivo = aumenta edge nessa vertical, Negativo = reduz
const EXTRA_FIELD_IMPACTS = {
  isDecisiveMatch: { WINNER: 0.0,   GOALS:  0.05, CARDS: 0.10,  CORNERS: 0.03  },
  isClassico:      { WINNER: -0.05, GOALS:  0.08, CARDS: 0.15,  CORNERS: 0.04  },
  isDerby:         { WINNER: -0.08, GOALS: -0.06, CARDS: 0.18,  CORNERS: -0.03 },
  isNeutralVenue:  { WINNER: 0.0,   GOALS:  0.03, CARDS: -0.02, CORNERS: 0.01  },
} as const;

// Threshold mínimo de memória real antes de reduzir peso dos priors
export const MEMORY_PRIOR_GRADUATION_N = 50;

// ============================================================
// L0.C — AUTO-LEARNING PARAMETERS
// Controla a velocidade com que o motor aprende e descarta priors.
// ============================================================

// Taxa de aprendizado adaptativo — quanto o erro de hoje afeta o peso
export const LEARNING_RATE_BASE = 0.08;
// Decaimento do aprendizado com o tempo — evita overfitting em sequências curtas
export const LEARNING_DECAY_HALFLIFE_DAYS = 21;
// Mínimo de amostras para confiar no aprendizado (por contexto)
export const MIN_SAMPLES_FOR_CONFIDENCE = 15;
// Máximo de ajuste que o aprendizado pode fazer em qualquer parâmetro por ciclo
export const MAX_LEARNING_DELTA = 0.035;

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
// L0.2B — CONTEXTUAL MEMORY STORE
// Aprendizado estrutural por (liga × vertical × regime).
// Substitui priors offline quando n >= MEMORY_PRIOR_GRADUATION_N.
// Interface Supabase-ready: exporta/importa snapshots serializáveis.
// ============================================================

export interface ContextualMemoryRecord {
  scope: string;          // "BRASILEIRAO:GOALS:TRUNCATED"
  n: number;              // amostras acumuladas
  wins: number;
  losses: number;
  sumEdgeError: number;   // Σ(realizedEdge - predictedEdge)
  sumEdgeErrorSq: number; // Σ(erro²) — para variância
  lastUpdated: number;    // timestamp
}

export interface MemorySnapshot {
  records: Record<string, ContextualMemoryRecord>;
  exportedAt: number;
}

const CONTEXTUAL_MEMORY: Map<string, ContextualMemoryRecord> = new Map();

export class ContextualMemoryStore {
  private static key(league: string, vertical: MarketVertical, regime: GameRegime): string {
    return `${(league || "DEFAULT").toUpperCase()}:${vertical}:${regime}`;
  }

  public static getLearnedAdjustment(
    league: string,
    vertical: MarketVertical,
    regime: GameRegime
  ): number {
    const k = this.key(league, vertical, regime);
    const rec = CONTEXTUAL_MEMORY.get(k);
    if (!rec || rec.n < MIN_SAMPLES_FOR_CONFIDENCE) return 0;

    const avgError = rec.sumEdgeError / rec.n;
    const winRate = rec.wins / Math.max(1, rec.wins + rec.losses);

    const confidenceScale = Math.min(1, rec.n / (MEMORY_PRIOR_GRADUATION_N * 2));
    const winRateAdjust = winRate < 0.45 ? -(0.45 - winRate) * 0.1 : 0;

    const raw = (avgError * LEARNING_RATE_BASE + winRateAdjust) * confidenceScale;
    return clamp(-MAX_LEARNING_DELTA, raw, MAX_LEARNING_DELTA);
  }

  public static getLearnedConfidenceMultiplier(
    league: string,
    vertical: MarketVertical,
    regime: GameRegime
  ): number {
    const k = this.key(league, vertical, regime);
    const rec = CONTEXTUAL_MEMORY.get(k);
    if (!rec || rec.n < MIN_SAMPLES_FOR_CONFIDENCE) return 1.0;

    const winRate = rec.wins / Math.max(1, rec.wins + rec.losses);
    const scale = 1.0 + (winRate - 0.50) * 0.4;
    return clamp(0.75, scale, 1.25);
  }

  public static registerResult(
    league: string,
    vertical: MarketVertical,
    regime: GameRegime,
    predictedEdge: number,
    won: boolean
  ): void {
    const k = this.key(league, vertical, regime);
    const realizedEdge = won ? Math.abs(predictedEdge) : -Math.abs(predictedEdge);
    const error = realizedEdge - predictedEdge;

    const existing = CONTEXTUAL_MEMORY.get(k);
    if (existing) {
      existing.n++;
      existing.wins += won ? 1 : 0;
      existing.losses += won ? 0 : 1;
      existing.sumEdgeError += error;
      existing.sumEdgeErrorSq += error * error;
      existing.lastUpdated = Date.now();
    } else {
      CONTEXTUAL_MEMORY.set(k, {
        scope: k,
        n: 1,
        wins: won ? 1 : 0,
        losses: won ? 0 : 1,
        sumEdgeError: error,
        sumEdgeErrorSq: error * error,
        lastUpdated: Date.now()
      });
    }

    DriftMonitor.update(error, predictedEdge, realizedEdge);
  }

  public static exportSnapshot(): MemorySnapshot {
    const records: Record<string, ContextualMemoryRecord> = {};
    for (const [k, v] of CONTEXTUAL_MEMORY.entries()) {
      records[k] = { ...v };
    }
    return { records, exportedAt: Date.now() };
  }

  public static loadSnapshot(snapshot: MemorySnapshot): void {
    CONTEXTUAL_MEMORY.clear();
    for (const [k, v] of Object.entries(snapshot.records)) {
      if (
        typeof v.n === "number" &&
        typeof v.wins === "number" &&
        typeof v.sumEdgeError === "number" &&
        v.n >= 0 && v.n < 1_000_000
      ) {
        CONTEXTUAL_MEMORY.set(k, v);
      }
    }
  }

  public static getStats(): { totalContexts: number; totalContextsRecorded: number; matureContexts: number; topLeagues: string[] } {
    let mature = 0;
    const leagueCounts: Record<string, number> = {};
    for (const [k, v] of CONTEXTUAL_MEMORY.entries()) {
      if (v.n >= MIN_SAMPLES_FOR_CONFIDENCE) mature++;
      const league = k.split(":")[0];
      leagueCounts[league] = (leagueCounts[league] ?? 0) + v.n;
    }
    const topLeagues = Object.entries(leagueCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([l]) => l);
    return {
      totalContexts: CONTEXTUAL_MEMORY.size,
      totalContextsRecorded: CONTEXTUAL_MEMORY.size,
      matureContexts: mature,
      topLeagues
    };
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
  } else if (vertical === "WINNER") {
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
  } else if (vertical === "CARDS") {
    const isUnder = label.includes("UNDER") || label.includes("MENOS");
    const magnitude = line ? clamp(0.20, line / 6.5, 0.95) : 0.70;
    aggressionFactor = isUnder ? -magnitude : magnitude;
    tempoFactor = isUnder ? 0.15 : -0.35;
  } else if (vertical === "CORNERS") {
    const isUnder = label.includes("UNDER") || label.includes("MENOS");
    const magnitude = line ? clamp(0.20, line / 12.5, 0.90) : 0.60;
    tempoFactor = isUnder ? -magnitude : magnitude;
    goalFactor = isUnder ? -magnitude * 0.5 : magnitude * 0.5;
  }

  return { goalFactor, tempoFactor, aggressionFactor };
}

// ============================================================
// TYPES
// ============================================================

export type MarketVertical = "WINNER" | "GOALS" | "CARDS" | "CORNERS";
export type AllocationTier = "ELITE" | "TACTICAL" | "MICRO" | "FULL_VETO";
export type GameRegime = "TRUNCATED" | "EXPLOSIVE" | "BALANCED";

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
  extraField?: ExtraFieldContext;
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
  verticalCoverage: {
    WINNER:  ApprovedMarket | null;
    GOALS:   ApprovedMarket | null;
    CARDS:   ApprovedMarket | null;
    CORNERS: ApprovedMarket | null;
  };
  contextualFactors: {
    leagueProfile: LeagueProfile;
    extraFieldImpact: Record<MarketVertical, number>;
    memoryMatureContexts: number;
    learningAdjustmentsApplied: boolean;
  };
  approvedMarkets: ApprovedMarket[];
  created_at: string;
  }
// ============================================================
// L1 — CANONICALIZATION
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
    .update(JSON.stringify({ matchId, leagueId, winner, goals, cards, corners }))
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
    m.label.toUpperCase().includes("OVER_25") || m.label.toUpperCase().includes("OVER 2.5")
  );
  const under25 = goalsMarkets.find(m =>
    m.label.toUpperCase().includes("UNDER_25") || m.label.toUpperCase().includes("UNDER 2.5")
  );
  if (over25) { over25Prob = over25.probability; under25Prob = 1 - over25Prob; }
  else if (under25) { under25Prob = under25.probability; over25Prob = 1 - under25Prob; }

  const bttsNo = goalsMarkets.find(m =>
    m.label.toUpperCase().includes("BTTS_NO") || m.label.toUpperCase().includes("AMBAS_NAO")
  );
  const bttsYes = goalsMarkets.find(m =>
    m.label.toUpperCase().includes("BTTS_YES") || m.label.toUpperCase().includes("AMBAS_SIM")
  );
  if (bttsNo) bttsNoProb = bttsNo.probability;
  else if (bttsYes) bttsNoProb = 1 - bttsYes.probability;

  const draw = winnerMarkets.find(m =>
    m.label.toUpperCase() === "X" ||
    m.label.toUpperCase() === "DRAW" ||
    m.label.toUpperCase() === "EMPATE"
  );
  if (draw) drawProb = draw.probability;

  const highCards = cardsMarkets.find(m =>
    m.label.toUpperCase().includes("OVER_45") || m.label.toUpperCase().includes("OVER 4.5")
  );
  if (highCards) cardsIntensity = highCards.probability;

  const highCorners = cornersMarkets.find(m =>
    m.label.toUpperCase().includes("OVER_105") || m.label.toUpperCase().includes("OVER 10.5")
  );
  if (highCorners) cornersIntensity = highCorners.probability;

  const truncationInteraction = under25Prob * bttsNoProb * drawProb;
  const truncationScore =
    under25Prob * 0.25 +
    bttsNoProb * 0.20 +
    drawProb * 0.15 +
    truncationInteraction * 0.30 +
    cardsIntensity * 0.10 -
    cornersIntensity * 0.10;

  if (truncationScore > 0.55) {
    return { regime: "TRUNCATED", intensity: clamp(0, (truncationScore - 0.55) / 0.45, 1) };
  }
  if (over25Prob > 0.58 && truncationScore < 0.38) {
    return { regime: "EXPLOSIVE", intensity: clamp(0, (0.38 - truncationScore) / 0.38, 1) };
  }
  return { regime: "BALANCED", intensity: 0 };
}

// ============================================================
// L2.6 — MARKET EFFICIENCY CURVE
// ============================================================

function calculateMarketEfficiencyPenalty(impliedOdds: number): number {
  const k = 0.8;
  const x0 = 4.5;
  const maxPenalty = 0.24;
  const sigmoid = 1 / (1 + Math.exp(-k * (impliedOdds - x0)));
  return sigmoid * maxPenalty;
}

// ============================================================
// L2.7 — LIQUIDITY MODEL
// ============================================================

function getLiquidityScore(vertical: MarketVertical, impliedOdds: number): number {
  let base = 1;
  if (vertical === "GOALS") base = 0.92;
  if (vertical === "CARDS") base = 0.72;
  if (vertical === "CORNERS") base = 0.66;
  const oddsPenalty = clamp(0.70, 1 - ((impliedOdds - 2) * 0.04), 1);
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
  let modelVariance = 0.01;
  if (vertical === "CORNERS") modelVariance = 0.028;
if (vertical === "CARDS") modelVariance = 0.032;
  const regimeVariance = 0.04 * regimeIntensity;
  const totalVariance = marketVariance + modelVariance + regimeVariance;
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
  const adjustedProb = clamp(MIN_IMPLIED_PROBABILITY, modelProb - bias, MAX_IMPLIED_PROBABILITY);
  const sigma = computeDecomposedSigma(impliedProb, vertical, regimeIntensity);
  const economicEV = adjustedProb * impliedOdds - 1;
  const statisticalEdge = (adjustedProb - impliedProb) / sigma;
  let normalizedEdgeScore = softsign(statisticalEdge * 0.45);
  const liquidityScore = getLiquidityScore(vertical, impliedOdds);
  const efficiencyPenalty = calculateMarketEfficiencyPenalty(impliedOdds);
  normalizedEdgeScore *= (1 - efficiencyPenalty * 0.55);
  return { adjustedProb, sigma, liquidityScore, economicEV, statisticalEdge, normalizedEdgeScore };
}

// ============================================================
// L4 — SIGNAL EXTRACTION
// ============================================================

function extractSignals(
  vertical: MarketVertical,
  markets: MarketProbability[],
  regimeIntensity: number,
  pool: RawSignal[],
  league: string = "DEFAULT",
  regime: GameRegime = "BALANCED",
  leagueProfile: LeagueProfile = LEAGUE_PROFILES["DEFAULT"],
  extraFieldImpact: number = 0
): void {
  const structuralBias = HISTORICAL_VERTICAL_BIAS[vertical];

  const learnedAdjustment = ContextualMemoryStore.getLearnedAdjustment(league, vertical, regime);
  const learnedConfMult   = ContextualMemoryStore.getLearnedConfidenceMultiplier(league, vertical, regime);

  const leagueBias =
    vertical === "GOALS"   ? leagueProfile.underBias   * 0.5  :
    vertical === "CARDS"   ? leagueProfile.cardsBias   * 0.5  :
    vertical === "CORNERS" ? leagueProfile.cornersBias * 0.5  : 0;

  const totalBias = structuralBias + learnedAdjustment + leagueBias;

  for (const m of markets) {
    if (m.impliedOdds > 15 || m.impliedOdds < 1.01) continue;

    const impliedProbability = clamp(MIN_IMPLIED_PROBABILITY, 1 / m.impliedOdds, MAX_IMPLIED_PROBABILITY);
    const memoryBias = EdgeMemoryStore.getBiasAdjustment(m.label);

    const { adjustedProb, sigma, liquidityScore, economicEV, statisticalEdge, normalizedEdgeScore } =
      computeInstitutionalEdge(
        m.probability, impliedProbability,
        totalBias + memoryBias + extraFieldImpact,
        m.impliedOdds, vertical, regimeIntensity
      );

    const latentFactors = deriveLatentFactors(m.label, vertical);

    pool.push({
      vertical, market: m.label,
      probability: m.probability,
      probabilityAdjusted: adjustedProb,
      impliedOdds: m.impliedOdds,
      impliedProbability,
      economicEV:           economicEV * learnedConfMult,
      statisticalEdge,
      normalizedEdgeScore:  normalizedEdgeScore * learnedConfMult,
      sigma, liquidityScore, latentFactors
    });
  }
}

// ============================================================
// L4.5 — EXTRA-FIELD IMPACT CALCULATOR
// ============================================================

function computeExtraFieldImpacts(
  extra: ExtraFieldContext | undefined,
  leagueProfile: LeagueProfile
): Record<MarketVertical, number> {
  const base: Record<MarketVertical, number> = { WINNER: 0, GOALS: 0, CARDS: 0, CORNERS: 0 };
  if (!extra) return base;

  const verticals: MarketVertical[] = ["WINNER", "GOALS", "CARDS", "CORNERS"];

  const boolFactors: Array<{ key: keyof typeof EXTRA_FIELD_IMPACTS; active: boolean }> = [
    { key: "isDecisiveMatch", active: extra.isDecisiveMatch ?? false },
    { key: "isClassico",      active: extra.isClassico      ?? false },
    { key: "isDerby",         active: extra.isDerby         ?? false },
    { key: "isNeutralVenue",  active: extra.isNeutralVenue  ?? false },
  ];

  for (const { key, active } of boolFactors) {
    if (!active) continue;
    for (const v of verticals) {
      base[v] += EXTRA_FIELD_IMPACTS[key][v];
    }
  }

  if (extra.travelFatigue && extra.travelFatigue > 0.3) {
    const fatigue = extra.travelFatigue;
    base["WINNER"]  -= fatigue * 0.05;
    base["GOALS"]   += fatigue * 0.04;
    base["CARDS"]   += fatigue * 0.03;
  }

  if (extra.altitudeFactor && extra.altitudeFactor > 0.5) {
    const alt = extra.altitudeFactor;
    base["GOALS"]   -= alt * 0.06;
    base["CORNERS"] -= alt * 0.03;
    base["CARDS"]   += alt * 0.02;
  }

  if (extra.weatherSeverity && extra.weatherSeverity > 0.4) {
    const w = extra.weatherSeverity;
    base["GOALS"]   -= w * 0.05;
    base["CORNERS"] -= w * 0.04;
    base["CARDS"]   += w * 0.02;
  }

  const homeRest = extra.homeRestDays ?? 7;
  const awayRest = extra.awayRestDays ?? 7;
  if (homeRest < 3 || awayRest < 3) {
    base["GOALS"] += 0.03;
    base["CARDS"] += 0.04;
  }

  const injuryLoad = Math.max(extra.homeInjuryLoad ?? 0, extra.awayInjuryLoad ?? 0);
  if (injuryLoad > 0.4) {
    base["GOALS"]   -= injuryLoad * 0.04;
    base["WINNER"]  -= injuryLoad * 0.03;
  }

  if (extra.marketSuspicion && extra.marketSuspicion > 0.5) {
    for (const v of verticals) base[v] -= extra.marketSuspicion * 0.08;
  }

  for (const v of verticals) {
    base[v] = clamp(-0.15, base[v], 0.15);
  }

  return base;
  }
// ============================================================
// L7.5 — VERTICAL COVERAGE GUARANTEE
// ============================================================

function buildVerticalCoverage(
  allRankedSignals: ApprovedMarket[],
  approvedMarkets: ApprovedMarket[]
): PredictionAuditOutput["verticalCoverage"] {
  const coverage: PredictionAuditOutput["verticalCoverage"] = {
    WINNER: null, GOALS: null, CARDS: null, CORNERS: null
  };

  const verticals: MarketVertical[] = ["WINNER", "GOALS", "CARDS", "CORNERS"];

  for (const v of verticals) {
    const inApproved = approvedMarkets.find(m => m.vertical === v);
    if (inApproved) { coverage[v] = inApproved; continue; }

    const bestAvailable = allRankedSignals
      .filter(m => m.vertical === v && m.economicEV > 0)
      .sort((a, b) => b.edgeQualityScore - a.edgeQualityScore)[0] ?? null;

    if (bestAvailable) {
      coverage[v] = { ...bestAvailable, allocationTier: "MICRO", unitSize: 0 };
    }
  }

  return coverage;
}

// ============================================================
// L5 — KELLY
// ============================================================

function computeKelly(probability: number, odds: number): number {
  const b = odds - 1;
  if (b <= 0) return 0;
  const k = ((probability * b - (1 - probability)) / b) * KELLY_FRACTION;
  return clamp(0, k, KELLY_FRACTION);
}

// ============================================================
// L6 — RANKING
// ============================================================

export const MIN_EDGE_SCORE: Record<MarketVertical, number> = {
  WINNER: 0.028,
  GOALS: 0.012,
  CARDS: 0.010,
  CORNERS: 0.008
};

function rankSignals(
  signals: RawSignal[],
  regimeInfo: RegimeAnalysisResult
): ApprovedMarket[] {
  const driftMultiplier = DriftMonitor.getConfidenceMultiplier();

  return signals
    .map(signal => {
      let regimeMultiplier = 1;
      if (regimeInfo.regime === "TRUNCATED" && signal.latentFactors.goalFactor < 0) {
        regimeMultiplier = 1 + regimeInfo.intensity * 0.35;
      } else if (regimeInfo.regime === "EXPLOSIVE" && signal.latentFactors.goalFactor > 0) {
        regimeMultiplier = 1 + regimeInfo.intensity * 0.35;
      }

      const rawConf =
  signal.normalizedEdgeScore * 0.55 +
  signal.economicEV * 0.45;
      const confidence = clamp(
  0.10,
  1 / (1 + Math.exp(-rawConf * 2.4 + 0.2)),
  0.98
);

      const score = (
  Math.max(0, signal.normalizedEdgeScore) * 0.46 +
  Math.max(0, signal.economicEV) * 0.30 +
  confidence * 0.24
) * regimeMultiplier;
     
      let eqs = softsign(score / GLOBAL_QUANT_SCALE);
      eqs *= MARKET_STRUCTURAL_RELIABILITY[signal.vertical];
      eqs *= driftMultiplier;

      const kelly = computeKelly(signal.probabilityAdjusted, signal.impliedOdds);

      let tier: AllocationTier = "MICRO";
      let unit = 0.25;
      if (
  eqs > 0.72 &&
  signal.economicEV > 0.008
) {
  tier = "ELITE";
  unit = 1.0;
}
else if (
  eqs > 0.42 &&
  signal.economicEV > 0.002
) {
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
  signal.economicEV > -0.003 &&
  signal.edgeQualityScore > MIN_EDGE_SCORE[signal.vertical] * 0.18
)
.sort((a, b) => b.edgeQualityScore - a.edgeQualityScore);
}

// ============================================================
// L6.5 — VECTORIAL CORRELATION
// ============================================================

function getVectorialCorrelationPenalty(
  marketA: ApprovedMarket,
  marketB: ApprovedMarket
): number {
  if (marketA.market === marketB.market && marketA.vertical === marketB.vertical) return 0;
  const fA = marketA.latentFactors;
  const fB = marketB.latentFactors;
  const dotProduct =
    (fA.goalFactor * fB.goalFactor) +
    (fA.tempoFactor * fB.tempoFactor) +
    (fA.aggressionFactor * fB.aggressionFactor);
  if (dotProduct > 0.28) return Math.min(0.45, dotProduct * 0.38);
  return 0;
}

// ============================================================
// L7 — MARKET SELECTION
// ============================================================

function selectMarkets(markets: ApprovedMarket[]): ApprovedMarket[] {
  const selected: ApprovedMarket[] = [];
  let exposure = 0;
  const verticalCounts: Record<MarketVertical, number> = {
    WINNER: 0, GOALS: 0, CARDS: 0, CORNERS: 0
  };
  const driftMultiplier = DriftMonitor.getConfidenceMultiplier();

  for (const layer of [1, 2]) {
    for (const market of markets) {
      if (selected.some(s => s.market === market.market && s.vertical === market.vertical)) {
        continue;
      }

      let maxCorrelationRisk = 0;
      for (const selectedMarket of selected) {
        const penalty = getVectorialCorrelationPenalty(market, selectedMarket);
        if (penalty > maxCorrelationRisk) maxCorrelationRisk = penalty;
      }

      const effectiveEdge = market.economicEV * (1 - maxCorrelationRisk);
      const adaptiveMinEdge =
  market.vertical === "WINNER"
    ? BASE_MIN_EDGE * 0.55
    : BASE_MIN_EDGE * 0.12;
      const shrinkedProbability =
        market.impliedProbability +
        (market.probabilityAdjusted - market.impliedProbability) * driftMultiplier;

      const cleanBayesianKelly = computeKelly(shrinkedProbability, market.impliedOdds);

      const kellyScale = clamp(
        0.30,
        cleanBayesianKelly * market.confidence *
        MARKET_STRUCTURAL_RELIABILITY[market.vertical] *
        market.liquidityScore * 4,
        1.0
      );
      let robustKelly = kellyScale * (cleanBayesianKelly * MARKET_STRUCTURAL_RELIABILITY[market.vertical]);
      robustKelly *= (1 - maxCorrelationRisk);
      robustKelly = Math.min(robustKelly, MAX_EFFECTIVE_KELLY_POSITION);

      const adjustedUnitSize = market.unitSize * kellyScale;

      if (layer === 1) {
        if (
(
  effectiveEdge >= adaptiveMinEdge ||
  (
    market.economicEV > -0.0005 &&
    market.edgeQualityScore > 0.46 &&
    market.confidence > 0.38
  )
) &&
          verticalCounts[market.vertical] < TOP_K_PER_VERTICAL &&
          exposure + adjustedUnitSize <= MAX_CLUSTER_EXPOSURE
        ) {
          selected.push({
            ...market,
            unitSize: Number(adjustedUnitSize.toFixed(4)),
            kelly: Number(robustKelly.toFixed(6))
          });
          verticalCounts[market.vertical]++;
          exposure += adjustedUnitSize;
        }
      } else {
        if (
          exposure < 0.4 &&
          market.economicEV > 0.00 &&
          market.confidence > 0.05 &&
          effectiveEdge > 0 &&
          verticalCounts[market.vertical] < TOP_K_PER_VERTICAL &&
          exposure + adjustedUnitSize <= MAX_CLUSTER_EXPOSURE
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

  return selected.sort((a, b) => b.edgeQualityScore - a.edgeQualityScore);
  }
// ============================================================
// ORCHESTRATOR
// ============================================================

export class OpusCoreBrain {
  private readonly MODEL_VERSION = "ARGOS_CORE_v20_SELF_LEARNING_ENGINE";

  public analyzeMatch(input: MatchContextInput): PredictionAuditOutput {
    if (!input?.matchId) {
      throw new Error("OpusCoreBrain: matchId é obrigatório");
    }

    const winner  = canonicalMarketVector(input.winnerMatrix);
    const goals   = canonicalMarketVector(input.goalsMatrix);
    const cards   = canonicalMarketVector(input.cardsMatrix);
    const corners = canonicalMarketVector(input.cornersMatrix);

    const leagueId = (input.leagueId ?? "DEFAULT").toUpperCase();
    const leagueProfile = LEAGUE_PROFILES[leagueId] ?? LEAGUE_PROFILES["DEFAULT"];

    const regimeInfo = detectGameRegime(winner, goals, cards, corners);
    const extraFieldImpacts = computeExtraFieldImpacts(input.extraField, leagueProfile);

    const suspicion = input.extraField?.marketSuspicion ?? 0;
    if (suspicion > 0.80) {
      const emptyCoverage: PredictionAuditOutput["verticalCoverage"] =
        { WINNER: null, GOALS: null, CARDS: null, CORNERS: null };
      return {
        match_id: input.matchId,
        prediction_hash: generateDeterministicHash(
          input.matchId, input.leagueId, winner, goals, cards, corners
        ),
        model_version: this.MODEL_VERSION,
        allocation_state: {
          total_approved_markets: 0,
          highest_detected_edge: 0,
          highest_edge_quality_score: 0,
          total_unit_exposure: 0,
          detected_regime: regimeInfo.regime,
          regime_intensity: 0,
          mean_absolute_edge: 0
        },
        verticalCoverage: emptyCoverage,
        contextualFactors: {
          leagueProfile,
          extraFieldImpact: extraFieldImpacts,
          memoryMatureContexts: ContextualMemoryStore.getStats().matureContexts,
          learningAdjustmentsApplied: false
        },
        approvedMarkets: [],
        created_at: new Date().toISOString()
      };
    }

    const signals: RawSignal[] = [];
    const memStats = ContextualMemoryStore.getStats();
    const hasLearnedContext = memStats.matureContexts > 0;

    if (winner.length)  extractSignals("WINNER",  winner,  regimeInfo.intensity, signals, leagueId, regimeInfo.regime, leagueProfile, extraFieldImpacts["WINNER"]);
    if (goals.length)   extractSignals("GOALS",   goals,   regimeInfo.intensity, signals, leagueId, regimeInfo.regime, leagueProfile, extraFieldImpacts["GOALS"]);
    if (cards.length)   extractSignals("CARDS",   cards,   regimeInfo.intensity, signals, leagueId, regimeInfo.regime, leagueProfile, extraFieldImpacts["CARDS"]);
    if (corners.length) extractSignals("CORNERS", corners, regimeInfo.intensity, signals, leagueId, regimeInfo.regime, leagueProfile, extraFieldImpacts["CORNERS"]);

    const totalSignalsCount = signals.length;
    let meanAbsoluteEdge = 0;
    if (totalSignalsCount > 0) {
      meanAbsoluteEdge = signals.reduce((acc, s) => acc + Math.abs(s.economicEV), 0) / totalSignalsCount;
    }

    const isUltraEfficientMarket = meanAbsoluteEdge < 0.002 && totalSignalsCount > 0;

    let finalMarkets: ApprovedMarket[] = [];
    let allRanked: ApprovedMarket[] = [];

    if (!isUltraEfficientMarket) {
      allRanked    = rankSignals(signals, regimeInfo);
      finalMarkets = selectMarkets(allRanked);
    }

    const verticalCoverage = buildVerticalCoverage(allRanked, finalMarkets);

    const highestEdge = finalMarkets.length > 0
      ? Math.max(...finalMarkets.map(m => m.economicEV)) : 0;
    const highestEQ = finalMarkets.length > 0
      ? Math.max(...finalMarkets.map(m => m.edgeQualityScore)) : 0;
    const totalExposure = finalMarkets.reduce((acc, m) => acc + m.unitSize, 0);

    return {
      match_id: input.matchId,
      prediction_hash: generateDeterministicHash(
        input.matchId, input.leagueId, winner, goals, cards, corners
      ),
      model_version: this.MODEL_VERSION,
      allocation_state: {
        total_approved_markets: finalMarkets.length,
        highest_detected_edge:       Number(highestEdge.toFixed(6)),
        highest_edge_quality_score:  Number(highestEQ.toFixed(6)),
        total_unit_exposure:         Number(totalExposure.toFixed(4)),
        detected_regime:             regimeInfo.regime,
        regime_intensity:            Number(regimeInfo.intensity.toFixed(4)),
        mean_absolute_edge:          Number(meanAbsoluteEdge.toFixed(6))
      },
      verticalCoverage,
      contextualFactors: {
        leagueProfile,
        extraFieldImpact: extraFieldImpacts,
        memoryMatureContexts: memStats.matureContexts,
        learningAdjustmentsApplied: hasLearnedContext
      },
      approvedMarkets: finalMarkets,
      created_at: new Date().toISOString()
    };
  }

  public registerOutcomeFeedback(
    league: string,
    vertical: MarketVertical,
    regime: GameRegime,
    predictedEdge: number,
    won: boolean,
    _market?: string,
    _realizedEdge?: number
  ): void {
    ContextualMemoryStore.registerResult(league, vertical, regime, predictedEdge, won);

    if (_market !== undefined && _realizedEdge !== undefined) {
      EdgeMemoryStore.registerOutcome(_market, predictedEdge, _realizedEdge, vertical);
    }
  }

  public exportMemorySnapshot(): MemorySnapshot {
    return ContextualMemoryStore.exportSnapshot();
  }

  public loadMemorySnapshot(snapshot: MemorySnapshot): void {
    ContextualMemoryStore.loadSnapshot(snapshot);
  }

  public getMemoryStats() {
    return ContextualMemoryStore.getStats();
  }
}
        
