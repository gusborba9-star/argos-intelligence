import crypto from "crypto";

/* =========================================================
   ARGOS INTELLIGENCE — OPUS CORE BRAIN v4.0 INSTITUTIONAL
   Residual Edge Cascading Infrastructure
   ========================================================= */

export const MIN_EDGE = 0.05;
export const MAX_MATCH_EXPOSURE = 1.5;

export type MatchBehavior =
  | "CAOTICO_EXPLOSIVO"
  | "TRUNCADO_UNDER"
  | "AGRESSIVO"
  | "LIVE_ORIENTED"
  | "EQUILIBRADO";

export type AllocationTier =
  | "ELITE"
  | "TACTICAL"
  | "MICRO"
  | "NO_BET"
  | "FULL_VETO";

export interface MarketProbability {
  label: string;
  probability: number;
  impliedOdds: number;
}

export interface WinnerMarket {
  home: MarketProbability;
  draw: MarketProbability;
  away: MarketProbability;
}

export interface GoalsMarket {
  over25: MarketProbability;
  under25: MarketProbability;
  bttsYes: MarketProbability;
  bttsNo: MarketProbability;
}

export interface CardsMarket {
  over45: MarketProbability;
  under45: MarketProbability;
}

export interface CornersMarket {
  over95: MarketProbability;
  under95: MarketProbability;
}

export interface MatchContextInput {
  matchId: string;

  winnerMatrix: WinnerMarket;
  goalsMatrix: GoalsMarket;
  cardsMatrix: CardsMarket;
  cornersMatrix: CornersMarket;

  tacticalFrictionScore: number;
  chaosIndex: number;

  motivationIndexHome: number;
  motivationIndexAway: number;

  marketVolatility?: number;
  integrityScore?: number;

  winnerConfidence?: number;
  goalsConfidence?: number;
  cardsConfidence?: number;
  cornersConfidence?: number;
}

export interface ApprovedMarket {
  market: string;
  selection: string;

  probability: number;
  impliedOdds: number;

  impliedProbability: number;

  edge: number;
  expectedValue: number;

  confidence: number;

  allocationTier: AllocationTier;
  unitSize: number;
}

export interface ReasoningStructured {
  behaviorClassification: MatchBehavior;

  approvedMarkets: ApprovedMarket[];

  vetoedMarkets: string[];

  noBetMarkets: string[];

  cascadeFlow: string[];

  contextualAnalysis: {
    tacticalFrictionScore: number;
    chaosIndex: number;

    motivationIndexHome: number;
    motivationIndexAway: number;

    marketVolatility: number;
    integrityScore: number;
  };
}

export interface PredictionAuditOutput {
  match_id: string;

  prediction_hash: string;

  model_version: string;

  probability_matrix: {
    winner: WinnerMarket;
    goals: GoalsMarket;
    cards: CardsMarket;
    corners: CornersMarket;
  };

  allocation_state: {
    global_tier: AllocationTier;

    total_approved_markets: number;

    highest_detected_edge: number;

    highest_expected_value: number;

    total_unit_exposure: number;
  };

  reasoning_structured: ReasoningStructured;

  created_at: string;
}

export class OpusCoreBrain {
  private readonly MODEL_VERSION =
    "ARGOS_CORE_v4.0_INSTITUTIONAL";

  public analyzeMatch(
    input: MatchContextInput
  ): PredictionAuditOutput {
    const approvedMarkets: ApprovedMarket[] = [];

    const vetoedMarkets: string[] = [];

    const noBetMarkets: string[] = [];

    const cascadeFlow: string[] = [];

    /* =====================================================
       STEP 1 — MATCH BEHAVIOR CLASSIFICATION
       ===================================================== */

    const behavior =
      this.classifyBehavior(
        input.tacticalFrictionScore,
        input.chaosIndex
      );

    cascadeFlow.push(
      `MATCH_CLASSIFIED_${behavior}`
    );

    const adjustedGoals =
      this.applyUnderCompression(
        input.goalsMatrix,
        behavior,
        input.tacticalFrictionScore
      );

    const adjustedCards =
      this.applyCardsCalibration(
        input.cardsMatrix,
        input.tacticalFrictionScore,
        input.motivationIndexHome,
        input.motivationIndexAway
      );

    const adjustedCorners =
      this.applyCornersCalibration(
        input.cornersMatrix,
        input.chaosIndex,
        input.motivationIndexHome,
        input.motivationIndexAway
      );

    /* =====================================================
       STEP 2 — WINNER CASCADE
       ===================================================== */

    let cascadeResolved = false;

    if (behavior !== "CAOTICO_EXPLOSIVO") {
      cascadeFlow.push("START_WINNER_ANALYSIS");

      const winnerEdge =
        this.findBestEdge(
          [
            input.winnerMatrix.home,
            input.winnerMatrix.draw,
            input.winnerMatrix.away,
          ],
          input.winnerConfidence ?? 0.65
        );

      if (winnerEdge) {
        const allocation =
          this.calculateAllocation(
            winnerEdge.edge,
            winnerEdge.expectedValue
          );

        approvedMarkets.push({
          market: "WINNER",

          selection:
            winnerEdge.market.label,

          probability:
            winnerEdge.market.probability,

          impliedOdds:
            winnerEdge.market.impliedOdds,

          impliedProbability:
            winnerEdge.impliedProbability,

          edge: winnerEdge.edge,

          expectedValue:
            winnerEdge.expectedValue,

          confidence:
            winnerEdge.confidence,

          allocationTier:
            allocation.tier,

          unitSize:
            allocation.unit,
        });

        cascadeFlow.push(
          "WINNER_APPROVED"
        );

        cascadeResolved = true;
      } else {
        vetoedMarkets.push(
          "VETO_WINNER"
        );

        cascadeFlow.push(
          "CASCADE_TO_GOALS"
        );
      }
    } else {
      vetoedMarkets.push(
        "WINNER_BLOCKED_CHAOS"
      );

      cascadeFlow.push(
        "WINNER_SKIPPED_DUE_TO_CHAOS"
      );
    }

    /* =====================================================
       STEP 3 — GOALS CASCADE
       ===================================================== */

    if (!cascadeResolved) {
      cascadeFlow.push(
        "START_GOALS_ANALYSIS"
      );

      const goalsEdge =
        this.findBestEdge(
          [
            adjustedGoals.over25,
            adjustedGoals.under25,
            adjustedGoals.bttsYes,
            adjustedGoals.bttsNo,
          ],
          input.goalsConfidence ?? 0.67
        );

      if (goalsEdge) {
        const allocation =
          this.calculateAllocation(
            goalsEdge.edge,
            goalsEdge.expectedValue
          );

        approvedMarkets.push({
          market: "GOALS",

          selection:
            goalsEdge.market.label,

          probability:
            goalsEdge.market.probability,

          impliedOdds:
            goalsEdge.market.impliedOdds,

          impliedProbability:
            goalsEdge.impliedProbability,

          edge:
            goalsEdge.edge,

          expectedValue:
            goalsEdge.expectedValue,

          confidence:
            goalsEdge.confidence,

          allocationTier:
            allocation.tier,

          unitSize:
            allocation.unit,
        });

        cascadeFlow.push(
          "GOALS_APPROVED"
        );

        cascadeResolved = true;
      } else {
        vetoedMarkets.push(
          "VETO_GOALS"
        );

        cascadeFlow.push(
          "CASCADE_TO_REACTIVE_MARKETS"
        );
      }
    }

    /* =====================================================
       STEP 4 — REACTIVE MARKETS
       Cards + Corners allowed together only
       under structural correlation
       ===================================================== */

    if (!cascadeResolved) {
      const correlationScore =
        this.calculateCorrelationScore(
          input.tacticalFrictionScore,
          input.chaosIndex,
          input.motivationIndexHome,
          input.motivationIndexAway
        );

      cascadeFlow.push(
        `CORRELATION_SCORE_${correlationScore.toFixed(
          2
        )}`
      );

      /* =========================
         CARDS
         ========================= */

      const cardsEdge =
        this.findBestEdge(
          [
            adjustedCards.over45,
            adjustedCards.under45,
          ],
          input.cardsConfidence ?? 0.63
        );

      if (
        cardsEdge &&
        correlationScore >= 0.55
      ) {
        const allocation =
          this.calculateAllocation(
            cardsEdge.edge,
            cardsEdge.expectedValue
          );

        approvedMarkets.push({
          market: "CARDS",

          selection:
            cardsEdge.market.label,

          probability:
            cardsEdge.market.probability,

          impliedOdds:
            cardsEdge.market.impliedOdds,

          impliedProbability:
            cardsEdge.impliedProbability,

          edge:
            cardsEdge.edge,

          expectedValue:
            cardsEdge.expectedValue,

          confidence:
            cardsEdge.confidence,

          allocationTier:
            allocation.tier,

          unitSize:
            allocation.unit,
        });

        cascadeFlow.push(
          "CARDS_APPROVED"
        );
      } else {
        noBetMarkets.push(
          "NO_EDGE_CARDS"
        );
}
  
      /* =========================
         CORNERS
         ========================= */

      const cornersEdge =
        this.findBestEdge(
          [
            adjustedCorners.over95,
            adjustedCorners.under95,
          ],
          input.cornersConfidence ?? 0.62
        );

      if (
        cornersEdge &&
        correlationScore >= 0.55
      ) {
        const allocation =
          this.calculateAllocation(
            cornersEdge.edge,
            cornersEdge.expectedValue
          );

        approvedMarkets.push({
          market: "CORNERS",

          selection:
            cornersEdge.market.label,

          probability:
            cornersEdge.market.probability,

          impliedOdds:
            cornersEdge.market.impliedOdds,

          impliedProbability:
            cornersEdge.impliedProbability,

          edge:
            cornersEdge.edge,

          expectedValue:
            cornersEdge.expectedValue,

          confidence:
            cornersEdge.confidence,

          allocationTier:
            allocation.tier,

          unitSize:
            allocation.unit,
        });

        cascadeFlow.push(
          "CORNERS_APPROVED"
        );
      } else {
        noBetMarkets.push(
          "NO_EDGE_CORNERS"
        );
      }
    }

    /* =====================================================
       STEP 5 — EXPOSURE PROTECTION
       ===================================================== */

    const protectedMarkets =
      this.applyExposureProtection(
        approvedMarkets
      );

    if (
      protectedMarkets.length === 0
    ) {
      cascadeFlow.push(
        "FULL_VETO_TRIGGERED"
      );
    }

    /* =====================================================
       OUTPUT
       ===================================================== */

    return this.compileOutput({
      input,

      approvedMarkets:
        protectedMarkets,

      vetoedMarkets,

      noBetMarkets,

      cascadeFlow,

      behavior,

      adjustedGoals,

      adjustedCards,

      adjustedCorners,
    });
  }

  /* =====================================================
     CLASSIFICATION ENGINE
     ===================================================== */

  private classifyBehavior(
    tacticalFrictionScore: number,
    chaosIndex: number
  ): MatchBehavior {
    if (chaosIndex >= 0.72)
      return "CAOTICO_EXPLOSIVO";

    if (
      tacticalFrictionScore >= 0.75
    )
      return "TRUNCADO_UNDER";

    if (
      chaosIndex >= 0.58 &&
      tacticalFrictionScore <= 0.45
    )
      return "AGRESSIVO";

    if (
      tacticalFrictionScore >= 0.58 &&
      chaosIndex <= 0.45
    )
      return "LIVE_ORIENTED";

    return "EQUILIBRADO";
  }

  /* =====================================================
     UNDER COMPRESSION ENGINE
     ===================================================== */

  private applyUnderCompression(
    goals: GoalsMarket,
    behavior: MatchBehavior,
    friction: number
  ): GoalsMarket {
    if (
      behavior !== "TRUNCADO_UNDER"
    )
      return goals;

    const shift =
      Math.min(
        0.15,
        friction * 0.12
      );

    const over25 =
      this.clampProbability(
        goals.over25.probability -
          shift
      );

    const bttsYes =
      this.clampProbability(
        goals.bttsYes.probability -
          shift
      );

    return {
      over25: {
        ...goals.over25,
        probability: over25,
      },

      under25: {
        ...goals.under25,
        probability:
          this.normalizeInverse(
            over25
          ),
      },

      bttsYes: {
        ...goals.bttsYes,
        probability: bttsYes,
      },

      bttsNo: {
        ...goals.bttsNo,
        probability:
          this.normalizeInverse(
            bttsYes
          ),
      },
    };
  }

  /* =====================================================
     CARDS CALIBRATION
     ===================================================== */

  private applyCardsCalibration(
    cards: CardsMarket,
    friction: number,
    motHome: number,
    motAway: number
  ): CardsMarket {
    const motivation =
      (motHome + motAway) / 2;

    const boost =
      friction * 0.07 +
      motivation * 0.03;

    const over45 =
      this.clampProbability(
        cards.over45.probability +
          boost
      );

    return {
      over45: {
        ...cards.over45,
        probability: over45,
      },

      under45: {
        ...cards.under45,
        probability:
          this.normalizeInverse(
            over45
          ),
      },
    };
  }

  /* =====================================================
     CORNERS CALIBRATION
     ===================================================== */

  private applyCornersCalibration(
    corners: CornersMarket,
    chaos: number,
    motHome: number,
    motAway: number
  ): CornersMarket {
    const motivation =
      (motHome + motAway) / 2;

    const boost =
      chaos * 0.06 +
      motivation * 0.04;

    const over95 =
      this.clampProbability(
        corners.over95.probability +
          boost
      );

    return {
      over95: {
        ...corners.over95,
        probability: over95,
      },

      under95: {
        ...corners.under95,
        probability:
          this.normalizeInverse(
            over95
          ),
      },
    };
  }

  /* =====================================================
     EDGE ENGINE
     ===================================================== */

  private findBestEdge(
    markets: MarketProbability[],
    confidence: number
  ) {
    const evaluated =
      markets.map((market) => {
        const impliedProbability =
          1 / market.impliedOdds;

        const edge =
          market.probability -
          impliedProbability;

        const expectedValue =
          market.probability *
            market.impliedOdds -
          1;

        return {
          market,

          impliedProbability,

          edge,

          expectedValue,

          confidence,
        };
      });

    const valid =
      evaluated.filter(
        (entry) =>
          entry.edge >= MIN_EDGE &&
          entry.expectedValue > 0 &&
          entry.confidence >= 0.60
      );

    if (valid.length === 0)
      return null;

    return valid.sort(
      (a, b) =>
        b.expectedValue -
        a.expectedValue
    )[0];
  }

  /* =====================================================
     DYNAMIC ALLOCATION ENGINE
     ===================================================== */

  private calculateAllocation(
    edge: number,
    ev: number
  ) {
    if (
      edge >= 0.18 &&
      ev >= 0.22
    ) {
      return {
        tier:
          "ELITE" as AllocationTier,
        unit: 1.0,
      };
    }

    if (
      edge >= 0.10 &&
      ev >= 0.12
    ) {
      return {
        tier:
          "TACTICAL" as AllocationTier,
        unit: 0.5,
      };
    }

    return {
      tier:
        "MICRO" as AllocationTier,
      unit: 0.25,
    };
  }

  /* =====================================================
     CORRELATION ENGINE
     ===================================================== */

  private calculateCorrelationScore(
    friction: number,
    chaos: number,
    motHome: number,
    motAway: number
  ): number {
    const motivation =
      (motHome + motAway) / 2;

    const score =
      chaos * 0.45 +
      friction * 0.35 +
      motivation * 0.20;

    return Number(
      Math.min(
        1,
        Math.max(0, score)
      ).toFixed(4)
    );
  }

  /* =====================================================
     EXPOSURE SHIELD
     ===================================================== */

  private applyExposureProtection(
    markets: ApprovedMarket[]
  ): ApprovedMarket[] {
    const sorted =
      [...markets].sort(
        (a, b) =>
          b.expectedValue -
          a.expectedValue
      );

    const approved: ApprovedMarket[] =
      [];

    let exposure = 0;

    for (const market of sorted) {
      if (
        exposure +
          market.unitSize <=
        MAX_MATCH_EXPOSURE
      ) {
        approved.push(market);

        exposure +=
          market.unitSize;
      }
    }

    return approved;
  }

  /* =====================================================
     HELPERS
     ===================================================== */

  private clampProbability(
    value: number
  ): number {
    return Number(
      Math.min(
        0.99,
        Math.max(0.01, value)
      ).toFixed(4)
    );
  }

  private normalizeInverse(
    value: number
  ): number {
    return Number(
      (1 - value).toFixed(4)
    );
  }

  private generatePredictionHash(
    payload: unknown
  ): string {
    return crypto
      .createHash("sha256")
      .update(
        JSON.stringify(payload)
      )
      .digest("hex");
  }

  private resolveGlobalTier(
    markets: ApprovedMarket[]
  ): AllocationTier {
    if (markets.length === 0)
      return "FULL_VETO";

    if (
      markets.some(
        (m) =>
          m.allocationTier ===
          "ELITE"
      )
    ) {
      return "ELITE";
    }

    if (
      markets.some(
        (m) =>
          m.allocationTier ===
          "TACTICAL"
      )
    ) {
      return "TACTICAL";
    }

    return "MICRO";
  }

  /* =====================================================
     OUTPUT COMPILER
     ===================================================== */

  private compileOutput({
    input,

    approvedMarkets,

    vetoedMarkets,

    noBetMarkets,

    cascadeFlow,

    behavior,

    adjustedGoals,

    adjustedCards,

    adjustedCorners,
  }: {
    input: MatchContextInput;

    approvedMarkets: ApprovedMarket[];

    vetoedMarkets: string[];

    noBetMarkets: string[];

    cascadeFlow: string[];

    behavior: MatchBehavior;

    adjustedGoals: GoalsMarket;

    adjustedCards: CardsMarket;

    adjustedCorners: CornersMarket;
  }): PredictionAuditOutput {
    const highestEdge =
      approvedMarkets.length > 0
        ? Math.max(
            ...approvedMarkets.map(
              (m) => m.edge
            )
          )
        : 0;

    const highestEV =
      approvedMarkets.length > 0
        ? Math.max(
            ...approvedMarkets.map(
              (m) =>
                m.expectedValue
            )
          )
        : 0;

    const totalExposure =
      approvedMarkets.reduce(
        (acc, market) =>
          acc + market.unitSize,
        0
      );

    return {
      match_id: input.matchId,

      prediction_hash:
        this.generatePredictionHash({
          matchId:
            input.matchId,

          timestamp:
            Date.now(),

          behavior,
        }),

      model_version:
        this.MODEL_VERSION,

      probability_matrix: {
        winner:
          input.winnerMatrix,

        goals:
          adjustedGoals,

        cards:
          adjustedCards,

        corners:
          adjustedCorners,
      },

      allocation_state: {
        global_tier:
          this.resolveGlobalTier(
            approvedMarkets
          ),

        total_approved_markets:
          approvedMarkets.length,

        highest_detected_edge:
          Number(
            highestEdge.toFixed(4)
          ),

        highest_expected_value:
          Number(
            highestEV.toFixed(4)
          ),

        total_unit_exposure:
          Number(
            totalExposure.toFixed(2)
          ),
      },

      reasoning_structured: {
        behaviorClassification:
          behavior,

        approvedMarkets,

        vetoedMarkets,

        noBetMarkets,

        cascadeFlow,

        contextualAnalysis: {
          tacticalFrictionScore:
            input.tacticalFrictionScore,

          chaosIndex:
            input.chaosIndex,

          motivationIndexHome:
            input.motivationIndexHome,

          motivationIndexAway:
            input.motivationIndexAway,

          marketVolatility:
            input.marketVolatility ??
            0.5,

          integrityScore:
            input.integrityScore ??
            0.95,
        },
      },

      created_at:
        new Date().toISOString(),
    };
  }
    }
