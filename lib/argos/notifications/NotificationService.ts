import axios from 'axios';
import { ArgosSignal } from '@/lib/core/contracts/SignalContract';

export interface NotificationConfig {
  telegram_bot_token?: string;
  telegram_free_chat_id?: string;
  telegram_vip_chat_id?: string;
  discord_webhook_url?: string;
}

export class NotificationService {
  private telegramBotToken: string;
  private telegramFreeChatId: string;
  private telegramVipChatId: string;
  private discordWebhookUrl: string;
  private readonly CHECKOUT_URL = "https://mhdwqskmkyhtpwusgikc.supabase.co/rest/v1/"; // URL da Efí conforme fornecido

  constructor(config: NotificationConfig = {}) {
    this.telegramBotToken = config.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN || '';
    this.telegramFreeChatId = config.telegram_free_chat_id || process.env.TELEGRAM_FREE_CHANNEL_ID || '';
    this.telegramVipChatId = config.telegram_vip_chat_id || process.env.TELEGRAM_VIP_CHANNEL_ID || '';
    this.discordWebhookUrl = config.discord_webhook_url || process.env.DISCORD_WEBHOOK_URL || '';
  }

  /**
   * Envia um sinal para o Telegram.
   * @param signal O sinal a ser enviado.
   * @param userTier Tier do usuário.
   */
  public async sendToTelegram(signal: ArgosSignal, userTier: string): Promise<void> {
    if (!this.telegramBotToken) {
      console.warn('[NotificationService] Telegram Bot Token não configurado.');
      return;
    }

    // Roteamento de Canais Nexus Intelligence System (NIS)
    const targetChatId = userTier === 'WHALE/VIP' ? this.telegramVipChatId : this.telegramFreeChatId;
    
    if (!targetChatId) {
      console.warn(`[NotificationService] Chat ID para tier ${userTier} não configurado.`);
      return;
    }

    // Filtros de Canal Free (Motor de Conversão)
    if (userTier !== 'WHALE/VIP') {
      const allowedVerticals = ['WINNER', 'GOALS', 'GOALS_HT'];
      if (!allowedVerticals.includes(signal.vertical)) return;
      
      // Filtro específico de Gols para Free: Over 1.5 e Under 4.5
      if (signal.vertical === 'GOALS') {
        const isAllowedGoal = signal.market.toUpperCase().includes('OVER 1.5') || signal.market.toUpperCase().includes('UNDER 4.5');
        if (!isAllowedGoal) return;
      }
    }

    const message = this.formatSignalMessage(signal, userTier);
    const url = `https://api.telegram.org/bot${this.telegramBotToken}/sendMessage`;

    try {
      await axios.post(url, {
        chat_id: targetChatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      });
      console.log(`[NotificationService] Sinal enviado para Telegram (${userTier}) com sucesso.`);
    } catch (error: any) {
      console.error('[NotificationService] Erro ao enviar para Telegram:', error.message);
    }
  }

  /**
   * Envia um sinal para o Discord.
   * @param signal O sinal a ser enviado.
   * @param userTier Tier do usuário.
   */
  public async sendToDiscord(signal: ArgosSignal, userTier: string): Promise<void> {
    if (!this.discordWebhookUrl) {
      console.warn('[NotificationService] Discord não configurado.');
      return;
    }

    const embed = this.formatSignalEmbed(signal, userTier);

    try {
      await axios.post(this.discordWebhookUrl, {
        embeds: [embed]
      });
      console.log('[NotificationService] Sinal enviado para Discord com sucesso.');
    } catch (error: any) {
      console.error('[NotificationService] Erro ao enviar para Discord:', error.message);
    }
  }

  /**
   * Formata a mensagem do sinal para Telegram.
   */
  private formatSignalMessage(signal: ArgosSignal, userTier: string): string {
    const isVip = userTier === 'WHALE/VIP';
    const header = isVip ? "💎 <b>NEXUS ARGOS VIP | INTELIGÊNCIA MÁXIMA</b>" : "📊 <b>ARGOS FREE | NEXUS INTELLIGENCE</b>";
    const cta = isVip ? "" : `\n\n🚀 <b>QUER ACESSO TOTAL E OPORTUNIDADES VIP?</b>\n👉 <a href="${this.CHECKOUT_URL}">ASSINE O ARGOS VIP AGORA</a>`;
    
    return `
${header}
──────────────────────
<b>🏟️ MERCADO:</b> <code>${signal.market.toUpperCase()}</code>
<b>📈 VERTICAL:</b> <code>${signal.vertical.replace('_', ' ')}</code>
──────────────────────
<b>🎯 PROBABILIDADE:</b> <code>${(signal.probability * 100).toFixed(2)}%</code>
<b>💰 ODD MÍNIMA:</b> <code>${signal.impliedOdds?.toFixed(2) || 'N/A'}</code>
${isVip ? `<b>📊 EXPECTED VALUE:</b> <code>+${(signal.expectedValue * 100).toFixed(2)}%</code>\n` : ''}<b>🛡️ STATUS:</b> <code>${signal.status}</code>
──────────────────────
<i>NIS v5.0 | Nexus Ultra Design System</i>${cta}
    `.trim();
  }

  /**
   * Formata o embed do sinal para Discord.
   */
  private formatSignalEmbed(signal: ArgosSignal, userTier: string) {
    const tierColor = userTier === 'WHALE/VIP' ? 0x9D4EDD : userTier === 'PRO' ? 0xFFD60A : 0x457B9D;

    return {
      title: `🎯 Novo Sinal - ${signal.market}`,
      description: `Vertical: **${signal.vertical}**`,
      color: tierColor,
      fields: [
        {
          name: 'Probabilidade',
          value: `${(signal.probability * 100).toFixed(2)}%`,
          inline: true
        },
        {
          name: 'Odd Implícita',
          value: signal.impliedOdds?.toFixed(2) || 'N/A',
          inline: true
        },
        {
          name: 'Expected Value',
          value: signal.expectedValue.toFixed(4),
          inline: true
        },
        {
          name: 'Status',
          value: signal.status,
          inline: true
        },
        {
          name: 'Tier do Usuário',
          value: userTier,
          inline: true
        }
      ],
      footer: {
        text: 'Argos v4.5 | Market Vigilante'
      },
      timestamp: new Date().toISOString()
    };
  }
}
