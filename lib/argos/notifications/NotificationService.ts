import axios from 'axios';
import { ArgosSignal } from '@/lib/core/contracts/SignalContract';

export interface NotificationConfig {
  telegram_bot_token?: string;
  telegram_chat_id?: string;
  discord_webhook_url?: string;
}

export class NotificationService {
  private telegramBotToken: string;
  private telegramChatId: string;
  private discordWebhookUrl: string;

  constructor(config: NotificationConfig = {}) {
    this.telegramBotToken = config.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN || '';
    this.telegramChatId = config.telegram_chat_id || process.env.TELEGRAM_CHAT_ID || '';
    this.discordWebhookUrl = config.discord_webhook_url || process.env.DISCORD_WEBHOOK_URL || '';
  }

  /**
   * Envia um sinal para o Telegram.
   * @param signal O sinal a ser enviado.
   * @param userTier Tier do usuário.
   */
  public async sendToTelegram(signal: ArgosSignal, userTier: string): Promise<void> {
    if (!this.telegramBotToken || !this.telegramChatId) {
      console.warn('[NotificationService] Telegram não configurado.');
      return;
    }

    const message = this.formatSignalMessage(signal, userTier);
    const url = `https://api.telegram.org/bot${this.telegramBotToken}/sendMessage`;

    try {
      await axios.post(url, {
        chat_id: this.telegramChatId,
        text: message,
        parse_mode: 'HTML'
      });
      console.log('[NotificationService] Sinal enviado para Telegram com sucesso.');
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
    const tierEmoji = userTier === 'WHALE/VIP' ? '🐋' : userTier === 'PRO' ? '⭐' : '📊';
    
    return `
${tierEmoji} <b>Novo Sinal do Argos</b>

<b>Mercado:</b> ${signal.market}
<b>Vertical:</b> ${signal.vertical}
<b>Probabilidade:</b> ${(signal.probability * 100).toFixed(2)}%
<b>Odd Implícita:</b> ${signal.impliedOdds?.toFixed(2) || 'N/A'}
<b>EV:</b> ${signal.expectedValue.toFixed(4)}
<b>Status:</b> ${signal.status}

🎯 <i>Argos Market Vigilante | v4.5</i>
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
