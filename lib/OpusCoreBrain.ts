import crypto from "crypto";

export const BASE_MIN_EDGE = 0.05;
export const SUBMARKET_HUNT_DISCOUNT = 0.85;
export const MAX_CLUSTER_EXPOSURE = 1.5;

export type MatchBehavior =
  | "CAOTICO_EXPLOSIVO"
  | "TRUNCADO_UNDER"
  | "EQUILIBRADO"
  | "AGRESSIVO"
  | "LIVE_ORIENTED";

export type AllocationTier =
  | "ELITE"
  | "TACTICAL"
  | "MICRO"
  | "FULL_VETO";

export type MarketVertical =
  | "WINNER"
  | "GOALS"
  | "CARDS"
  | "CORNERS";

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
  over05: MarketProbability;
  over15: MarketProbability;
  over25: MarketProbability;
  over35: MarketProbability;

  under15: MarketProbability;
  under25: MarketProbability;
  under35: MarketProbability;
  under45: MarketProbability;

  bttsYes: MarketProbability;
  bttsNo: MarketProbability;
}

export interface CardsMarket {
  over25: MarketProbability;
  over35: MarketProbability;
  over45: MarketProbability;
  over55: MarketProbability;

  under35: MarketProbability;
  under45: MarketProbability;
  under55: MarketProbability;
  under65: MarketProbability;
}

export interface CornersMarket {
  over75: MarketProbability;
  over85: MarketProbability;
  over95: MarketProbability;
  over105: MarketProbability;

  under85: MarketProbability;
  under95: MarketProbability;
  under105: MarketProbability;
  under115: MarketProbability;
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
}

export interface ApprovedMarket {
  vertical: MarketVertical;
  market: string;

  probability: number;
  impliedOdds: number;
  impliedProbability: number;

  edge: number;
  edgeQualityScore: number;
  expectedValue: number;
  confidence: number;

  allocationTier: AllocationTier;
  unitSize: number;
}

export interface ReasoningStructured {
  behaviorClassification: MatchBehavior;

  approvedMarkets: ApprovedMarket[];
  vetoedMarkets: string[];

  cascadeFlow: string[];

  huntModeActivated: boolean;

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
    highest_edge_quality_score: number;
    total_unit_exposure: number;
  };

  reasoning_structured: ReasoningStructured;

  created_at: string;
}

interface EdgeEvaluation {
  vertical: MarketVertical;
  market: string;

  probability: number;
  impliedOdds: number;
  impliedProbability: number;

  edge: number;
  edgeQualityScore: number;
  expectedValue: number;
  confidence: number;

  allocationTier: AllocationTier;
  unitSize: number;
}

export class OpusCoreBrain {
  private readonly MODEL_VERSION = "ARGOS_CORE_v6.0_INSTITUTIONAL";

  public analyzeMatch(
    input: MatchContextInput
  ): PredictionAuditOutput {
    const approvedMarkets: ApprovedMarket[] = [];
    const vetoedMarkets: string[] = [];
    const cascadeFlow: string[] = [];

    const behavior = this.classifyBehavior(
      input.tacticalFrictionScore,
      input.chaosIndex
    );

    cascadeFlow.push(`MATCH_CLASSIFIED_${behavior}`);

    const winnerResult = this.evaluateWinnerVertical(
      input.winnerMatrix,
      behavior
    );

    let huntModeActivated = false;

    if (winnerResult) {
      approvedMarkets.push({
        ...winnerResult
      });

      cascadeFlow.push("WINNER_APPROVED");
    } else {
      vetoedMarkets.push("WINNER_VETOED");
      cascadeFlow.push("WINNER_VETOED");

      huntModeActivated = true;
      cascadeFlow.push("SUBMARKET_HUNT_MODE_ACTIVATED");
    }

    const adjustedMinEdge = huntModeActivated
      ? BASE_MIN_EDGE * SUBMARKET_HUNT_DISCOUNT
      : BASE_MIN_EDGE;

    const adjustedGoals = this.applyUnderCompression(
      input.goalsMatrix,
      behavior,
      input.tacticalFrictionScore
    );

    const adjustedCards = this.applyCardsCalibration(
      input.cardsMatrix,
      input.tacticalFrictionScore,
      input.motivationIndexHome,
      input.motivationIndexAway
    );

    const adjustedCorners = this.applyCornersCalibration(
      input.cornersMatrix,
      input.chaosIndex,
      input.motivationIndexHome,
      input.motivationIndexAway
    );

    const goalsResult = this.findBestEdge(
      "GOALS",
      Object.values(adjustedGoals),
      adjustedMinEdge
    );

    if (goalsResult) {
      approvedMarkets.push({
        ...goalsResult
      });

      cascadeFlow.push("GOALS_APPROVED");
    } else {
      vetoedMarkets.push("GOALS_VETOED");
    }

    const cardsResult = this.findBestEdge(
      "CARDS",
      Object.values(adjustedCards),
      adjustedMinEdge
    );

    if (cardsResult) {
      approvedMarkets.push({
        ...cardsResult
      });

      cascadeFlow.push("CARDS_APPROVED");
    } else {
      vetoedMarkets.push("CARDS_VETOED");
    }

    const cornersResult = this.findBestEdge(
      "CORNERS",
      Object.values(adjustedCorners),
      adjustedMinEdge
    );

    if (cornersResult) {
      approvedMarkets.push({
        ...cornersResult
      });

      cascadeFlow.push("CORNERS_APPROVED");
    } else {
      vetoedMarkets.push("CORNERS_VETOED");
    }

    const exposureLimitedMarkets =
      this.applyCorrelationExposureLimiter(
        approvedMarkets
      );

    const globalTier =
      this.resolveGlobalTier(exposureLimitedMarkets);

    const highestEdge =
      exposureLimitedMarkets.length > 0
        ? Math.max(
            ...exposureLimitedMarkets.map(
              (m) => m.edge
            )
          )
        : 0;

    const highestEdgeQualityScore =
      exposureLimitedMarkets.length > 0
        ? Math.max(
            ...exposureLimitedMarkets.map(
              (m) => m.edgeQualityScore
            )
          )
        : 0;

    const totalExposure =
      exposureLimitedMarkets.reduce(
        (acc, market) => acc + market.unitSize,
        0
      );

    const reasoning: ReasoningStructured = {
      behaviorClassification: behavior,

      approvedMarkets: exposureLimitedMarkets,
      vetoedMarkets,

      cascadeFlow,

      huntModeActivated,

      contextualAnalysis: {
        tacticalFrictionScore:
          input.tacticalFrictionScore,

        chaosIndex: input.chaosIndex,

        motivationIndexHome:
          input.motivationIndexHome,

        motivationIndexAway:
          input.motivationIndexAway,

        marketVolatility:
          input.marketVolatility ?? 0.5,

        integrityScore:
          input.integrityScore ?? 0.95
      }
    };

    return {
      match_id: input.matchId,

      prediction_hash:
        this.generatePredictionHash({
          matchId: input.matchId,
          timestamp: Date.now()
        }),

      model_version: this.MODEL_VERSION,

      probability_matrix: {
        winner: input.winnerMatrix,
        goals: adjustedGoals,
        cards: adjustedCards,
        corners: adjustedCorners
      },

      allocation_state: {
        global_tier: globalTier,

        total_approved_markets:
          exposureLimitedMarkets.length,

        highest_detected_edge:
          Number(highestEdge.toFixed(4)),

        highest_edge_quality_score:
          Number(
            highestEdgeQualityScore.toFixed(4)
          ),

        total_unit_exposure:
          Number(totalExposure.toFixed(2))
      },

      reasoning_structured: reasoning,

      created_at: new Date().toISOString()
    };
  }

  private classifyBehavior(
    tacticalFrictionScore: number,
    chaosIndex: number
  ): MatchBehavior {
    if (chaosIndex > 0.7) {
      return "CAOTICO_EXPLOSIVO";
    }

    if (tacticalFrictionScore > 0.75) {
      return "TRUNCADO_UNDER";
    }

    if (
      chaosIndex > 0.55 &&
      tacticalFrictionScore < 0.45
    ) {
      return "AGRESSIVO";
    }

    if (
      tacticalFrictionScore > 0.55 &&
      chaosIndex < 0.45
    ) {
      return "LIVE_ORIENTED";
    }

    return "EQUILIBRADO";
  }

  private evaluateWinnerVertical(
    winner: WinnerMarket,
    behavior: MatchBehavior
  ): EdgeEvaluation | null {
    if (
      behavior === "CAOTICO_EXPLOSIVO" ||
      behavior === "TRUNCADO_UNDER"
    ) {
      return null;
    }

    const dnbHome =
      this.calculateDNB(
        winner.home,
        winner.draw,
        "HOME_DNB"
      );

    const dnbAway =
      this.calculateDNB(
        winner.away,
        winner.draw,
        "AWAY_DNB"
      );

    return this.findBestEdge(
      "WINNER",
      [
        winner.home,
        winner.draw,
        winner.away,
        dnbHome,
        dnbAway
      ],
      BASE_MIN_EDGE
    );
  }

  private calculateDNB(
    side: MarketProbability,
    draw: MarketProbability,
    label: string
  ): MarketProbability {
    const adjustedProbability =
      side.probability /
      (1 - draw.probability);

    const impliedOdds =
      1 / adjustedProbability;

    return {
      label,
      probability:
        Number(
          adjustedProbability.toFixed(4)
        ),

      impliedOdds:
        Number(impliedOdds.toFixed(4))
    };
  }

  private findBestEdge(
    vertical: MarketVertical,
    markets: MarketProbability[],
    minEdge: number
  ): EdgeEvaluation | null {
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

        const confidence =
          this.calculateConfidence(
            edge,
            expectedValue
          );

        const edgeQualityScore =
  this.calculateEdgeQualityScore(
    edge,
    expectedValue,
    confidence,
    market.impliedOdds
  );
        const allocation =
          this.calculateAllocation(
            edgeQualityScore
          );

        return {
          vertical,

          market: market.label,

          probability:
            Number(
              market.probability.toFixed(4)
            ),

          impliedOdds:
            Number(
              market.impliedOdds.toFixed(4)
            ),

          impliedProbability:
            Number(
              impliedProbability.toFixed(4)
            ),

          edge:
            Number(edge.toFixed(4)),

          edgeQualityScore:
            Number(
              edgeQualityScore.toFixed(4)
            ),

          expectedValue:
            Number(
              expectedValue.toFixed(4)
            ),

          confidence:
            Number(
              confidence.toFixed(4)
            ),

          allocationTier:
            allocation.tier,

          unitSize:
            allocation.unit
        };
      });

    const approved =
      evaluated.filter(
        (entry) =>
          entry.edge >= minEdge &&
          entry.expectedValue > 0
      );

    if (approved.length === 0) {
      return null;
    }

    approved.sort(
      (a, b) =>
        b.edgeQualityScore -
        a.edgeQualityScore
    );

    return approved[0];
  }

  private calculateConfidence(
    edge: number,
    expectedValue: number
  ): number {
    const confidence =
      edge * 1.5 +
      expectedValue * 0.75;

    return Math.max(
      0,
      Math.min(1, confidence)
    );
  }

  private normalizeProbability(
  probability: number
): number {

  return Math.min(
    0.93,
    Math.max(
      0.07,
      probability
    )
  );
}

private calculateEdgeQualityScore(
  edge: number,
  expectedValue: number,
  confidence: number,
  impliedOdds: number
): number {

  const normalizedConfidence =
    Math.sqrt(
      Math.max(confidence, 0)
    );

  const asymmetryBonus =
    Math.log(
      Math.max(impliedOdds, 1.01)
    );

  return Number(
    (
      edge * 0.35 +
      expectedValue * 0.35 +
      normalizedConfidence * 0.15 +
      asymmetryBonus * 0.15
    ).toFixed(4)
  );
}

private calculateAllocation(
  edgeQualityScore: number
) {

  if (edgeQualityScore >= 0.28) {
    return {
      tier: "ELITE" as AllocationTier,
      unit: 1.0
    };
  }

  if (edgeQualityScore >= 0.16) {
    return {
      tier: "TACTICAL" as AllocationTier,
      unit: 0.5
    };
  }

  return {
    tier: "MICRO" as AllocationTier,
    unit: 0.25
  };
}

private applyCorrelationExposureLimiter(
  markets: ApprovedMarket[]
): ApprovedMarket[] {

  const sorted = [...markets]
    .map((market) => {

      const asymmetryBonus =
        Math.log(
          Math.max(
            market.impliedOdds,
            1.01
          )
        );

      const exposurePriorityScore =
        (
          market.edgeQualityScore * 0.5 +
          market.expectedValue * 0.3 +
          asymmetryBonus * 0.2
        );

      return {
        ...market,
        exposurePriorityScore
      };
    })
    .sort(
      (a, b) =>
        b.exposurePriorityScore -
        a.exposurePriorityScore
    );

  const approved: ApprovedMarket[] = [];

  const verticals =
    new Set<string>();

  let totalExposure = 0;

  for (const market of sorted) {

    if (
      totalExposure + market.unitSize >
      MAX_CLUSTER_EXPOSURE
    ) {
      continue;
    }

    if (
      verticals.has(
        market.vertical
      )
    ) {
      continue;
    }

    approved.push(market);

    verticals.add(
      market.vertical
    );

    totalExposure +=
      market.unitSize;
  }

  return approved;
            }

  private applyUnderCompression(
    goals: GoalsMarket,
    behavior: MatchBehavior,
    friction: number
  ): GoalsMarket {
    if (
      behavior !== "TRUNCADO_UNDER"
    ) {
      return goals;
    }

    const compression =
      Math.min(
        0.18,
        friction * 0.14
      );

    const compress = (
      market: MarketProbability
    ): MarketProbability => ({
      ...market,

      probability:
        Number(
          Math.max(
            0.01,
            market.probability -
              compression
          ).toFixed(4)
        )
    });

    const expand = (
      market: MarketProbability
    ): MarketProbability => ({
      ...market,

      probability:
        Number(
          Math.min(
            0.99,
            market.probability +
              compression
          ).toFixed(4)
        )
    });

    return {
      over05: goals.over05,
      over15: compress(goals.over15),
      over25: compress(goals.over25),
      over35: compress(goals.over35),

      under15: expand(goals.under15),
      under25: expand(goals.under25),
      under35: expand(goals.under35),
      under45: expand(goals.under45),

      bttsYes: compress(goals.bttsYes),
      bttsNo: expand(goals.bttsNo)
    };
  }

  private applyCardsCalibration(
    cards: CardsMarket,
    friction: number,
    motivationHome: number,
    motivationAway: number
  ): CardsMarket {
    const boost =
      friction * 0.06 +
      ((motivationHome +
        motivationAway) /
        2) *
        0.04;

    const adjust = (
      market: MarketProbability
    ): MarketProbability => ({
      ...market,

      probability:
        Number(
          Math.min(
            0.99,
            market.probability +
              boost
          ).toFixed(4)
        )
    });

    return {
      over25: adjust(cards.over25),
      over35: adjust(cards.over35),
      over45: adjust(cards.over45),
      over55: adjust(cards.over55),

      under35: cards.under35,
      under45: cards.under45,
      under55: cards.under55,
      under65: cards.under65
    };
  }

  private applyCornersCalibration(
    corners: CornersMarket,
    chaosIndex: number,
    motivationHome: number,
    motivationAway: number
  ): CornersMarket {
    const boost =
      chaosIndex * 0.07 +
      ((motivationHome +
        motivationAway) /
        2) *
        0.03;

    const adjust = (
      market: MarketProbability
    ): MarketProbability => ({
      ...market,

      probability:
        Number(
          Math.min(
            0.99,
            market.probability +
              boost
          ).toFixed(4)
        )
    });

    return {
      over75: adjust(corners.over75),
      over85: adjust(corners.over85),
      over95: adjust(corners.over95),
      over105: adjust(corners.over105),

      under85: corners.under85,
      under95: corners.under95,
      under105: corners.under105,
      under115: corners.under115
    };
  }

  private resolveGlobalTier(
    markets: ApprovedMarket[]
  ): AllocationTier {
    if (markets.length === 0) {
      return "FULL_VETO";
    }

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
  }

