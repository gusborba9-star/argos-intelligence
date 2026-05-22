import {
  OpusCoreBrain,
  MatchContextInput
} from "../OpusCoreBrain";

const brain = new OpusCoreBrain();

const scenarios: MatchContextInput[] = [
  {
    matchId: "UNDER_MATCH_TEST",

    winnerMatrix: {
      home: {
        label: "HOME",
        probability: 0.38,
        impliedOdds: 2.50
      },

      draw: {
        label: "DRAW",
        probability: 0.32,
        impliedOdds: 3.10
      },

      away: {
        label: "AWAY",
        probability: 0.30,
        impliedOdds: 2.90
      }
    },

    goalsMatrix: {
      over25: {
        label: "OVER_25",
        probability: 0.41,
        impliedOdds: 1.85
      },

      under25: {
        label: "UNDER_25",
        probability: 0.59,
        impliedOdds: 2.15
      },

      bttsYes: {
        label: "BTTS_YES",
        probability: 0.42,
        impliedOdds: 1.80
      },

      bttsNo: {
        label: "BTTS_NO",
        probability: 0.58,
        impliedOdds: 2.05
      }
    },

    cardsMatrix: {
      over45: {
        label: "OVER_45",
        probability: 0.72,
        impliedOdds: 2.05
      },

      under45: {
        label: "UNDER_45",
        probability: 0.28,
        impliedOdds: 1.75
      }
    },

    cornersMatrix: {
      over95: {
        label: "OVER_95",
        probability: 0.46,
        impliedOdds: 1.90
      },

      under95: {
        label: "UNDER_95",
        probability: 0.54,
        impliedOdds: 1.95
      }
    },

    tacticalFrictionScore: 0.86,
    chaosIndex: 0.32,

    motivationIndexHome: 0.91,
    motivationIndexAway: 0.94
  },

  {
    matchId: "CHAOS_MATCH_TEST",

    winnerMatrix: {
      home: {
        label: "HOME",
        probability: 0.40,
        impliedOdds: 1.65
      },

      draw: {
        label: "DRAW",
        probability: 0.24,
        impliedOdds: 4.50
      },

      away: {
        label: "AWAY",
        probability: 0.36,
        impliedOdds: 5.10
      }
    },

    goalsMatrix: {
      over25: {
        label: "OVER_25",
        probability: 0.77,
        impliedOdds: 1.95
      },

      under25: {
        label: "UNDER_25",
        probability: 0.23,
        impliedOdds: 2.20
      },

      bttsYes: {
        label: "BTTS_YES",
        probability: 0.74,
        impliedOdds: 1.80
      },

      bttsNo: {
        label: "BTTS_NO",
        probability: 0.26,
        impliedOdds: 2.30
      }
    },

    cardsMatrix: {
      over45: {
        label: "OVER_45",
        probability: 0.81,
        impliedOdds: 2.00
      },

      under45: {
        label: "UNDER_45",
        probability: 0.19,
        impliedOdds: 1.70
      }
    },

    cornersMatrix: {
      over95: {
        label: "OVER_95",
        probability: 0.79,
        impliedOdds: 1.88
      },

      under95: {
        label: "UNDER_95",
        probability: 0.21,
        impliedOdds: 2.15
      }
    },

    tacticalFrictionScore: 0.34,
    chaosIndex: 0.91,

    motivationIndexHome: 0.96,
    motivationIndexAway: 0.97
  }
];

export function runLocalEngineTests() {
  return scenarios.map((scenario) => {
    return brain.analyzeMatch(scenario);
  });
        }
