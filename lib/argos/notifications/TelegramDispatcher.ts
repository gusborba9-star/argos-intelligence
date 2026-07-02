import axios from "axios";
import { RegimeProfile } from "@/lib/argos/regime/RegimeSchema";

// ============================================================
// TELEGRAM DISPATCHER v6.0.0 — SYNDICATE MASTER EDITION
// Gestão de Canais FREE e VIP com CTAs dinâmicos.
// Formatação profissional e automação de convites.
// ============================================================

export interface TelegramSignalPayload {
  matchName: string;
  leagueName: string;
  kickoffTime: string;
  vertical: string;
  selection: string;
  odd: number;
  fairOdd: number;
  expectedValue: number;
  probability: number;
  kellyCriterion?: number;
  ratingLabel?: string;
  analysisSummary?: string;
  tier: "FREE" | "VIP";
  source?: string;
  line?: number;
}

export class TelegramDispatcher {
  private botToken: string;
  private vipChatId: string;
  private freeChatId: string;
  
  private readonly VIP_LINK = "https://t.me/+T_gr8u0lKTpjMmMx";
  private readonly VIP_UPGRADE_URL = "https://argos-intelligence.app/upgrade";

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || "";
    this.vipChatId = process.env.TELEGRAM_CHAT_ID || ""; 
    this.freeChatId = process.env.TELEGRAM_FREE_CHANNEL_ID || ""; 
  }

  /**
   * Despacha sinais de forma seletiva para os canais FREE e VIP.
   */
  async dispatch(signals: TelegramSignalPayload[], regime?: RegimeProfile): Promise<any[]> {
    if (!this.botToken || signals.length === 0) return [{ error: "Bot token missing or no signals" }];

    const results = [];
    for (const signal of signals) {
      // 1. Envio para o VIP (Recebe TUDO)
      const vipRes = await this.sendToTelegram(this.vipChatId, this.formatVipMessage(signal, regime), 'HTML');
      results.push({ target: "VIP", ...vipRes });

      // 2. Envio para o FREE (Recebe apenas o filé com CTA)
      if (signal.tier === "FREE") {
        const freeRes = await this.sendToTelegram(this.freeChatId, this.formatFreeMessage(signal), 'HTML');
        results.push({ target: "FREE", ...freeRes });
      }
    }
    return results;
  }

  private formatVipMessage(p: TelegramSignalPayload, regime?: RegimeProfile): string {
    const header = "💎 <b>ARGOS VIP | SYNDICATE MASTER</b>";
    const emoji = this.getVerticalEmoji(p.vertical);
    const rating = p.ratingLabel === "ELITE" ? "⭐️ ELITE" : "✅ VALUE";
    const ev = (p.expectedValue * 100).toFixed(2);
    const prob = (p.probability * 100).toFixed(0);
    
    let msg = `${header}\n`;
    msg += `──────────────────────\n`;
    msg += `⚽️ <b>${p.matchName || p.source}</b>\n`;
    msg += `🏆 ${p.leagueName || "Liga de Elite"}\n`;
    msg += `⏰ ${p.kickoffTime ? new Date(p.kickoffTime).toLocaleString("pt-BR") : "Horário a confirmar"}\n\n`;
    
    msg += `🎯 <b>Entrada:</b> ${emoji} ${p.vertical} ${p.line ? `(${p.line})` : ""}\n`;
    msg += `📝 <b>Seleção:</b> <code>${p.selection}</code>\n`;
    msg += `📈 <b>Odd Atual:</b> <code>${p.odd.toFixed(2)}</code> (Fair: <code>${p.fairOdd.toFixed(2)}</code>)\n`;
    msg += `📊 <b>Edge:</b> <code>${Number(ev) > 0 ? '+' : ''}${ev}%</code>\n`;
    msg += `🧠 <b>Confiança:</b> <code>${prob}%</code>\n`;
    
    if (p.kellyCriterion) {
      msg += `📏 <b>Kelly (1/4):</b> <code>${(p.kellyCriterion * 100).toFixed(1)}%</code>\n`;
    }

    msg += `──────────────────────\n`;
    if (regime) {
      msg += `🏛️ <b>REGIME:</b> <code>${regime.regime}</code>\n`;
    }
    msg += `🤖 <b>Análise:</b> ${p.analysisSummary || "Alta confiança baseada em Monte Carlo e Regime de Mercado."}\n`;
    msg += `──────────────────────\n`;
    msg += `${rating}`;

    return msg;
  }

  private formatFreeMessage(p: TelegramSignalPayload): string {
    const prob = (p.probability * 100).toFixed(0);
    return `🔥 <b>SINAL FREE | ALTA ASSERTIVIDADE</b>\n` +
    `──────────────────────\n` +
    `🏟️ <b>JOGO:</b> <code>${p.matchName || p.source}</code>\n` +
    `🎯 <b>ENTRADA:</b> <code>${p.vertical}</code>\n` +
    `📊 <b>CONFIANÇA:</b> <code>${prob}%</code>\n` +
    `──────────────────────\n` +
    `🚀 <b>QUER O EDGE REAL E TODAS AS VERTICAIS?</b>\n` +
    `As melhores oportunidades com +10% de Edge estão no VIP.\n\n` +
    `👉 <b>VIP:</b> <a href="${this.VIP_LINK}">CLIQUE AQUI PARA ENTRAR</a>\n` +
    `──────────────────────\n` +
    `<i>Argos Syndicate Marketing Layer</i>`;
  }

  /**
   * Gera link de convite único para o canal VIP
   */
  async createVipInviteLink(userId: string): Promise<string | null> {
    try {
      const response = await axios.post(`https://api.telegram.org/bot${this.botToken}/createChatInviteLink`, {
        chat_id: this.vipChatId,
        name: `Acesso VIP - User ${userId}`,
        member_limit: 1, 
      });
      return response.data.result.invite_link;
    } catch (error: any) {
      console.error("[Telegram] Erro ao criar link de convite:", error.response?.data || error.message);
      return null;
    }
  }

  private async sendToTelegram(chatId: string, text: string, parseMode: string): Promise<any> {
    if (!chatId || !this.botToken) return { error: "Chat ID or Bot Token missing" };
    try {
      const response = await axios.post(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
        chat_id: chatId,
        text: text,
        parse_mode: parseMode,
        disable_web_page_preview: true
      });
      return { success: true, message_id: response.data.result.message_id };
    } catch (error: any) {
      const errorData = error.response?.data || error.message;
      console.error(`[Telegram-Error] Falha ao enviar para ${chatId}:`, errorData);
      return { success: false, error: errorData };
    }
  }

  private getVerticalEmoji(v: string): string {
    const m: Record<string, string> = {
      WINNER: "🏁",
      GOALS: "⚽️",
      GOALS_HT: "⏱",
      CORNERS: "🚩",
      CARDS: "🟨",
      SHOTS: "🚀",
      SHOTS_ON_TARGET: "🎯",
      BTTS: "🔄",
      HANDICAP: "⚖️",
    };
    return m[v] || "🔹";
  }
}

export const telegramDispatcher = new TelegramDispatcher();
