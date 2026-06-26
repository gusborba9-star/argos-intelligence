import axios from 'axios';
import { RegimeProfile } from "@/lib/argos/regime/RegimeSchema";

/**
 * TELEGRAM DISPATCHER v6.0.0 — SYNDICATE MASTER DISTRIBUTION
 * Distribuição seletiva com foco em conversão e transparência VIP.
 */
export class TelegramDispatcher {
  private botToken: string;
  private freeChannelId: string;
  private vipChannelId: string;
  private readonly VIP_LINK = "https://t.me/+T_gr8u0lKTpjMmMx";

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || "";
    this.freeChannelId = process.env.TELEGRAM_FREE_CHANNEL_ID || "";
    this.vipChannelId = process.env.TELEGRAM_CHAT_ID || ""; 
  }

  /**
   * Despacha sinais de forma seletiva para os canais FREE e VIP.
   */
  async dispatch(signals: any[], regime: RegimeProfile): Promise<void> {
    if (!this.botToken || signals.length === 0) return;

    for (const signal of signals) {
      // 1. Envio para o VIP (Recebe TUDO: FREE + VIP)
      if (signal.tier === "VIP" || signal.tier === "FREE") {
        await this.sendToTelegram(this.vipChannelId, this.formatVipMessage(signal, regime), 'HTML');
      }

      // 2. Envio para o FREE (Recebe apenas o filé com CTA)
      if (signal.tier === "FREE") {
        await this.sendToTelegram(this.freeChannelId, this.formatFreeMessage(signal), 'HTML');
      }
    }
  }

  private formatVipMessage(signal: any, regime: RegimeProfile): string {
    const edgeEmoji = signal.edge > 0.1 ? "💎" : "✅";
    const ev = (signal.edge * 100).toFixed(2);
    const prob = (signal.probability * 100).toFixed(0);
    
    return `<b>${edgeEmoji} OPORTUNIDADE VIP | ARGOS v6.0</b>
──────────────────────
🏟️ <b>JOGO:</b> <code>${signal.home_team || 'Time A'} vs ${signal.away_team || 'Time B'}</code>
🎯 <b>MERCADO:</b> <code>${signal.vertical}</code>
📊 <b>LINHA:</b> <code>${signal.line}</code>
──────────────────────
💰 <b>ODD:</b> <code>${signal.odd.toFixed(2)}</code> (Fair: <code>${signal.fairOdd.toFixed(2)}</code>)
📈 <b>EDGE:</b> <code>${Number(ev) > 0 ? '+' : ''}${ev}%</code>
🧠 <b>CONFIANÇA:</b> <code>${prob}%</code>
──────────────────────
🏛️ <b>REGIME:</b> <code>${regime.regime}</code>
📐 <b>KELLY:</b> <code>${(signal.kellyCriterion * 100).toFixed(1)}%</code>
──────────────────────
<i>Argos Syndicate Master Engine</i>`;
  }

  private formatFreeMessage(signal: any): string {
    const prob = (signal.probability * 100).toFixed(0);
    return `🔥 <b>SINAL FREE | ALTA ASSERTIVIDADE</b>
──────────────────────
🏟️ <b>JOGO:</b> <code>${signal.home_team || 'Time A'} vs ${signal.away_team || 'Time B'}</code>
🎯 <b>ENTRADA:</b> <code>${signal.vertical}</code>
📊 <b>CONFIANÇA:</b> <code>${prob}%</code>
──────────────────────
🚀 <b>QUER O EDGE REAL E TODAS AS VERTICAIS?</b>
As melhores oportunidades com +10% de Edge estão no VIP.

👉 <b>VIP:</b> <a href="${this.VIP_LINK}">CLIQUE AQUI PARA ENTRAR</a>
──────────────────────
<i>Argos Syndicate Marketing Layer</i>`;
  }

  private async sendToTelegram(chatId: string, text: string, parseMode: string): Promise<void> {
    if (!chatId) return;
    try {
      await axios.post(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        chat_id: chatId,
        text: text,
        parse_mode: parseMode,
        disable_web_page_preview: true
      });
    } catch (error: any) {
      console.error(`[Telegram-Error] Falha ao enviar para ${chatId}:`, error.message);
    }
  }
}
