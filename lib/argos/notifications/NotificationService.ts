// ============================================================
// NOTIFICATION SERVICE v5.1 — DEPRECATED
// Redirecionado para TelegramDispatcher para unificação de lógica
// ============================================================

import { TelegramDispatcher } from "./TelegramDispatcher";
import { ArgosSignal } from "@/lib/core/contracts/SignalContract";

export class NotificationService {
  private dispatcher: TelegramDispatcher;

  constructor() {
    this.dispatcher = new TelegramDispatcher();
    console.warn("[NotificationService] AVISO: Este serviço está DEPRECATED. Use TelegramDispatcher diretamente.");
  }

  /**
   * Encaminha para o novo dispatcher unificado
   */
  public async sendToTelegram(signal: ArgosSignal, userTier: string): Promise<void> {
    // Converte o sinal individual em array para o novo dispatcher
    const signals = [{ ...signal, tier: userTier === 'WHALE/VIP' ? 'VIP' : 'FREE' }] as any[];
    return this.dispatcher.dispatch(signals);
  }

  public async sendToDiscord(signal: ArgosSignal, userTier: string): Promise<void> {
    console.log("[NotificationService] Discord integration disabled. Use Telegram.");
  }
}
