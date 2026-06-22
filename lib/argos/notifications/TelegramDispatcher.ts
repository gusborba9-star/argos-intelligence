import axios from 'axios';
import { ArgosSignal } from '@/lib/core/contracts/SignalContract';

// ============================================================
// TELEGRAM DISPATCHER v5.1 — INDUSTRIAL DISTRIBUTION (FIXED)
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
    this.vipChannelId = process.env.TELEGRAM_CHAT_ID || process.env.TELEGRAM_VIP_CHANNEL_ID || ''; 
    
    if (this.botToken) {
      console.log(`[TelegramDispatcher] Inicializado. VIP: ${this.vipChannelId}, FREE: ${this.freeChannelId}`);
    } else {
      console.error("[TelegramDispatcher] Falha na inicialização: TELEGRAM_BOT_TOKEN ausente.");
    }
  }

  public async dispatch(signals: ArgosSignal[], regimeInfo?: any): Promise<void> {
    if (!this.botToken) {
      console.error('[TelegramDispatcher] ERRO CRÍTICO: TELEGRAM_BOT_TOKEN não configurado.');
      return;
    }

    // Filtrar sinais que não possuem tier válido para envio
    const deliverableSignals = signals.filter(s => s.tier === "FREE" || s.tier === "VIP");

    console.log(`[TelegramDispatcher] Iniciando despacho de ${deliverableSignals.length} sinais entregáveis.`);

    for (const signal of deliverableSignals) {
      try {
        const promises = [];
        const tier = signal.tier;

        if (this.vipChannelId && (tier === "VIP" || tier === "FREE")) {
          promises.push(this.sendToVip(signal, regimeInfo));
        }

        if (this.freeChannelId && tier === "FREE") {
          promises.push(this.sendToFree(signal));
        }

        await Promise.all(promises);
      } catch (error: any) {
        console.error(`[TelegramDispatcher] Erro no sinal ${signal.market}:`, error.message);
      }
    }
  }

  private async sendToVip(signal: ArgosSignal, regimeInfo?: any): Promise<void> {
    const message = this.formatVipMessage(signal, regimeInfo);
    await this.sendMessage(this.vipChannelId, message);
  }

  private async sendToFree(signal: ArgosSignal): Promise<void> {
    const message = this.formatFreeMessage(signal);
    await this.sendMessage(this.freeChannelId, message);
  }

  private async sendMessage(chatId: string, text: string): Promise<void> {
    const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
    try {
      await axios.post(url, {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      }, { timeout: 10000 });
      console.log(`[TelegramDispatcher] Sucesso: Mensagem entregue ao chat ${chatId}.`);
    } catch (error: any) {
      console.error(`[TelegramDispatcher] FALHA NO ENVIO TELEGRAM (Chat: ${chatId}):`, error.message);
    }
  }

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
      
      let confidenceStr = "N/A";
      if (typeof regimeInfo?.confidence === 'number') {
        confidenceStr = `${(regimeInfo.confidence * 100).toFixed(0)}%`;
      } else if (typeof signal.confidence === 'number') {
        confidenceStr = `${(signal.confidence * 100).toFixed(0)}%`;
      } else if (signal.confidence) {
        confidenceStr = signal.confidence;
      }
      
      message += `• <b>Confiança:</b> <code>${confidenceStr}</code>\n`;
      if (signal.reasoning) message += `• <b>Justificativa:</b> <i>${signal.reasoning}</i>\n`;
    }

    message += `──────────────────────\n`;
    message += `<i>Argos v5.1 | Syndicate Performance Engine</i>`;
    
    return message;
  }

  private formatFreeMessage(signal: ArgosSignal): string {
    const prob = (signal.probability * 100).toFixed(2);
    
    return `🔥 <b>ARGOS FREE | ASSERTIVIDADE MÁXIMA</b>
──────────────────────
🏟️ <b>JOGO:</b> <code>${signal.market.toUpperCase()}</code>
🎯 <b>ENTRADA:</b> <code>${signal.vertical.replace('_', ' ')}</code>
──────────────────────
✅ <b>CONFIANÇA:</b> <code>${prob}%</code>
🛡️ <b>FILTRO:</b> <code>HARD REJECT PASSED</code>
──────────────────────
🚀 <b>ESTA É UMA AMOSTRA DA NOSSA INTELIGÊNCIA.</b>
💎 <b>QUER O FILÉ COM EV+ E MULTI-MERCADOS?</b>
👉 <b>VIP:</b> <a href="${this.VIP_LINK}">CLIQUE AQUI PARA ENTRAR</a>
──────────────────────
<i>Argos v5.1 | Industrial Performance</i>`.trim();
  }
}
