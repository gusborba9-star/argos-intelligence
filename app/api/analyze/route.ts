import { NextResponse } from "next/server";
import { runLocalEngineTests } from "../../../lib/tests/opus-core-test";

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
  data?: unknown;
  error?: string;
}

export async function GET(_request: Request) {
  const startedAt = performance.now();
  const audits: ScenarioAudit[] = [];

  const aggregatedMetrics: ScenarioMetrics = {
    approvedMarkets: 0,
    vetoedMarkets: 0,
    profitableOpportunities: 0,
    submarketOpportunities: 0,
  };

  try {
    const rawResults = await Promise.resolve(runLocalEngineTests());
    const safeResults = Array.isArray(rawResults) ? rawResults : [rawResults];

    const processedResults = safeResults.map((scenario: any, index: number) => {
      const scenarioStart = performance.now();

      try {
        // Fallback dinâmico para garantir mapeamento correto dos dados do Argos
        const reasoning = scenario?.reasoning_structured || scenario || {};

        const approvedMarkets = Array.isArray(reasoning?.approvedMarkets)
          ? reasoning.approvedMarkets
          : Array.isArray(scenario?.approvedMarkets) ? scenario.approvedMarkets : [];

        const vetoedMarkets = Array.isArray(reasoning?.vetoedMarkets)
          ? reasoning.vetoedMarkets
          : Array.isArray(scenario?.vetoedMarkets) ? scenario.vetoedMarkets : [];

        const winnerApproved = approvedMarkets.some(
          (market: any) => market && (market.market === "WINNER" || market.type === "WINNER")
        );

        const highPrioritySubmarkets = approvedMarkets.filter(
          (market: any) => market && (market.market === "CARDS" || market.market === "CORNERS" || market.market === "GOALS")
        );

        aggregatedMetrics.approvedMarkets += approvedMarkets.length;
        aggregatedMetrics.vetoedMarkets += vetoedMarkets.length;
        aggregatedMetrics.profitableOpportunities += approvedMarkets.length;

        if (!winnerApproved && highPrioritySubmarkets.length > 0) {
          aggregatedMetrics.submarketOpportunities += highPrioritySubmarkets.length;
        }

        audits.push({
          scenarioId: scenario?.match_id || scenario?.matchId || `SCENARIO_${index + 1}`,
          status: "SUCCESS",
          executionTimeMs: Number((performance.now() - scenarioStart).toFixed(2)),
        });

        return {
          ...scenario,
          operationalAnalysis: {
            winnerMarketApproved: winnerApproved,
            operationalDensity: approvedMarkets.length > 0
              ? Number((approvedMarkets.length / (approvedMarkets.length + vetoedMarkets.length || 1)).toFixed(4))
              : 0,
            highPrioritySubmarkets: !winnerApproved ? highPrioritySubmarkets : [],
            antiSterilitySignal: !winnerApproved && highPrioritySubmarkets.length > 0
              ? "SUBMARKET_EDGE_REDISTRIBUTED"
              : "STANDARD_OPERATIONAL_FLOW",
          },
        };
      } catch (scenarioError) {
        const parsedError = scenarioError instanceof Error ? scenarioError.message : "UNKNOWN_SCENARIO_FAILURE";

        audits.push({
          scenarioId: `SCENARIO_${index + 1}`,
          status: "FAILED",
          executionTimeMs: Number((performance.now() - scenarioStart).toFixed(2)),
          error: parsedError,
        });

        return {
          scenarioId: `SCENARIO_${index + 1}`,
          status: "FAILED",
          error: parsedError,
        };
      }
    });

    const completedAt = performance.now();

    return NextResponse.json(
      {
        status: "success",
        environment: "Vercel Serverless (sa-east-1)",
        execution: {
          totalExecutionTimeMs: Number((completedAt - startedAt).toFixed(2)),
          scenariosProcessed: processedResults.length,
          auditFailures: audits.filter((audit) => audit.status === "FAILED").length,
        },
        metrics: {
          totalMarketsAnalyzed: aggregatedMetrics.approvedMarkets + aggregatedMetrics.vetoedMarkets,
          totalApprovedMarkets: aggregatedMetrics.approvedMarkets,
          totalVetoedMarkets: aggregatedMetrics.vetoedMarkets,
          profitableOpportunitiesFound: aggregatedMetrics.profitableOpportunities,
          redistributedSubmarketEdges: aggregatedMetrics.submarketOpportunities,
          approvalRate: aggregatedMetrics.approvedMarkets > 0
            ? Number((aggregatedMetrics.approvedMarkets / (aggregatedMetrics.approvedMarkets + aggregatedMetrics.vetoedMarkets || 1)).toFixed(4))
            : 0,
          vetoRate: aggregatedMetrics.vetoedMarkets > 0
            ? Number((aggregatedMetrics.vetoedMarkets / (aggregatedMetrics.approvedMarkets + aggregatedMetrics.vetoedMarkets || 1)).toFixed(4))
            : 0,
        },
        results: processedResults,
        internalAudit: audits,
      },
      { status: 200 }
    );
  } catch (fatalError) {
    const parsedError = fatalError instanceof Error ? fatalError.message : "UNKNOWN_FATAL_ERROR";

    return NextResponse.json(
      {
        status: "degraded",
        environment: "Vercel Serverless (sa-east-1)",
        fatalError: parsedError,
        metrics: {
          totalMarketsAnalyzed: 0,
          totalApprovedMarkets: 0,
          totalVetoedMarkets: 0,
          profitableOpportunitiesFound: 0,
          redistributedSubmarketEdges: 0,
        },
        results: [],
        internalAudit: [
          {
            scenarioId: "GLOBAL_ENGINE",
            status: "FAILED",
            executionTimeMs: Number((performance.now() - startedAt).toFixed(2)),
            error: parsedError,
          },
        ],
      },
      { status: 200 }
    );
  }
          }
                                   
