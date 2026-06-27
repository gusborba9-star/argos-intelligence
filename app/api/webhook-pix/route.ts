// ============================================================
// WEBHOOK PIX v6.0.0 — SYNDICATE MASTER EDITION
// Valida assinatura Efí, processa pagamento e sincroniza VIP
// ============================================================

import { NextResponse, NextRequest } from "next/server";
import { paymentGateway } from "@/lib/core/PaymentGatewayService";
import { getSupabaseClient } from "@/lib/core/SupabaseClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface EfiPixWebhook {
  pix: Array<{
    txid: string;
    valor: string;
    horario: string;
    infoPagador?: string;
  }>;
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const supabase = getSupabaseClient();
  
  try {
    const payload = await req.json();
    const signature = req.headers.get("x-efi-signature") || "";

    // 1. Validação de Segurança
    // Em produção, a Efí envia um HMAC ou validação mTLS.
    // Aqui usamos o validador interno do gateway.
    const isSignatureValid = paymentGateway.validateWebhookSignature(JSON.stringify(payload), signature);
    
    // Se não houver assinatura (teste/sandbox), logamos mas podemos permitir se configurado
    if (!isSignatureValid && process.env.NODE_ENV === "production") {
      console.error("[Webhook-Pix] ❌ Assinatura inválida detectada em produção.");
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    const data = payload as EfiPixWebhook;
    console.log(`[Webhook-Pix] Recebido webhook da Efí. Pix encontrados: ${data.pix?.length || 0}`);

    for (const payment of data.pix || []) {
      const txId = payment.txid;
      
      // 2. Localizar pagamento no Cérebro (Supabase)
      const { data: paymentRecord, error: fetchError } = await supabase
        .from("argos_payments")
        .select("user_id, plan_type, status")
        .eq("tx_id", txId)
        .single();

      if (fetchError || !paymentRecord) {
        console.warn(`[Webhook-Pix] Pagamento TxId ${txId} não encontrado no sistema.`);
        continue;
      }

      if (paymentRecord.status === "PAID") {
        console.log(`[Webhook-Pix] Pagamento ${txId} já processado anteriormente.`);
        continue;
      }

      // 3. Processar Confirmação e Sincronizar Tiers
      const success = await paymentGateway.processPaymentConfirmation(
        txId,
        paymentRecord.user_id,
        paymentRecord.plan_type
      );

      if (success) {
        console.log(`[Webhook-Pix] ✅ Sucesso: Usuário ${paymentRecord.user_id} agora é VIP.`);
      }
    }

    return NextResponse.json({
        status: "success",
        processedAt: new Date().toISOString(),
        executionTimeMs: Date.now() - startTime,
      }, { status: 200 });

  } catch (error: any) {
    console.error("[Webhook-Pix] Erro crítico:", error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
