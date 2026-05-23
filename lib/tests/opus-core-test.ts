import { OpusCoreBrain, MatchContextInput } from "../opus-core";

describe("OpusCoreBrain - Institutional Test Harness", () => {
  let core: OpusCoreBrain;

  beforeEach(() => {
    core = new OpusCoreBrain();
  });

  // ============================================================
  // 1. TESTE DE DETERMINISMO ABSOLUTO
  // ============================================================

  it("must be fully deterministic under identical inputs", () => {
    const input: MatchContextInput = generateBaseInput("determinism");

    const r1 = core.analyzeMatch(input);
    const r2 = core.analyzeMatch(input);

    expect(r1.prediction_hash).toBe(r2.prediction_hash);
    expect(r1.approvedMarkets.length).toBe(r2.approvedMarkets.length);
    expect(r1.allocation_state.total_unit_exposure).toBe(
      r2.allocation_state.total_unit_exposure
    );
  });

  // ============================================================
  // 2. TESTE DE RESILIÊNCIA A RUÍDO (FUZZING CONTROLADO)
  // ============================================================

  it("should remain stable under probabilistic noise injection", () => {
    const base = generateBaseInput("noise");

    const results = [];

    for (let i = 0; i < 20; i++) {
      const noisy = injectNoise(base, 0.02); // ±2% noise
      results.push(core.analyzeMatch(noisy).allocation_state.total_unit_exposure);
    }

    const avg =
      results.reduce((a, b) => a + b, 0) / results.length;

    const variance =
      results.reduce((a, b) => a + Math.pow(b - avg, 2), 0) / results.length;

    // sistema não pode explodir sob ruído leve
    expect(variance).toBeLessThan(0.05);
  });

  // ============================================================
  // 3. TESTE DE CAUDA EXTREMA (MARKET CHAOS SIMULATION)
  // ============================================================

  it("should degrade gracefully under extreme market chaos", () => {
    const chaotic = generateChaoticInput();

    const result = core.analyzeMatch(chaotic);

    expect(result.allocation_state.total_approved_markets).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(result.allocation_state.highest_detected_edge)).toBe(true);
    expect(result.allocation_state.total_unit_exposure).toBeLessThanOrEqual(1.5);
  });

  // ============================================================
  // 4. TESTE DE COLAPSO (ZERO MARKET APPROVAL SCENARIO)
  // ============================================================

  it("should not break when all markets are rejected", () => {
    const extremeBadInput = generateZeroEdgeInput();

    const result = core.analyzeMatch(extremeBadInput);

    expect(result).toBeDefined();
    expect(result.approvedMarkets).toEqual([]);
    expect(result.allocation_state.highest_detected_edge).toBe(0);
    expect(result.allocation_state.highest_edge_quality_score).toBe(0);
  });

  // ============================================================
  // 5. TESTE DE CONSISTÊNCIA DE HASH EM COLD START SIMULADO
  // ============================================================

  it("should preserve hash consistency across fresh instances (cold start simulation)", () => {
    const input = generateBaseInput("cold-start");

    const coreA = new OpusCoreBrain();
    const coreB = new OpusCoreBrain();

    const r1 = coreA.analyzeMatch(input);
    const r2 = coreB.analyzeMatch(input);

    expect(r1.prediction_hash).toBe(r2.prediction_hash);
  });

  // ============================================================
  // 6. TESTE DE ESTABILIDADE DE DISTRIBUIÇÃO (EDGE PROFILE)
  // ============================================================

  it("should maintain stable edge distribution bounds", () => {
    const input = generateBaseInput("distribution");

    const result = core.analyzeMatch(input);

    for (const m of result.approvedMarkets) {
      expect(m.edge).toBeGreaterThan(-5);
      expect(m.edge).toBeLessThan(5);
      expect(m.edgeQualityScore).toBeGreaterThanOrEqual(0);
      expect(m.edgeQualityScore).toBeLessThanOrEqual(1);
    }
  });

  // ============================================================
  // 7. TESTE DE EXPOSIÇÃO FINANCEIRA (RISK CONSTRAINT VALIDATION)
  // ============================================================

  it("should never exceed max cluster exposure constraint", () => {
    const input = generateBaseInput("risk");

    const result = core.analyzeMatch(input);

    expect(result.allocation_state.total_unit_exposure).toBeLessThanOrEqual(1.5);
  });
});

// ============================================================
// 🧠 HELPERS DE TEST (SIMULAÇÃO ESTOCÁSTICA CONTROLADA)
// ============================================================

function generateBaseInput(seed: string): MatchContextInput {
  return {
    matchId: seed + "-match",
    leagueId: "EPL",

    winnerMatrix: buildMarket(0.52),
    goalsMatrix: buildMarket(0.61),
    cardsMatrix: buildMarket(0.55),
    cornersMatrix: buildMarket(0.58)
  };
}

function buildMarket(baseProb: number) {
  return {
    a: { label: "A", probability: baseProb, impliedOdds: 1.9 },
    b: { label: "B", probability: baseProb - 0.05, impliedOdds: 2.1 },
    c: { label: "C", probability: baseProb + 0.03, impliedOdds: 1.8 }
  };
}

function injectNoise(input: MatchContextInput, intensity: number): MatchContextInput {
  const mutate = (m: any) => {
    const clone = { ...m };

    for (const k in clone) {
      clone[k] = {
        ...clone[k],
        probability: Math.min(
          0.99,
          Math.max(0.01, clone[k].probability + (Math.random() - 0.5) * intensity)
        )
      };
    }

    return clone;
  };

  return {
    ...input,
    winnerMatrix: mutate(input.winnerMatrix),
    goalsMatrix: mutate(input.goalsMatrix),
    cardsMatrix: mutate(input.cardsMatrix),
    cornersMatrix: mutate(input.cornersMatrix)
  };
}

function generateChaoticInput(): MatchContextInput {
  return {
    matchId: "chaos",
    leagueId: "EPL",
    winnerMatrix: buildMarket(0.5),
    goalsMatrix: buildMarket(0.5),
    cardsMatrix: buildMarket(0.5),
    cornersMatrix: buildMarket(0.5)
  };
}

function generateZeroEdgeInput(): MatchContextInput {
  return {
    matchId: "zero-edge",
    leagueId: "EPL",
    winnerMatrix: {},
    goalsMatrix: {},
    cardsMatrix: {},
    cornersMatrix: {}
  };
     }
