import { NextResponse } from "next/server";
import { OpusCoreBrain, MatchContextInput } from "@/lib/core/opus-core";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function mock(): MatchContextInput[] {
  return [
    {
      matchId: "A1",
      leagueId: "EPL",
      winnerMatrix: {
        home: { label: "H", probability: 0.6, impliedOdds: 1.6 }
      },
      goalsMatrix: {
        over: { label: "O", probability: 0.7, impliedOdds: 1.5 }
      },
      cardsMatrix: {},
      cornersMatrix: {}
    }
  ];
}

export async function GET() {
  const brain = new OpusCoreBrain();

  const results = mock().map(m => brain.analyzeMatch(m));

  return NextResponse.json({
    ok: true,
    results
  });
}
