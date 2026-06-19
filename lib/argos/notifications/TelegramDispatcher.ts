import axios from 'axios';
import { ArgosSignal } from '@/lib/core/contracts/SignalContract';

// ============================================================
// TELEGRAM DISPATCHER v5.0 — INDUSTRIAL DISTRIBUTION
// Distribuição de sinais com filtragem Free/VIP e resiliência
// ============================================================

export class TelegramDispatcher {
  private botToken: string;
  private freeChannelId: string;
  private vipChannelId: string;
  private readonly VIP_LINK = "https://t.me/+T_gr8u0lKTpjMmMx";

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    this.freeChannelId = process.env.TELEGRAM_FREE_CHANNEL_ID || '';
    this.vipChannelId = process.env.TELEGRAM_CHAT_ID || ''; 
    
    // Log de inicialização industrial
    if (this.botToken) {
      console.log(`[TelegramDispatcher] Inicializado. Token: ${this.botToken.substring(0, 5)}... VIP: ${this.vipChannelId}, FREE: ${this.freeChannelId}`);
    } else {
      console.error("[TelegramDispatcher] Falha na inicialização: TELEGRAM_BOT_TOKEN ausente.");
    }
  }

  /**
   * Despacha sinais para os canais Free e VIP com base nas regras de negócio.
   */
  public async dispatch(signals: ArgosSignal[], regimeInfo?: any): Promise<void> {
    console.log(`[TelegramDispatcher] Verificando ambiente: BOT_TOKEN=${this.botToken ? 'OK' : 'MISSING'}, FREE_ID=${this.freeChannelId ? 'OK' : 'MISSING'}, VIP_ID=${this.vipChannelId ? 'OK' : 'MISSING'}`);

    if (!this.botToken) {
      console.error('[TelegramDispatcher] ERRO CRÍTICO: TELEGRAM_BOT_TOKEN não configurado.');
      return;
    }

    console.log(`[TelegramDispatcher] Iniciando despacho industrial de ${signals.length} sinais.`);

    for (const signal of signals) {
      try {
        const promises = [];

        // 1. Envio para Canal VIP (O "Filé")
        if (this.vipChannelId) {
          console.log(`[TelegramDispatcher] Preparando envio VIP: ${signal.market} (Prob: ${signal.probability})`);
          promises.push(this.sendToVip(signal, regimeInfo));
        } else {
          console.warn('[TelegramDispatcher] Aviso: TELEGRAM_CHAT_ID (VIP) não configurado.');
        }

        // 2. Envio para Canal FREE (Marketing/Isca)
        if (this.freeChannelId && this.isEligibleForFree(signal)) {
          console.log(`[TelegramDispatcher] Preparando envio FREE: ${signal.market} (Prob: ${signal.probability})`);
          promises.push(this.sendToFree(signal));
        } else if (this.freeChannelId) {
          console.log(`[TelegramDispatcher] Sinal ignorado para FREE (Baixa Prob ou Vertical Restrita): ${signal.market}`);
        }

        // Aguarda todos os envios do sinal atual para garantir ordem e conclusão
        await Promise.all(promises);
      } catch (error: any) {
        console.error(`[TelegramDispatcher] Erro fatal no processamento do sinal ${signal.market}:`, error.message);
        console.error(`[TelegramDispatcher] Stack:`, error.stack);
      }
    }
  }

  /**
   * Regras de Filtragem para o Canal FREE
   */
  private isEligibleForFree(signal: ArgosSignal): boolean {
    const vertical = signal.vertical.toUpperCase();
    const market = signal.market.toUpperCase();

    // Regra 1: Alta Probabilidade (Isca) - Mínimo 55% para Free (Mais agressivo para marketing)
    if (signal.probability < 0.55) return false;

    // Regra 2: Mercados Permitidos
    // WINNER (Casa, Empate, Fora)
    if (vertical === 'WINNER') return true;

    // GOALS (Apenas OVER/UNDER específicos)
    if (vertical === 'GOALS') {
      const allowedGoals = [
        'OVER 1.5', 'OVER 2.5', 'OVER 3.5', 'OVER 4.5',
        'UNDER 1.5', 'UNDER 2.5', 'UNDER 3.5', 'UNDER 4.5'
      ];
      return allowedGoals.some(m => market.includes(m));
    }

    return false;
  }

  /**
   * Envio para o Canal VIP
   */
  private async sendToVip(signal: ArgosSignal, regimeInfo?: any): Promise<void> {
    const message = this.formatVipMessage(signal, regimeInfo);
    await this.sendMessage(this.vipChannelId, message);
  }

  /**
   * Envio para o Canal FREE
   */
  private async sendToFree(signal: ArgosSignal): Promise<void> {
    const message = this.formatFreeMessage(signal);
    await this.sendMessage(this.freeChannelId, message);
  }

  /**
   * Método base para envio via API do Telegram com resiliência
   */
  private async sendMessage(chatId: string, text: string): Promise<void> {
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    try {
      console.log(`[TelegramDispatcher] Enviando payload para Telegram API (Chat: ${chatId})...`);
      const response = await axios.post(url, {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      }, { 
        timeout: 10000,
        headers: { 'Content-Type': 'application/json' }
      });
      
      if (response.status === 200) {
        console.log(`[TelegramDispatcher] Sucesso: Mensagem entregue ao chat ${chatId}.`);
      } else {
        console.error(`[TelegramDispatcher] Resposta inesperada da API (${response.status}):`, response.data);
      }
    } catch (error: any) {
      console.error(`[TelegramDispatcher] FALHA NO ENVIO TELEGRAM (Chat: ${chatId})`);
      if (error.response) {
        console.error(`[TelegramDispatcher] Erro da API:`, JSON.stringify(error.response.data, null, 2));
        console.error(`[TelegramDispatcher] Status:`, error.response.status);
      } else {
        console.error(`[TelegramDispatcher] Erro de Rede/Timeout:`, error.message);
      }
      // Não lançamos o erro para garantir resiliência, mas o log é exaustivo
    }
  }

  /**
   * Formatação VIP: Profundidade técnica e justificativa
   */
  private formatVipMessage(signal: ArgosSignal, regimeInfo?: any): string {
    const ev = (signal.expectedValue * 100).toFixed(2);
    const prob = (signal.probability * 100).toFixed(2);
    
    let message = `💎 <b>ARGOS VIP | INTELIGÊNCIA MÁXIMA</b>\n`;
    message += `──────────────────────\n`;
    message += `🏟️ <b>MERCADO:</b> <code>${signal.market.toUpperCase()}</code>\n`;
    message += `📈 <b>VERTICAL:</b> <code>${signal.vertical.replace('_', ' ')}</code>\n`;
    message += `──────────────────────\n`;
    message += `🎯 <b>PROBABILIDADE:</b> <code>${prob}%</code>\n`;
    message += `💰 <b>ODD MÍNIMA:</b> <code>${signal.impliedOdds?.toFixed(2) || 'N/A'}</code>\n`;
    message += `📊 <b>EXPECTED VALUE:</b> <code>${Number(ev) > 0 ? '+' : ''}${ev}%</code>\n`;
    message += `🛡️ <b>STATUS:</b> <code>${signal.status}</code>\n`;
    
    if (signal.reasoning || regimeInfo) {
      message += `──────────────────────\n`;
      message += `🧠 <b>ANÁLISE TÉCNICA:</b>\n`;
      if (regimeInfo?.regime) message += `• <b>Regime:</b> <code>${regimeInfo.regime}</code>\n`;
      if (regimeInfo?.confidence) message += `• <b>Confiança:</b> <code>${(regimeInfo.confidence * 100).toFixed(0)}%</code>\n`;
      if (signal.reasoning) message += `• <b>Justificativa:</b> <i>${signal.reasoning}</i>\n`;
    }

    message += `──────────────────────\n`;
    message += `<i>Argos v5.0 | Industrial Performance Engine</i>`;
    
    return message;
  }

  /**
   * Formatação FREE: Foco em assertividade e CTA
   */
  private formatFreeMessage(signal: ArgosSignal): string {
    const prob = (signal.probability * 100).toFixed(2);
    
    return `📊 <b>ARGOS FREE | ALTA ASSERTIVIDADE</b>
──────────────────────
🏟️ <b>MERCADO:</b> <code>${signal.market.toUpperCase()}</code>
📈 <b>VERTICAL:</b> <code>${signal.vertical.replace('_', ' ')}</code>
──────────────────────
🎯 <b>PROBABILIDADE:</b> <code>${prob}%</code>
🛡️ <b>STATUS:</b> <code>${signal.status}</code>
──────────────────────
🚀 <b>QUER O "FILÉ" COM EV+ E ANÁLISE COMPLETA?</b>
👉 <b>ACESSE O VIP:</b> <a href="${this.VIP_LINK}">CLIQUE AQUI PARA ENTRAR</a>
──────────────────────
<i>Argos v5.0 | Nexus Intelligence</i>`.trim();
  }
}
