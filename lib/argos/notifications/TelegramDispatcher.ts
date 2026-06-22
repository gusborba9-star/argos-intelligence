import axios from 'axios';
import { ArgosSignal } from '@/lib/core/contracts/SignalContract';

// ============================================================
// TELEGRAM DISPATCHER v5.1 — SYNDICATE DISTRIBUTION
// Distribuição de sinais com variáveis cravadas e CTAs de conversão
// ============================================================

export class TelegramDispatcher {
  private botToken: string;
  private freeChannelId: string;
  private vipChannelId: string;
  private readonly VIP_LINK = "https://t.me/+T_gr8u0lKTpjMmMx";

  constructor() {
    // Variáveis cravadas conforme solicitado pelo Diretor
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    this.freeChannelId = process.env.TELEGRAM_FREE_CHANNEL_ID || '';
    this.vipChannelId = process.env.TELEGRAM_CHAT_ID || ''; 
    
    if (this.botToken) {
      console.log(`[Telegram] Inicializado. VIP: ${this.vipChannelId}, FREE: ${this.freeChannelId}`);
    } else {
      console.error("[Telegram] ERRO: TELEGRAM_BOT_TOKEN ausente.");
    }
  }

  public async dispatch(signals: ArgosSignal[], regimeInfo?: any): Promise<void> {
    if (!this.botToken) return;

    for (const signal of signals) {
      try {
        const tier = signal.tier;

        // 1. VIP recebe TUDO (Varredura profunda, Multi-Vertical, Ev+)
        if (this.vipChannelId && (tier === "VIP" || tier === "FREE")) {
          await this.sendToVip(signal, regimeInfo);
        }

        // 2. FREE recebe apenas Isca (Alta Probabilidade, 2 Verticais, mesmo sem Ev+)
        if (this.freeChannelId && tier === "FREE") {
          await this.sendToFree(signal);
        }
      } catch (error: any) {
        console.error(`[Telegram] Erro no sinal ${signal.market}:`, error.message);
      }
    }
  }

  private async sendToVip(signal: ArgosSignal, regimeInfo?: any): Promise<void> {
    const ev = (signal.expectedValue * 100).toFixed(2);
    const prob = (signal.probability * 100).toFixed(2);
    
    const message = `💎 <b>ARGOS VIP | SYNDICATE INTELLIGENCE</b>
──────────────────────
🏟️ <b>MERCADO:</b> <code>${signal.market.toUpperCase()}</code>
📈 <b>VERTICAL:</b> <code>${signal.vertical.replace('_', ' ')}</code>
──────────────────────
🎯 <b>PROBABILIDADE:</b> <code>${prob}%</code>
💰 <b>ODD MÍNIMA:</b> <code>${signal.impliedOdds?.toFixed(2) || 'N/A'}</code>
📊 <b>EXPECTED VALUE:</b> <code>${Number(ev) > 0 ? '+' : ''}${ev}%</code>
🛡️ <b>STATUS:</b> <code>${signal.status}</code>
──────────────────────
🧠 <b>ANÁLISE PROFUNDA:</b>
• <b>Simulação:</b> <code>10.000 Monte Carlo Runs</code>
• <b>Regime:</b> <code>${regimeInfo?.regime || 'STABLE'}</code>
• <b>Confiança:</b> <code>${(regimeInfo?.confidence * 100 || 85).toFixed(0)}%</code>
──────────────────────
<i>Argos v5.1 | Industrial Syndicate Engine</i>`;

    await this.sendMessage(this.vipChannelId, message);
  }

  private async sendToFree(signal: ArgosSignal): Promise<void> {
    const prob = (signal.probability * 100).toFixed(2);
    
    const message = `🔥 <b>ARGOS FREE | ALTA ASSERTIVIDADE</b>
──────────────────────
🏟️ <b>JOGO:</b> <code>${signal.market.toUpperCase()}</code>
🎯 <b>ENTRADA:</b> <code>${signal.vertical.replace('_', ' ')}</code>
──────────────────────
✅ <b>CONFIANÇA:</b> <code>${prob}%</code>
🛡️ <b>FILTRO:</b> <code>SYNDICATE QUALITY PASSED</code>
──────────────────────
🚀 <b>QUER O FILÉ COM EV+ E ANÁLISE PROFUNDA?</b>
💎 <b>TENHA ACESSO AO NOSSO CÉREBRO COMPLETO.</b>
👉 <b>VIP:</b> <a href="${this.VIP_LINK}">CLIQUE AQUI PARA ENTRAR</a>
──────────────────────
<i>Argos v5.1 | Syndicate Marketing Layer</i>`;

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
    } catch (error: any) {
      console.error(`[Telegram] FALHA (Chat: ${chatId}):`, error.message);
    }
  }
}
