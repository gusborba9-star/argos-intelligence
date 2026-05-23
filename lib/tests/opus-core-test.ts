import { OpusCoreBrain, MatchContextInput } from "@/lib/OpusCoreBrain";

function buildTestScenario(): MatchContextInput {
  return {
    matchId: "TEST_MATCH_001",
    leagueId: "TEST_LEAGUE",

    winnerMatrix: {
      home: { label: "HOME_WIN", probability: 0.6, impliedOdds: 1.7 },
      away: { label: "AWAY_WIN", probability: 0.25, impliedOdds: 3.8 }
    },

    goalsMatrix: {
      over: { label: "OVER_25", probability: 0.62, impliedOdds: 1.55 },
      under: { label: "UNDER_25", probability: 0.38, impliedOdds: 2.2 }
    },

    cardsMatrix: {
      over: { label: "CARDS_OVER", probability: 0.57, impliedOdds: 1.8 }
    },

    cornersMatrix: {
      over: { label: "CORNERS_OVER", probability: 0.64, impliedOdds: 1.6 }
    }
  };
}

describe("OpusCoreBrain", () => {
  const brain = new OpusCoreBrain();

  it("should execute analysis without crashing", () => {
    const input = buildTestScenario();
    const result = brain.analyzeMatch(input);

    expect(result).toBeDefined();
    expect(result.approvedMarkets).toBeDefined();
  });

  it("should return deterministic hash", () => {
    const input = buildTestScenario();

    const r1 = brain.analyzeMatch(input);
    const r2 = brain.analyzeMatch(input);

    expect(r1.prediction_hash).toBe(r2.prediction_hash);
  });

  it("should never return NaN or Infinity in allocation", () => {
    const input = buildTestScenario();

    const result = brain.analyzeMatch(input);

    const state = result.allocation_state;

    expect(Number.isFinite(state.highest_detected_edge)).toBe(true);
    expect(Number.isFinite(state.total_unit_exposure)).toBe(true);
  });
});
