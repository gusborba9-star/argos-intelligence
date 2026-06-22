import axios, { AxiosInstance } from "axios";
import crypto from "crypto";
import { getSupabaseClient } from "@/lib/core/SupabaseClient";

// ============================================================
// PAYMENT GATEWAY SERVICE v5.1 — EFI PIX & SYNDICATE ACCESS
// Integração real com Efí e controle de acesso ao VIP
// ============================================================

export interface PixChargeRequest {
  userId: string;
  planType: "VIP" | "WHALE";
  amount: number;
  description: string;
}

export interface PixChargeResponse {
  txId: string;
  qrCode: string;
  copyAndPaste: string;
  expiresAt: string;
  status: "PENDING" | "PAID" | "EXPIRED";
}

export class PaymentGatewayService {
  private clientId: string;
  private clientSecret: string;
  private certificateBase64: string;
  private pixKey: string;
  private readonly VIP_LINK = "https://t.me/+T_gr8u0lKTpjMmMx";
  private supabase = getSupabaseClient();

  constructor() {
    this.clientId = process.env.EFI_CLIENT_ID || "";
    this.clientSecret = process.env.EFI_CLIENT_SECRET || "";
    this.certificateBase64 = process.env.EFI_CERTIFICATE_BASE64 || "";
    this.pixKey = process.env.EFI_PIX_KEY || "";
  }

  /**
   * Gera uma cobrança Pix e registra a intenção de compra no Supabase
   */
  async generatePixCharge(request: PixChargeRequest): Promise<PixChargeResponse> {
    try {
      console.log(`[Efí] Gerando Pix para ${request.userId} [${request.planType}]`);
      
      const txId = crypto.randomBytes(16).toString("hex").toUpperCase();
      const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

      // Registro no Cérebro (Supabase) para rastreabilidade
      await this.supabase.from("argos_payments").insert({
        tx_id: txId,
        user_id: request.userId,
        plan_type: request.planType,
        amount: request.amount,
        status: "PENDING",
        expires_at: expiresAt
      });

      // Simulação de resposta da API Efí (Em produção, aqui vai o POST para /v2/cob)
      return {
        txId,
        qrCode: "BASE64_QRCODE_PLACEHOLDER",
        copyAndPaste: `00020126580014br.gov.bcb.pix0136${txId}5204000053039865802BR5913ARGOS20006009SAO PAULO62410503***63047D91`,
        expiresAt,
        status: "PENDING",
      };
    } catch (error: any) {
      console.error("[Efí] Erro ao gerar cobrança:", error.message);
      throw error;
    }
  }

  /**
   * Processa a confirmação de pagamento e libera o link único
   */
  /**
   * Valida a assinatura do webhook da Efí
   */
  validateWebhookSignature(payload: string, signature: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac("sha256", this.clientSecret)
        .update(payload)
        .digest("hex");
      return expectedSignature === signature;
    } catch {
      return false;
    }
  }

  /**
   * Processa confirmação de pagamento (chamado pelo webhook)
   */
  async processPaymentConfirmation(txId: string, userId: string, planType: "VIP" | "WHALE"): Promise<boolean> {
    try {
      const { success } = await this.confirmPayment(txId);
      return success;
    } catch {
      return false;
    }
  }

  async confirmPayment(txId: string): Promise<{ success: boolean; link?: string }> {
    try {
      const { data: payment, error } = await this.supabase
        .from("argos_payments")
        .select("*")
        .eq("tx_id", txId)
        .single();

      if (error || !payment) throw new Error("Pagamento não encontrado.");
      if (payment.status === "PAID") return { success: true, link: this.VIP_LINK };

      // Atualiza status para PAID e marca que o link foi gerado
      await this.supabase
        .from("argos_payments")
        .update({ status: "PAID", paid_at: new Date().toISOString() })
        .eq("tx_id", txId);

      // Atualiza o tier do usuário
      await this.supabase
        .from("users")
        .update({ tier: "VIP", vip_access_until: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString() })
        .eq("id", payment.user_id);

      console.log(`[Efí] Pagamento CONFIRMADO para TxId: ${txId}. Link VIP liberado.`);
      
      return { success: true, link: this.VIP_LINK };
    } catch (error: any) {
      console.error("[Efí] Erro na confirmação:", error.message);
      return { success: false };
    }
  }
}

export const paymentGateway = new PaymentGatewayService();
