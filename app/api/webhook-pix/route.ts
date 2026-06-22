// ============================================================
// WEBHOOK PIX v5.1 — SYNDICATE SECURITY
// Valida assinatura Efí, processa pagamento e libera acesso VIP
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
  planType?: "VIP" | "WHALE"; // Atualizado de PRO para VIP
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  
  try {
    console.log("[Webhook-Pix] Recebido webhook da Efí");

    const payload = await req.text();
    const signature = req.headers.get("x-efi-signature") || "";

    if (!payload || !signature) {
      return NextResponse.json({ error: "Payload or signature missing" }, { status: 400 });
    }

    const isSignatureValid = paymentGateway.validateWebhookSignature(payload, signature);
    if (!isSignatureValid) {
      console.error("[Webhook-Pix] Assinatura inválida");
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    const webhookData: WebhookPayload = JSON.parse(payload);
    console.log(`[Webhook-Pix] Assinatura validada ✅. TxId: ${webhookData.txId}`);

    if (webhookData.status === "PAID") {
      if (!webhookData.userId || !webhookData.planType) {
        return NextResponse.json({ error: "UserId or planType missing" }, { status: 400 });
      }

      // 5. Atualizar status do usuário no Supabase para VIP (INSTANTÂNEO)
      const supabase = getSupabaseClient();
      const { error: updateError } = await supabase
        .from("users")
        .update({
          tier: webhookData.planType,
          payment_status: "CONFIRMED",
          paid_at: new Date().toISOString(),
          pix_tx_id: webhookData.txId,
        })
        .eq("id", webhookData.userId);

      if (updateError) {
        console.error("[Webhook-Pix] Erro ao atualizar usuário:", updateError.message);
        return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
      }

      // 6. Processar confirmação de pagamento e liberar link
      const paymentProcessed = await paymentGateway.processPaymentConfirmation(
        webhookData.txId,
        webhookData.userId,
        webhookData.planType
      );

      if (!paymentProcessed) {
        return NextResponse.json({ error: "Payment processing failed" }, { status: 500 });
      }

      console.log(`[Webhook-Pix] ✅ Pagamento confirmado e usuário ${webhookData.userId} atualizado para ${webhookData.planType}`);
    }

    const executionTime = Date.now() - startTime;
    return NextResponse.json({
        status: "success",
        txId: webhookData.txId,
        executionTimeMs: executionTime,
      }, { status: 200 });
  } catch (error: any) {
    console.error("[Webhook-Pix] Erro crítico:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
