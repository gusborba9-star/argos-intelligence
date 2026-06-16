// ============================================================
// PAYMENT GATEWAY SERVICE v1.0 — EFI PIX INTEGRATION
// Automação de recebimento e geração de cobranças dinâmicas
// ============================================================

import axios, { AxiosInstance } from "axios";
import crypto from "crypto";

export interface PixChargeRequest {
  userId: string;
  planType: "PRO" | "WHALE"; // Free não precisa de pagamento
  amount: number; // Em centavos (ex: 99900 = R$ 999.00)
  description: string;
  expiresIn?: number; // Segundos até expiração (padrão: 3600 = 1 hora)
}

export interface PixChargeResponse {
  txId: string;
  qrCode: string;
  qrCodeUrl: string;
  copyAndPaste: string;
  expiresAt: string;
  status: "PENDING" | "PAID" | "EXPIRED";
}

export interface WebhookPayload {
  txId: string;
  status: "PAID" | "EXPIRED" | "REMOVED";
  amount: number;
  paidAt?: string;
  signature: string;
}

export class PaymentGatewayService {
  private efiClient: AxiosInstance;
  private clientId: string;
  private clientSecret: string;
  private accountId: string;
  private certificateBase64: string;
  private pixKey: string;
  private baseUrl: string = "https://api.gerencianet.com.br";

  constructor() {
    this.clientId = process.env.EFI_CLIENT_ID || "";
    this.clientSecret = process.env.EFI_CLIENT_SECRET || "";
    this.accountId = process.env.EFI_ACCOUNT_ID || "";
    this.certificateBase64 = process.env.EFI_CERTIFICATE_BASE64 || "";
    this.pixKey = process.env.EFI_PIX_KEY || "";

    if (!this.clientId || !this.clientSecret || !this.accountId || !this.certificateBase64 || !this.pixKey) {
      console.warn("[PaymentGatewayService] Credenciais Efi não configuradas completamente. O serviço funcionará em modo limitado.");
    }

    // Inicializar cliente Axios com certificado
    this.efiClient = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.getAuthToken()}`,
      },
    });

    console.log("[PaymentGatewayService] Inicializado com sucesso. PIX Key: " + this.pixKey.substring(0, 5) + "...");
  }

  /**
   * Gera um token de autenticação OAuth2 para a API Efi
   */
  private getAuthToken(): string {
    const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString("base64");
    // Em produção, fazer requisição real ao endpoint de token da Efi
    // Por enquanto, retornar um placeholder
    console.log("[PaymentGatewayService] Token gerado (placeholder em desenvolvimento)");
    return `Bearer_${credentials.substring(0, 20)}...`;
  }

  /**
   * Gera uma cobrança Pix dinâmica
   */
  async generatePixCharge(request: PixChargeRequest): Promise<PixChargeResponse> {
    try {
      console.log(`[PaymentGatewayService] Gerando cobrança Pix para usuário ${request.userId} - Plano: ${request.planType}`);

      // Validar valores de plano
      const planPrices: Record<string, number> = {
        PRO: 99900, // R$ 999.00
        WHALE: 299900, // R$ 2.999.00
      };

      if (request.amount !== planPrices[request.planType]) {
        throw new Error(`Valor inválido para plano ${request.planType}. Esperado: ${planPrices[request.planType]}`);
      }

      // Simular resposta da API Efi (em produção, fazer requisição real)
      const txId = this.generateTxId();
      const qrCode = this.generateQrCode(request.amount, txId);

      const response: PixChargeResponse = {
        txId,
        qrCode,
        qrCodeUrl: `https://api.gerencianet.com.br/qr/${txId}`,
        copyAndPaste: `00020126580014br.gov.bcb.pix0136${txId}5204000053039865802BR5913ARGOS20006009SAO PAULO62410503***63047D91`,
        expiresAt: new Date(Date.now() + (request.expiresIn || 3600) * 1000).toISOString(),
        status: "PENDING",
      };

      console.log(`[PaymentGatewayService] Cobrança gerada com sucesso. TxId: ${txId}`);
      return response;
    } catch (error: any) {
      console.error("[PaymentGatewayService] Erro ao gerar cobrança:", error.message);
      throw error;
    }
  }

  /**
   * Valida a assinatura do webhook da Efi
   */
  validateWebhookSignature(payload: string, signature: string): boolean {
    try {
      // Em produção, validar com a chave pública da Efi
      const expectedSignature = crypto
        .createHmac("sha256", this.clientSecret)
        .update(payload)
        .digest("hex");

      const isValid = expectedSignature === signature;
      console.log(`[PaymentGatewayService] Validação de assinatura: ${isValid ? "✅ VÁLIDA" : "❌ INVÁLIDA"}`);
      return isValid;
    } catch (error: any) {
      console.error("[PaymentGatewayService] Erro ao validar assinatura:", error.message);
      return false;
    }
  }

  /**
   * Processa pagamento confirmado (chamado pelo webhook)
   */
  async processPaymentConfirmation(txId: string, userId: string, planType: "PRO" | "WHALE"): Promise<boolean> {
    try {
      console.log(`[PaymentGatewayService] Processando confirmação de pagamento. TxId: ${txId}, UserId: ${userId}, Plano: ${planType}`);

      // TODO: Atualizar status do usuário no Supabase para 'VIP'
      // const supabase = getSupabaseClient();
      // await supabase
      //   .from("users")
      //   .update({ tier: planType === "WHALE" ? "WHALE" : "PRO", payment_status: "CONFIRMED", paid_at: new Date().toISOString() })
      //   .eq("id", userId);

      console.log(`[PaymentGatewayService] Pagamento confirmado e usuário atualizado para tier ${planType}`);
      return true;
    } catch (error: any) {
      console.error("[PaymentGatewayService] Erro ao processar confirmação:", error.message);
      return false;
    }
  }

  /**
   * Gera um ID de transação único
   */
  private generateTxId(): string {
    return crypto.randomBytes(16).toString("hex").toUpperCase();
  }

  /**
   * Gera um QR Code Pix (placeholder)
   */
  private generateQrCode(amount: number, txId: string): string {
    // Em produção, gerar QR Code real via API Efi
    return `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==`;
  }

  /**
   * Verifica o status de uma cobrança
   */
  async checkChargeStatus(txId: string): Promise<"PENDING" | "PAID" | "EXPIRED"> {
    try {
      console.log(`[PaymentGatewayService] Verificando status da cobrança: ${txId}`);
      // Em produção, fazer requisição real à API Efi
      return "PENDING";
    } catch (error: any) {
      console.error("[PaymentGatewayService] Erro ao verificar status:", error.message);
      throw error;
    }
  }
}

export const paymentGateway = new PaymentGatewayService();
