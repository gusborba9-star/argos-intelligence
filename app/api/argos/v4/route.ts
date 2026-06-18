import { NextResponse } from "next/server";
import { ArgosOrchestratorV4 } from "@/lib/argos/orchestrator/ArgosOrchestratorV4";
import { BatchQueueService } from "@/lib/core/BatchQueueService";
import { ValueDeliveryService } from "@/lib/argos/delivery/ValueDeliveryService";
import { MarketVertical } from "@/lib/core/ArgosUnifiedEngine";

// ============================================================
// ARGOS API v4.5 — ZERO-TOUCH & BATCH ENDPOINT
// Endpoint consolidado para auditoria autônoma e em lote
// ============================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // Verificação de API Key para segurança da rota POST
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey || apiKey !== process.env.ARGOS_API_KEY) {
      return NextResponse.json({ error: "Unauthorized: Invalid or missing API Key" }, { status: 401 });
    }

    const body = await req.json();
    const { matchId, requestedVerticals, marketOdds, userId, mode = "DIRECT" } = body;

    if (!matchId || !requestedVerticals) {
      return NextResponse.json({ error: "matchId e requestedVerticals são obrigatórios" }, { status: 400 });
    }

    const orchestrator = new ArgosOrchestratorV4();
    const deliveryService = new ValueDeliveryService();

    // MODO BATCH: Adiciona à fila e retorna imediatamente (Ideal para auditorias massivas na Vercel)
    if (mode === "BATCH") {
      const queueService = new BatchQueueService();
      const queueId = await queueService.enqueue(matchId, requestedVerticals, userId);
      return NextResponse.json({ 
        status: "QUEUED", 
        queueId,
        message: "O jogo foi adicionado à fila de processamento industrial." 
      });
    }

    // MODO DIRECT: Processamento imediato (Zero-Touch)
    const auditResult = await orchestrator.runZeroTouchAudit(matchId, requestedVerticals, marketOdds);

    if (auditResult.status === "FAILED") {
      return NextResponse.json(auditResult, { status: 500 });
    }

    // Lógica de Tiers e Entrega de Valor
    let signalsToDeliver = auditResult.classifiedSignals || [];
    let userTier: 'FREE' | 'PRO' | 'WHALE/VIP' = 'FREE';
    let kellyStakes: { signalId: string, stake: number }[] = [];

    if (userId) {
      userTier = await deliveryService.getUserTier(userId);
      signalsToDeliver = deliveryService.filterSignalsByTier(signalsToDeliver, userTier);

      if (userTier === 'WHALE/VIP') {
        const bankroll = 1000; // Exemplo: 1000 unidades de banca para cálculo de Kelly
        kellyStakes = signalsToDeliver.map(signal => ({
          signalId: signal.id || '',
          stake: deliveryService.calculateKellyCriterion(signal, bankroll)
        }));
        // Logar a entrega para usuários WHALE/VIP
        for (const signal of signalsToDeliver) {
          if (signal.id) {
            await deliveryService.logSignalDelivery(userId, signal, userTier, 'API_DIRECT');
          }
        }
      }
    }

    return NextResponse.json({
      matchId: auditResult.matchId,
      status: auditResult.status,
      regime: auditResult.regime,
      signals: signalsToDeliver,
      userTier,
      kellyStakes: kellyStakes.filter(ks => ks.stake > 0) // Apenas stakes positivas
    });

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
 export async function GET(request: Request) {
  try {
        // Bloco de segurança novo entra aqui
        const { searchParams } = new URL(request.url);
        const apiKey = request.headers.get("x-api-key") || 
                       request.headers.get("Authorization")?.replace("Bearer ", "") || 
                       searchParams.get("key");

        const cronHeader = request.headers.get("x-vercel-cron");
        const isValidKey = apiKey === process.env.ARGOS_API_KEY;
        const isCron = cronHeader === "1";

        if (!isValidKey && !isCron) {
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        // Fim do bloco

    const queueService = new BatchQueueService();
    const nextItem = await queueService.getNextInQueue();

    if (!nextItem) {
      return NextResponse.json({ message: "Fila vazia. Nenhum jogo para processar." });
    }

    const orchestrator = new ArgosOrchestratorV4();
    const deliveryService = new ValueDeliveryService();
    const requestedVerticals: MarketVertical[] = (nextItem.requestedVerticals || []).map((v: string) => v as MarketVertical);
    const auditResult = await orchestrator.runZeroTouchAudit(nextItem.matchId, requestedVerticals);

    if (auditResult.status === "FAILED") {
      // Se falhar, marcamos como FAILED mas não retornamos 500 para não travar o worker
      await queueService.updateStatus(nextItem.id, "FAILED", auditResult.error);
      return NextResponse.json({ 
        status: "SKIPPED", 
        matchId: nextItem.matchId, 
        reason: auditResult.error 
      }, { status: 200 });
    }

    if (auditResult.error === "NOT_FOUND") {
      // Caso específico de fixture não encontrada: Marcar como COMPLETED (ou SKIPPED) para sair da fila
      await queueService.updateStatus(nextItem.id, "COMPLETED", "Fixture not found in API");
      return NextResponse.json({ 
        status: "SKIPPED", 
        matchId: nextItem.matchId, 
        reason: "Fixture not found" 
      }, { status: 200 });
    }

    // Marcar como COMPLETED após sucesso
    await queueService.updateStatus(nextItem.id, "COMPLETED");

    let signalsToDeliver = auditResult.classifiedSignals || [];
    let userTier: 'FREE' | 'PRO' | 'WHALE/VIP' = 'FREE';
    let kellyStakes: { signalId: string, stake: number }[] = [];

    if (nextItem.userId) {
      userTier = await deliveryService.getUserTier(nextItem.userId);
      signalsToDeliver = deliveryService.filterSignalsByTier(signalsToDeliver, userTier);

      if (userTier === 'WHALE/VIP') {
        const bankroll = 1000; // Exemplo: 1000 unidades de banca para cálculo de Kelly
        kellyStakes = signalsToDeliver.map(signal => ({
          signalId: signal.id || '',
          stake: deliveryService.calculateKellyCriterion(signal, bankroll)
        }));
        // Logar a entrega para usuários WHALE/VIP
        for (const signal of signalsToDeliver) {
          if (signal.id) {
            await deliveryService.logSignalDelivery(nextItem.userId, signal, userTier, 'QUEUE_WORKER');
          }
        }
      }
    }

    return NextResponse.json({
      status: "SUCCESS",
      matchId: nextItem.matchId,
      regime: auditResult.regime,
      signals: signalsToDeliver,
      userTier,
      kellyStakes: kellyStakes.filter(ks => ks.stake > 0)
    });



  } catch (error: any) {
    console.error("[Argos API v4.5] Queue Processing Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
