import { NextResponse } from "next/server";
import { OpusCoreBrain } from "@lib/OpusCoreBrain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ScenarioMetrics {
  approvedMarkets: number;
  vetoedMarkets: number;
  profitableOpportunities: number;
  submarketOpportunities: number;
}

interface ScenarioAudit {
  scenarioId: string;
  status: "SUCCESS" | "FAILED";
  executionTimeMs: number;
  error?: string;
}

function generateMockScenarios(): MatchContextInput[] {
  return [
    {
      matchId: "SCENARIO_PREMIUM_1",
      leagueId: "EPL",
      winnerMatrix: {
        home: { label: "HOME_WIN", probability: 0.58, impliedOdds: 1.65 },
        away: { label: "AWAY_WIN", probability: 0.22, impliedOdds: 4.2 }
      },
      goalsMatrix: {
        over: { label: "OVER_25", probability: 0.65, impliedOdds: 1.5 },
        under: { label: "UNDER_25", probability: 0.35, impliedOdds: 2.3 }
      },
      cardsMatrix: {
        over: { label: "CARDS_OVER_45", probability: 0.55, impliedOdds: 1.72 }
      },
      cornersMatrix: {
        over: { label: "CORNERS_OVER_95", probability: 0.62, impliedOdds: 1.55 }
      }
    },
    {
      matchId: "SCENARIO_TACTICAL_2",
      leagueId: "UCL",
      winnerMatrix: {
        home: { label: "HOME_WIN", probability: 0.33, impliedOdds: 2.9 },
        away: { label: "AWAY_WIN", probability: 0.34, impliedOdds: 2.8 }
      },
      goalsMatrix: {
        over: { label: "OVER_15", probability: 0.81, impliedOdds: 1.2 }
      },
      cardsMatrix: {},
      cornersMatrix: {}
    }
  ];
}

export async function GET() {
  const startedAt = Date.now();

  const audits: ScenarioAudit[] = [];

  const metrics: ScenarioMetrics = {
    approvedMarkets: 0,
    vetoedMarkets: 0,
    profitableOpportunities: 0,
    submarketOpportunities: 0
  };

  try {
    const brain = new OpusCoreBrain();
    const scenarios = generateMockScenarios();

    const results = scenarios.map((input, index) => {
      const t0 = Date.now();

      try {
        const output = brain.analyzeMatch(input);
        const approved = output.approvedMarkets ?? [];

        const totalMarkets =
          Object.keys(input.winnerMatrix).length +
          Object.keys(input.goalsMatrix).length +
          Object.keys(input.cardsMatrix).length +
          Object.keys(input.cornersMatrix).length;

        const vetoed = Math.max(0, totalMarkets - approved.length);

        const winnerApproved = approved.some(m => m.vertical === "WINNER");

        const submarkets = approved.filter(
          m =>
            m.vertical === "CARDS" ||
            m.vertical === "GOALS" ||
            m.vertical === "CORNERS"
        );

        metrics.approvedMarkets += approved.length;
        metrics.vetoedMarkets += vetoed;
        metrics.profitableOpportunities += approved.length;

        if (!winnerApproved) {
          metrics.submarketOpportunities += submarkets.length;
        }

        audits.push({
          scenarioId: input.matchId,
          status: "SUCCESS",
          executionTimeMs: Date.now() - t0
        });

        return {
          ...output,
          operationalAnalysis: {
            winnerMarketApproved: winnerApproved,
            operationalDensity:
              totalMarkets > 0 ? approved.length / totalMarkets : 0,
            highPrioritySubmarkets: !winnerApproved ? submarkets : [],
            antiSterilitySignal:
              !winnerApproved && submarkets.length > 0
                ? "SUBMARKET_EDGE_REDISTRIBUTED"
                : "STANDARD_OPERATIONAL_FLOW"
          }
        };
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "UNKNOWN_SCENARIO_ERROR";

        audits.push({
          scenarioId: input.matchId || `SCENARIO_${index}`,
          status: "FAILED",
          executionTimeMs: Date.now() - t0,
          error: message
        });

        return {
          scenarioId: input.matchId,
          status: "FAILED",
          error: message
        };
      }
    });

    const total = metrics.approvedMarkets + metrics.vetoedMarkets;

    return NextResponse.json({
      status: "success",
      environment: "vercel-nodejs",

      execution: {
        totalExecutionTimeMs: Date.now() - startedAt,
        scenariosProcessed: results.length,
        auditFailures: audits.filter(a => a.status === "FAILED").length
      },

      metrics: {
        totalMarketsAnalyzed: total,
        totalApprovedMarkets: metrics.approvedMarkets,
        totalVetoedMarkets: metrics.vetoedMarkets,
        profitableOpportunitiesFound: metrics.profitableOpportunities,
        redistributedSubmarketEdges: metrics.submarketOpportunities,
        approvalRate: total ? metrics.approvedMarkets / total : 0,
        vetoRate: total ? metrics.vetoedMarkets / total : 0
      },

      results,
      internalAudit: audits
    });
  } catch (fatal) {
    return NextResponse.json(
      {
        status: "degraded",
        error: fatal instanceof Error ? fatal.message : "UNKNOWN_FATAL_ERROR",
        executionTimeMs: Date.now() - startedAt
      },
      { status: 200 }
    );
  }
}
