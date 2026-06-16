// ============================================================
// WEBHOOK PIX v1.0 — CHAVE MESTRE DO SISTEMA
// Valida assinatura Efi, processa pagamento e atualiza usuário
// ============================================================

import { NextResponse, NextRequest } from "next/server";
import { paymentGateway } from "@/lib/core/PaymentGatewayService";
import { getSupabaseClient } from "@/lib/core/SupabaseClient";
import { telemetryService } from "@/lib/core/TelemetryService";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface WebhookPayload {
  txId: string;
  status: "PAID" | "EXPIRED" | "REMOVED";
  amount: number;
  paidAt?: string;
  userId?: string;
  planType?: "PRO" | "WHALE";
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log("[Webhook-Pix] Recebido webhook da Efi");

    // 1. Extrair payload e assinatura do header
    const payload = await req.text();
    const signature = req.headers.get("x-efi-signature") || "";

    if (!payload || !signature) {
      console.error("[Webhook-Pix] Payload ou assinatura ausentes");
      return NextResponse.json(
        { error: "Payload or signature missing" },
        { status: 400 }
      );
    }

    // 2. Validar assinatura (CRÍTICO: Chave mestre de segurança)
    const isSignatureValid = paymentGateway.validateWebhookSignature(payload, signature);
    if (!isSignatureValid) {
      console.error("[Webhook-Pix] Assinatura inválida - Possível ataque");
      telemetryService.recordEvent({
        eventType: "SECURITY_ALERT",
        matchId: "webhook-pix",
        details: "Invalid webhook signature detected",
      });
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 403 }
      );
    }

    // 3. Parsear payload
    const webhookData: WebhookPayload = JSON.parse(payload);
    console.log(`[Webhook-Pix] Assinatura validada ✅. TxId: ${webhookData.txId}, Status: ${webhookData.status}`);

    // 4. Processar apenas pagamentos confirmados
    if (webhookData.status === "PAID") {
      if (!webhookData.userId || !webhookData.planType) {
        console.error("[Webhook-Pix] UserId ou planType ausentes no payload");
        return NextResponse.json(
          { error: "UserId or planType missing" },
          { status: 400 }
        );
      }

      // 5. Atualizar status do usuário no Supabase para VIP (INSTANTÂNEO)
      const supabase = getSupabaseClient();
      const { error: updateError } = await supabase
        .from("users")
        .update({
          tier: webhookData.planType === "WHALE" ? "WHALE" : "PRO",
          payment_status: "CONFIRMED",
          paid_at: new Date().toISOString(),
          pix_tx_id: webhookData.txId,
        })
        .eq("id", webhookData.userId);

      if (updateError) {
        console.error("[Webhook-Pix] Erro ao atualizar usuário:", updateError.message);
        telemetryService.recordEvent({
          eventType: "PAYMENT_ERROR",
          matchId: webhookData.txId,
          details: `Failed to update user: ${updateError.message}`,
        });
        return NextResponse.json(
          { error: "Failed to update user" },
          { status: 500 }
        );
      }

      // 6. Processar confirmação de pagamento
      const paymentProcessed = await paymentGateway.processPaymentConfirmation(
        webhookData.txId,
        webhookData.userId,
        webhookData.planType
      );

      if (!paymentProcessed) {
        console.error("[Webhook-Pix] Erro ao processar pagamento");
        return NextResponse.json(
          { error: "Payment processing failed" },
          { status: 500 }
        );
      }

      // 7. Registrar sucesso na telemetria
      telemetryService.recordEvent({
        eventType: "PAYMENT_CONFIRMED",
        matchId: webhookData.txId,
        details: `User ${webhookData.userId} upgraded to ${webhookData.planType}`,
      });

      console.log(`[Webhook-Pix] ✅ Pagamento confirmado e usuário ${webhookData.userId} atualizado para ${webhookData.planType}`);
    } else if (webhookData.status === "EXPIRED") {
      console.log(`[Webhook-Pix] Cobrança expirada: ${webhookData.txId}`);
      telemetryService.recordEvent({
        eventType: "PAYMENT_EXPIRED",
        matchId: webhookData.txId,
      });
    }

    const executionTime = Date.now() - startTime;
    console.log(`[Webhook-Pix] Processamento concluído em ${executionTime}ms`);

    return NextResponse.json(
      {
        status: "success",
        message: "Webhook processed successfully",
        txId: webhookData.txId,
        executionTimeMs: executionTime,
      },
      { status: 200 }
    );
  } catch (error: any) {
    console.error("[Webhook-Pix] Erro crítico:", error.message);
    telemetryService.recordEvent({
      eventType: "WEBHOOK_ERROR",
      matchId: "webhook-pix",
      details: error.message,
    });
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
