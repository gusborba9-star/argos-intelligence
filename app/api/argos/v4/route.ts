import { NextResponse } from "next/server";
import { ArgosOrchestratorV4 } from "@/lib/argos/orchestrator/ArgosOrchestratorV4";
import { BatchQueueService } from "@/lib/core/BatchQueueService";

// ============================================================
// ARGOS API v4.5 — ZERO-TOUCH & BATCH ENDPOINT
// Endpoint consolidado para auditoria autônoma e em lote
// ============================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { matchId, requestedVerticals, mode = "DIRECT" } = body;

    if (!matchId || !requestedVerticals) {
      return NextResponse.json({ error: "matchId e requestedVerticals são obrigatórios" }, { status: 400 });
    }

    const orchestrator = new ArgosOrchestratorV4();

    // MODO BATCH: Adiciona à fila e retorna imediatamente (Ideal para auditorias massivas na Vercel)
    if (mode === "BATCH") {
      const queueService = new BatchQueueService();
      const queueId = await queueService.enqueue(matchId, requestedVerticals);
      return NextResponse.json({ 
        status: "QUEUED", 
        queueId,
        message: "O jogo foi adicionado à fila de processamento industrial." 
      });
    }

    // MODO DIRECT: Processamento imediato (Zero-Touch)
    const result = await orchestrator.runZeroTouchAudit(matchId, requestedVerticals);

    return NextResponse.json(result);

  } catch (error: any) {
    console.error("[Argos API v4.5] Fatal Error:", error);
    return NextResponse.json({ 
      status: "FAILED", 
      error: error.message 
    }, { status: 500 });
  }
}

/**
 * Endpoint GET para processar o próximo item da fila (Worker Trigger)
 */
export async function GET() {
  try {
    const queueService = new BatchQueueService();
    const nextItem = await queueService.getNextInQueue();

    if (!nextItem) {
      return NextResponse.json({ message: "Fila vazia. Nenhum jogo para processar." });
    }

    const orchestrator = new ArgosOrchestratorV4();
    const result = await orchestrator.runZeroTouchAudit(nextItem.matchId, nextItem.requestedVerticals);

    await queueService.updateStatus(nextItem.id, "COMPLETED");

    return NextResponse.json({ 
      status: "SUCCESS", 
      matchId: nextItem.matchId, 
      result 
    });

  } catch (error: any) {
    console.error("[Argos API v4.5] Queue Processing Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
