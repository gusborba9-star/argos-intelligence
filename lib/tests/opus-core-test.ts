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
      over05: {
        label: "OVER_05",
        probability: 0.91,
        impliedOdds: 1.12
      },

      over15: {
        label: "OVER_15",
        probability: 0.72,
        impliedOdds: 1.42
      },

      over25: {
        label: "OVER_25",
        probability: 0.41,
        impliedOdds: 2.60
      },

      over35: {
        label: "OVER_35",
        probability: 0.24,
        impliedOdds: 4.10
      },

      under15: {
        label: "UNDER_15",
        probability: 0.28,
        impliedOdds: 3.30
      },

      under25: {
        label: "UNDER_25",
        probability: 0.59,
        impliedOdds: 2.05
      },

      under35: {
        label: "UNDER_35",
        probability: 0.78,
        impliedOdds: 1.48
      },

      under45: {
        label: "UNDER_45",
        probability: 0.89,
        impliedOdds: 1.18
      },

      bttsYes: {
        label: "BTTS_YES",
        probability: 0.44,
        impliedOdds: 2.25
      },

      bttsNo: {
        label: "BTTS_NO",
        probability: 0.56,
        impliedOdds: 1.92
      }
    },

    cardsMatrix: {
      over25: {
        label: "CARDS_OVER_25",
        probability: 0.71,
        impliedOdds: 1.45
      },

      over35: {
        label: "CARDS_OVER_35",
        probability: 0.58,
        impliedOdds: 1.78
      },

      over45: {
        label: "CARDS_OVER_45",
        probability: 0.44,
        impliedOdds: 2.25
      },

      over55: {
        label: "CARDS_OVER_55",
        probability: 0.31,
        impliedOdds: 3.40
      },

      under35: {
        label: "CARDS_UNDER_35",
        probability: 0.42,
        impliedOdds: 2.35
      },

      under45: {
        label: "CARDS_UNDER_45",
        probability: 0.56,
        impliedOdds: 1.95
      },

      under55: {
        label: "CARDS_UNDER_55",
        probability: 0.72,
        impliedOdds: 1.44
      },

      under65: {
        label: "CARDS_UNDER_65",
        probability: 0.83,
        impliedOdds: 1.21
      }
    },

    cornersMatrix: {
      over75: {
        label: "CORNERS_OVER_75",
        probability: 0.73,
        impliedOdds: 1.42
      },

      over85: {
        label: "CORNERS_OVER_85",
        probability: 0.61,
        impliedOdds: 1.72
      },

      over95: {
        label: "CORNERS_OVER_95",
        probability: 0.48,
        impliedOdds: 2.05
      },

      over105: {
        label: "CORNERS_OVER_105",
        probability: 0.34,
        impliedOdds: 3.10
      },

      under85: {
        label: "CORNERS_UNDER_85",
        probability: 0.39,
        impliedOdds: 2.50
      },

      under95: {
        label: "CORNERS_UNDER_95",
        probability: 0.52,
        impliedOdds: 1.92
      },

      under105: {
        label: "CORNERS_UNDER_105",
        probability: 0.69,
        impliedOdds: 1.51
      },

      under115: {
        label: "CORNERS_UNDER_115",
        probability: 0.82,
        impliedOdds: 1.26
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
      over05: {
        label: "OVER_05",
        probability: 0.97,
        impliedOdds: 1.05
      },

      over15: {
        label: "OVER_15",
        probability: 0.88,
        impliedOdds: 1.22
      },

      over25: {
        label: "OVER_25",
        probability: 0.77,
        impliedOdds: 1.95
      },

      over35: {
        label: "OVER_35",
        probability: 0.58,
        impliedOdds: 2.90
      },

      under15: {
        label: "UNDER_15",
        probability: 0.12,
        impliedOdds: 6.10
      },

      under25: {
        label: "UNDER_25",
        probability: 0.23,
        impliedOdds: 4.20
      },

      under35: {
        label: "UNDER_35",
        probability: 0.42,
        impliedOdds: 2.60
      },

      under45: {
        label: "UNDER_45",
        probability: 0.61,
        impliedOdds: 1.82
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
      over25: {
        label: "CARDS_OVER_25",
        probability: 0.89,
        impliedOdds: 1.21
      },

      over35: {
        label: "CARDS_OVER_35",
        probability: 0.82,
        impliedOdds: 1.46
      },

      over45: {
        label: "CARDS_OVER_45",
        probability: 0.81,
        impliedOdds: 2.00
      },

      over55: {
        label: "CARDS_OVER_55",
        probability: 0.62,
        impliedOdds: 2.95
      },

      under35: {
        label: "CARDS_UNDER_35",
        probability: 0.18,
        impliedOdds: 4.60
      },

      under45: {
        label: "CARDS_UNDER_45",
        probability: 0.19,
        impliedOdds: 1.70
      },

      under55: {
        label: "CARDS_UNDER_55",
        probability: 0.38,
        impliedOdds: 2.15
      },

      under65: {
        label: "CARDS_UNDER_65",
        probability: 0.51,
        impliedOdds: 1.75
      }
    },

    cornersMatrix: {
      over75: {
        label: "CORNERS_OVER_75",
        probability: 0.94,
        impliedOdds: 1.14
      },

      over85: {
        label: "CORNERS_OVER_85",
        probability: 0.87,
        impliedOdds: 1.32
      },

      over95: {
        label: "CORNERS_OVER_95",
        probability: 0.79,
        impliedOdds: 1.88
      },

      over105: {
        label: "CORNERS_OVER_105",
        probability: 0.63,
        impliedOdds: 2.65
      },

      under85: {
        label: "CORNERS_UNDER_85",
        probability: 0.13,
        impliedOdds: 5.40
      },

      under95: {
        label: "CORNERS_UNDER_95",
        probability: 0.21,
        impliedOdds: 2.15
      },

      under105: {
        label: "CORNERS_UNDER_105",
        probability: 0.37,
        impliedOdds: 2.05
      },

      under115: {
        label: "CORNERS_UNDER_115",
        probability: 0.48,
        impliedOdds: 1.78
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
