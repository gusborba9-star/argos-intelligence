import { NextRequest, NextResponse } from "next/server";
import { BatchQueueService, QueueStatus } from "@/lib/core/BatchQueueService";
import { ArgosMasterOrchestrator } from "@/lib/argos/orchestrator/ArgosMasterOrchestrator";

/**
 * ARGOS v6.0.0 — QUEUE WORKER
 * Consome o próximo item da fila e executa a análise Master.
 * Protegido por ARGOS_API_KEY (chamado pelo pg_cron/pg_net do Supabase).
 */
export async function GET(req: NextRequest) {
  const key = req.headers.get("x-api-key") || new URL(req.url).searchParams.get("key");
  if (key !== process.env.ARGOS_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const queueService = new BatchQueueService();
  let currentItemId: string | null = null;

  try {
    // 1. Busca o próximo item atômico (SKIP LOCKED)
    const item = await queueService.getNextInQueue();

    if (!item) {
      return NextResponse.json({ status: "IDLE", message: "Queue is empty" });
    }

    currentItemId = item.id;

    // 2. Executa a análise via Master Orchestrator (Single-Pass)
    // O item já contém o raw_data necessário
    const result = await ArgosMasterOrchestrator.run(item.matchId, item.rawData);

    // 3. Marca como concluído
    await queueService.updateStatus(item.id, QueueStatus.COMPLETED);

    return NextResponse.json({
      status: "SUCCESS",
      matchId: item.matchId,
      result
    });
  } catch (error: any) {
    console.error("[Worker-v6] Error:", error.message);

    // Marca o item como FAILED para não travar a fila em PROCESSING para sempre
    if (currentItemId) {
      await queueService.updateStatus(currentItemId, QueueStatus.FAILED, error.message);
    }

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
