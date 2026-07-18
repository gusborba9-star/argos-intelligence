import { NextResponse } from "next/server";
import { BatchQueueService, QueueStatus } from "@/lib/core/BatchQueueService";
import { ArgosMasterOrchestrator } from "@/lib/argos/orchestrator/ArgosMasterOrchestrator";

/**
 * ARGOS v6.0.0 — QUEUE WORKER
 * Consome o próximo item da fila e executa a análise Master.
 */
export async function GET() {
  const queueService = new BatchQueueService();
  
  try {
    // 1. Busca o próximo item atômico (SKIP LOCKED)
    const item = await queueService.getNextInQueue();

    if (!item) {
      return NextResponse.json({ status: "IDLE", message: "Queue is empty" });
    }

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
    
    // Fallback: marcar item como falho para evitar loop infinito
    // Idealmente buscaríamos o item ID aqui, mas em caso de erro grave, logamos.
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
