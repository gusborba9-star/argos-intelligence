import { NextResponse } from "next/server";
import { ResilientOrchestratorV5 } from "@/lib/argos/orchestrator/ResilientOrchestratorV5";
import { BatchQueueService, QueueStatus } from "@/lib/core/BatchQueueService";
import { ValueDeliveryService } from "@/lib/argos/delivery/ValueDeliveryService";
import { MarketVertical } from "@/lib/core/ArgosUnifiedEngine";
import { TelegramDispatcher } from "@/lib/argos/notifications/TelegramDispatcher";
import { DailyIngestionScheduler } from "@/lib/argos/ingestion/DailyIngestionScheduler";
// ============================================================
// ARGOS API v4.5 — ZERO-TOUCH & BATCH ENDPOINT
// Endpoint consolidado para auditoria autônoma e em lote
// ============================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    // Verificação de Autorização (Middleware injeta x-authorized se validado)
    const isAuthorized = req.headers.get("x-authorized") === "true";
    const apiKey = req.headers.get("x-api-key");
    
    // Fallback caso o middleware falhe em injetar mas a chave esteja lá
    const isValidApiKey = apiKey && apiKey === process.env.ARGOS_API_KEY;

    if (!isAuthorized && !isValidApiKey) {
      console.error("[Argos API v4.5] Acesso negado no POST. Headers:", {
        authorized: isAuthorized,
        apiKeyPresent: !!apiKey,
        userAgent: req.headers.get("user-agent")
      });
      return NextResponse.json({ error: "Unauthorized: Invalid or missing API Key" }, { status: 401 });
    }

    const body = await req.json();
    const { matchId, requestedVerticals, marketOdds, userId, mode = "DIRECT" } = body;

    if (!matchId || !requestedVerticals) {
      return NextResponse.json({ error: "matchId e requestedVerticals são obrigatórios" }, { status: 400 });
    }

    // Argos v5.0 Syndicate-Level: Uso do Orquestrador Resiliente V5
    const orchestrator = new ResilientOrchestratorV5();
    const deliveryService = new ValueDeliveryService();

    // MODO BATCH: Adiciona à fila e retorna imediatamente (Ideal para auditorias massivas na Vercel)
    if (mode === "BATCH") {
      const queueService = new BatchQueueService();
      const queueId = await queueService.enqueue(matchId, "ALL_MARKETS", requestedVerticals, userId);
      
      return NextResponse.json({ 
        status: "QUEUED", 
        queueId,
        matchId,
        timestamp: new Date().toISOString()
      });
    }

    // MODO DIRECT: Processamento imediato (Zero-Touch) com Resiliência
    const auditResult = await orchestrator.runZeroTouchAuditWithResilience(matchId, requestedVerticals, marketOdds);

    if (auditResult.status === "FAILED") {
      return NextResponse.json(auditResult, { status: 500 });
    }

    // Lógica de Tiers e Entrega de Valor
    let signalsToDeliver = auditResult.classifiedSignals || [];
    let userTier: 'FREE' | 'PRO' | 'WHALE/VIP' = (req.headers.get("x-user-tier") as any) || 'FREE';
    let kellyStakes: { signalId: string, stake: number }[] = [];

    // Se o middleware já identificou o tier (VIP por API Key), usamos direto.
    // Caso contrário, ou se precisarmos validar o userId, buscamos no service.
    const effectiveUserId = userId || req.headers.get("x-user-id");

    if (effectiveUserId && userTier === 'FREE') {
      userTier = await deliveryService.getUserTier(effectiveUserId);
    }
    
    if (userTier) {
      signalsToDeliver = deliveryService.filterSignalsByTier(signalsToDeliver, userTier);

      if (userTier === 'WHALE/VIP') {
        const bankroll = 1000; // Exemplo: 1000 unidades de banca para cálculo de Kelly
        kellyStakes = signalsToDeliver.map(signal => ({
          signalId: signal.id || '',
          stake: deliveryService.calculateKellyCriterion(signal, bankroll)
        }));
        // Logar a entrega para usuários WHALE/VIP
        if (effectiveUserId) {
          for (const signal of signalsToDeliver) {
            if (signal.id) {
              await deliveryService.logSignalDelivery(effectiveUserId, signal, userTier, 'API_DIRECT');
            }
          }
        }
      }
    }

    // Disparo redundante para garantir a entrega (Orchestrator já dispara, mas aqui monitoramos o retorno da API)
    console.log(`[Argos API v4.5] Processamento concluído. ${signalsToDeliver.length} sinais prontos para entrega.`);

    // Integração com Telegram
    if (signalsToDeliver.length > 0) {
      const telegramDispatcher = new TelegramDispatcher();
      await telegramDispatcher.dispatch(signalsToDeliver, auditResult.regime).catch(err => {
        console.error("[Argos API v4.5] Erro ao despachar para Telegram (POST):", err.message);
      });
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
	        // Bloco de segurança unificado (Middleware injeta x-authorized se API Key bater)
	        const isAuthorized = request.headers.get("x-authorized") === "true";
        const vercelCronHeader = request.headers.get("x-vercel-cron");
        const isVercelCron = vercelCronHeader === "1";
        const authSource = request.headers.get("x-auth-source");

        console.log(`[Argos API v4.5] GET Request recebido. Auth: ${isAuthorized}, Source: ${authSource}, VercelCron: ${isVercelCron}`);

        // Se não foi autorizado pelo middleware e não é um Cron da Vercel, barramos
        if (!isAuthorized && !isVercelCron) {
          console.error("[Argos API v4.5] Acesso negado no GET. Headers:", {
            authorized: isAuthorized,
            vercelCron: isVercelCron,
            userAgent: request.headers.get("user-agent")
          });
          return NextResponse.json({ error: "Unauthorized: Access Denied" }, { status: 401 });
        }

    const queueService = new BatchQueueService();

    // Argos v5.0: Ingestão controlada via Cron Header ou Probabilidade (25%)
    const shouldRunIngestion = isVercelCron || Math.random() < 0.25;

    if (shouldRunIngestion) {
      console.log("[Argos API v4.5] Iniciando Ingestão Diária via Worker...");
      const scheduler = new DailyIngestionScheduler();
      await scheduler.scheduleDailyIngestion().catch(err => console.error("Erro na ingestão:", err.message));
    }

    // Argos v5.0 Syndicate-Level: Processamento em Lote (até 3 jogos por chamada)
    const processedResults = [];
    const MAX_PROCESS_PER_CALL = 3;
    
    for (let i = 0; i < MAX_PROCESS_PER_CALL; i++) {
      const nextItem = await queueService.getNextInQueue();
      if (!nextItem) break;

      const orchestrator = new ResilientOrchestratorV5();
      const requestedVerticals: MarketVertical[] = (nextItem.requestedVerticals || []).map((v: string) => v as MarketVertical);
      
      const auditResult = await orchestrator.runZeroTouchAuditWithResilience(nextItem.matchId, requestedVerticals);

      if (auditResult.status === "FAILED") {
        await queueService.updateStatus(nextItem.id, QueueStatus.FAILED, auditResult.error);
        processedResults.push({ matchId: nextItem.matchId, status: "FAILED", error: auditResult.error });
        continue;
      }

      if (auditResult.error === "NOT_FOUND" || auditResult.error === "DENSITY_SKIP") {
        await queueService.updateStatus(nextItem.id, QueueStatus.REJECTED, auditResult.error);
        processedResults.push({ matchId: nextItem.matchId, status: "REJECTED", reason: auditResult.error });
        continue;
      }

      // Sucesso: Marcar como COMPLETED
      await queueService.updateStatus(nextItem.id, QueueStatus.COMPLETED);

      let signalsToDeliver = auditResult.classifiedSignals || [];
      
      // Disparo para Telegram (Individual para cada jogo processado)
      if (signalsToDeliver.length > 0) {
        const telegramDispatcher = new TelegramDispatcher();
        await telegramDispatcher.dispatch(signalsToDeliver, auditResult.regime).catch(err => {
          console.error(`[Argos API v4.5] Erro Telegram [${nextItem.matchId}]:`, err.message);
        });
      }

      processedResults.push({
        matchId: nextItem.matchId,
        status: "SUCCESS",
        signalsCount: signalsToDeliver.length
      });
    }

    return NextResponse.json({
      status: "BATCH_PROCESSED",
      totalProcessed: processedResults.length,
      results: processedResults
    });



  } catch (error: any) {
    console.error("[Argos API v4.5] Queue Processing Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
