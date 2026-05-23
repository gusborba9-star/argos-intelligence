import { OpusCoreBrain, MatchContextInput } from "../opus-core";

describe("OpusCoreBrain - Core Deterministic Engine", () => {
  let core: OpusCoreBrain;

  beforeEach(() => {
    core = new OpusCoreBrain();
  });

  it("should process match input and return deterministic prediction output", () => {
    const input: MatchContextInput = {
      matchId: "test-match-001",
      leagueId: "EPL",

      winnerMatrix: {
        home_win: {
          label: "HOME_WIN",
          probability: 0.52,
          impliedOdds: 1.95
        },
        draw: {
          label: "DRAW",
          probability: 0.28,
          impliedOdds: 3.10
        },
        away_win: {
          label: "AWAY_WIN",
          probability: 0.20,
          impliedOdds: 4.50
        }
      },

      goalsMatrix: {
        over_25: {
          label: "OVER_2.5",
          probability: 0.61,
          impliedOdds: 1.80
        },
        under_25: {
          label: "UNDER_2.5",
          probability: 0.39,
          impliedOdds: 2.05
        }
      },

      cardsMatrix: {
        over_35: {
          label: "OVER_3.5_CARDS",
          probability: 0.55,
          impliedOdds: 1.90
        }
      },

      cornersMatrix: {
        over_85: {
          label: "OVER_8.5_CORNERS",
          probability: 0.58,
          impliedOdds: 1.85
        }
      }
    };

    const result = core.analyzeMatch(input);

    // =========================
    // ASSERTIONS ESTRUTURAIS
    // =========================

    expect(result).toHaveProperty("match_id", "test-match-001");
    expect(result).toHaveProperty("prediction_hash");
    expect(result).toHaveProperty("model_version");

    expect(result).toHaveProperty("allocation_state");
    expect(result.allocation_state).toHaveProperty("total_approved_markets");
    expect(result.allocation_state).toHaveProperty("highest_detected_edge");
    expect(result.allocation_state).toHaveProperty("highest_edge_quality_score");
    expect(result.allocation_state).toHaveProperty("total_unit_exposure");

    expect(Array.isArray(result.approvedMarkets)).toBe(true);

    // =========================
    // SEGURANÇA NUMÉRICA
    // =========================

    expect(typeof result.allocation_state.highest_detected_edge).toBe("number");
    expect(Number.isFinite(result.allocation_state.highest_detected_edge)).toBe(true);

    expect(typeof result.allocation_state.highest_edge_quality_score).toBe("number");
    expect(Number.isFinite(result.allocation_state.highest_edge_quality_score)).toBe(true);

    expect(typeof result.allocation_state.total_unit_exposure).toBe("number");
    expect(Number.isFinite(result.allocation_state.total_unit_exposure)).toBe(true);

    // =========================
    // INTEGRIDADE DO OUTPUT
    // =========================

    if (result.approvedMarkets.length > 0) {
      for (const m of result.approvedMarkets) {
        expect(m).toHaveProperty("market");
        expect(m).toHaveProperty("edge");
        expect(m).toHaveProperty("edgeQualityScore");
        expect(m).toHaveProperty("allocationTier");
        expect(m).toHaveProperty("unitSize");

        expect(typeof m.edge).toBe("number");
        expect(Number.isFinite(m.edge)).toBe(true);

        expect(typeof m.edgeQualityScore).toBe("number");
        expect(Number.isFinite(m.edgeQualityScore)).toBe(true);
      }
    }
  });

  it("should remain deterministic for identical input", () => {
    const input: MatchContextInput = {
      matchId: "determinism-test",
      leagueId: "EPL",

      winnerMatrix: {},
      goalsMatrix: {},
      cardsMatrix: {},
      cornersMatrix: {}
    };

    const r1 = core.analyzeMatch(input);
    const r2 = core.analyzeMatch(input);

    expect(r1.prediction_hash).toBe(r2.prediction_hash);
    expect(r1.match_id).toBe(r2.match_id);
  });
});
