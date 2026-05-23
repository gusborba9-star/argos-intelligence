import { NextResponse } from "next/server";
import { performance } from "perf_hooks";
import { OpusCoreBrain, MatchContextInput } from "@/lib/core/opus-core";

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
  data?: unknown;
  error?: string;
}

// MOCK DE CENÁRIOS OPERACIONAIS PARA VALIDAÇÃO DA ROTA DA API
function generateMockScenarios(): MatchContextInput[] {
  return [
    {
      matchId: "SCENARIO_PREMIUM_1",
      leagueId: "EPL",
      winnerMatrix: {
        home: { label: "HOME_WIN", probability: 0.58, impliedOdds: 1.65 },
        away: { label: "AWAY_WIN", probability: 0.22, impliedOdds: 4.20 }
      },
      goalsMatrix: {
        over: { label: "OVER_25", probability: 0.65, impliedOdds: 1.50 },
        under: { label: "UNDER_25", probability: 0.35, impliedOdds: 2.30 }
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
        home: { label: "HOME_WIN", probability: 0.33, impliedOdds: 2.90 },
        away: { label: "AWAY_WIN", probability: 0.34, impliedOdds: 2.80 }
      },
      goalsMatrix: {
        over: { label: "OVER_15", probability: 0.81, impliedOdds: 1.20 }
      },
      cardsMatrix: {},
      cornersMatrix: {}
    }
  ];
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
    // Inicializa o cérebro do Argos v13 diretamente na rota
    const brain = new OpusCoreBrain();
    const mockScenarios = generateMockScenarios();

    const processedResults = mockScenarios.map((input, index) => {
      const scenarioStart = performance.now();

      try {
        // Executa a análise real pelo Core do Argos
        const analysisResult = brain.analyzeMatch(input);

        const approvedMarkets = analysisResult.approvedMarkets || [];
        
        // No Argos v13 todos os mercados que não passam do corte (> 0.2) são filtrados,
        // gerando uma taxa de veto baseada na diferença de canônicos analisados vs aprovados.
        const totalInputMarkets = 
          Object.keys(input.winnerMatrix).length +
          Object.keys(input.goalsMatrix).length +
          Object.keys(input.cardsMatrix).length +
          Object.keys(input.cornersMatrix).length;

        const vetoedCount = Math.max(0, totalInputMarkets - approvedMarkets.length);

        const winnerApproved = approvedMarkets.some(
          (market: any) => market && market.vertical === "WINNER"
        );

        const highPrioritySubmarkets = approvedMarkets.filter(
          (market: any) =>
            market &&
            (market.vertical === "CARDS" ||
              market.vertical === "CORNERS" ||
              market.vertical === "GOALS")
        );

        aggregatedMetrics.approvedMarkets += approvedMarkets.length;
        aggregatedMetrics.vetoedMarkets += vetoedCount;
        aggregatedMetrics.profitableOpportunities += approvedMarkets.length;

        if (!winnerApproved && highPrioritySubmarkets.length > 0) {
          aggregatedMetrics.submarketOpportunities += highPrioritySubmarkets.length;
        }

        audits.push({
          scenarioId: input.matchId,
          status: "SUCCESS",
          executionTimeMs: Number(
            (performance.now() - scenarioStart).toFixed(2)
          ),
        });

        return {
          ...analysisResult,
          operationalAnalysis: {
            winnerMarketApproved: winnerApproved,
            operationalDensity: totalInputMarkets > 0
                ? Number((approvedMarkets.length / totalInputMarkets).toFixed(4))
                : 0,
            highPrioritySubmarkets: !winnerApproved ? highPrioritySubmarkets : [],
            antiSterilitySignal: !winnerApproved && highPrioritySubmarkets.length > 0
                ? "SUBMARKET_EDGE_REDISTRIBUTED"
                : "STANDARD_OPERATIONAL_FLOW",
          },
        };
      } catch (scenarioError) {
        const parsedError =
          scenarioError instanceof Error
            ? scenarioError.message
            : "UNKNOWN_SCENARIO_FAILURE";

        audits.push({
          scenarioId: input.matchId || `SCENARIO_${index + 1}`,
          status: "FAILED",
          executionTimeMs: Number(
            (performance.now() - scenarioStart).toFixed(2)
          ),
          error: parsedError,
        });

        return {
          scenarioId: input.matchId || `SCENARIO_${index + 1}`,
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
          totalVetoedMarkets: aggregatedMetrics.vetoedMetrics,
          profitableOpportunitiesFound: aggregatedMetrics.profitableOpportunities,
          redistributedSubmarketEdges: aggregatedMetrics.submarketOpportunities,
          approvalRate: (aggregatedMetrics.approvedMarkets + aggregatedMetrics.vetoedMarkets) > 0
              ? Number((aggregatedMetrics.approvedMarkets / (aggregatedMetrics.approvedMarkets + aggregatedMetrics.vetoedMarkets)).toFixed(4))
              : 0,
          vetoRate: (aggregatedMetrics.approvedMarkets + aggregatedMetrics.vetoedMetrics) > 0
              ? Number((aggregatedMetrics.vetoedMarkets / (aggregatedMetrics.approvedMarkets + aggregatedMetrics.vetoedMetrics)).toFixed(4))
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
          
