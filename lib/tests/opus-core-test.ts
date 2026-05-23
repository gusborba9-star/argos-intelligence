import { OpusCoreBrain, MatchContextInput } from "@/lib/core/opus-core";

describe("OpusCoreBrain - Core Deterministic Engine (Stable Suite)", () => {
  let core: OpusCoreBrain;

  beforeEach(() => {
    core = new OpusCoreBrain();
  });

  // ============================================================
  // 1. DETERMINISMO ABSOLUTO (CORE CONTRACT)
  // ============================================================

  it("must return identical output for identical inputs", () => {
    const input: MatchContextInput = createMinimalInput("determinism");

    const r1 = core.analyzeMatch(input);
    const r2 = core.analyzeMatch(input);

    expect(r1.prediction_hash).toBe(r2.prediction_hash);
    expect(r1.match_id).toBe(r2.match_id);

    expect(r1.allocation_state.total_approved_markets)
      .toBe(r2.allocation_state.total_approved_markets);

    expect(r1.allocation_state.total_unit_exposure)
      .toBe(r2.allocation_state.total_unit_exposure);
  });

  // ============================================================
  // 2. INTEGRIDADE NUMÉRICA (NO NaN / Infinity)
  // ============================================================

  it("must never return NaN or Infinity in allocation state", () => {
    const input: MatchContextInput = createMinimalInput("numeric-safety");

    const result = core.analyzeMatch(input);

    const state = result.allocation_state;

    expect(Number.isFinite(state.highest_detected_edge)).toBe(true);
    expect(Number.isFinite(state.highest_edge_quality_score)).toBe(true);
    expect(Number.isFinite(state.total_unit_exposure)).toBe(true);

    expect(state.total_unit_exposure).toBeLessThanOrEqual(1.5);
    expect(state.total_unit_exposure).toBeGreaterThanOrEqual(0);
  });

  // ============================================================
  // 3. TESTE DE RESILIÊNCIA A INPUT VAZIO
  // ============================================================

  it("must handle empty matrices without crashing", () => {
    const input: MatchContextInput = {
      matchId: "empty-case",
      leagueId: "TEST",
      winnerMatrix: {},
      goalsMatrix: {},
      cardsMatrix: {},
      cornersMatrix: {}
    };

    const result = core.analyzeMatch(input);

    expect(result).toBeDefined();
    expect(result.approvedMarkets).toEqual([]);
    expect(result.allocation_state.total_unit_exposure).toBe(0);
  });

  // ============================================================
  // 4. CONSISTÊNCIA MULTI-EXECUÇÃO (SIMULAÇÃO SERVERLESS SAFE)
  // ============================================================

  it("must remain stable across multiple independent instances", () => {
    const input = createMinimalInput("cold-start");

    const coreA = new OpusCoreBrain();
    const coreB = new OpusCoreBrain();

    const r1 = coreA.analyzeMatch(input);
    const r2 = coreB.analyzeMatch(input);

    expect(r1.prediction_hash).toBe(r2.prediction_hash);
    expect(r1.model_version).toBe(r2.model_version);
  });

  // ============================================================
  // 5. SANIDADE DE EDGE RANGE (ANTI-EXPLOSION CHECK)
  // ============================================================

  it("must keep edge values inside stable numeric bounds", () => {
    const input = createMinimalInput("edge-range");

    const result = core.analyzeMatch(input);

    for (const m of result.approvedMarkets) {
      expect(m.edge).toBeGreaterThan(-10);
      expect(m.edge).toBeLessThan(10);

      expect(m.edgeQualityScore).toBeGreaterThanOrEqual(0);
      expect(m.edgeQualityScore).toBeLessThanOrEqual(1);
    }
  });

  // ============================================================
  // HELPERS (ISOLAMENTO DETERMINÍSTICO)
  // ============================================================

  function createMinimalInput(seed: string): MatchContextInput {
    return {
      matchId: `${seed}-match`,
      leagueId: "EPL",

      winnerMatrix: buildMarket(0.52),
      goalsMatrix: buildMarket(0.61),
      cardsMatrix: buildMarket(0.55),
      cornersMatrix: buildMarket(0.58)
    };
  }

  function buildMarket(base: number) {
    return {
      a: { label: "A", probability: base, impliedOdds: 1.9 },
      b: { label: "B", probability: base - 0.05, impliedOdds: 2.1 },
      c: { label: "C", probability: base + 0.03, impliedOdds: 1.8 }
    };
  }
});
