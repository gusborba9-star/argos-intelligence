import { getSupabaseClient } from "@/lib/core/SupabaseClient";
import { ArgosSignal } from "@/lib/core/contracts/SignalContract";
import { MarketVertical } from "@/lib/core/ArgosUnifiedEngine";
import { NotificationService } from "@/lib/argos/notifications/NotificationService";
import { ClassifiedSignal, SignalType } from "@/lib/core/SignalClassifierV4";

export interface UserTier {
  user_id: string;
  tier_level: 'FREE' | 'PRO' | 'WHALE/VIP';
  subscribed_at: string;
  expires_at: string | null;
}

export class ValueDeliveryService {
  private supabase;
  private notificationService: NotificationService;

  constructor() {
    this.supabase = getSupabaseClient();
    this.notificationService = new NotificationService();
  }

  /**
   * Obtém o tier de um usuário.
   * @param userId O ID do usuário.
   * @returns O tier do usuário ou 'FREE' se não encontrado.
   */
  public async getUserTier(userId: string): Promise<UserTier['tier_level']> {
    const { data, error } = await this.supabase
      .from('user_tiers')
      .select('tier_level')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = No rows found
      console.error("[ValueDeliveryService] Erro ao buscar tier do usuário:", error);
      return 'FREE';
    }
    return data?.tier_level || 'FREE';
  }

  /**
   * Filtra os sinais com base no tier do usuário.
   * - FREE: Apenas sinais de 'Validation' (EV neutro).
   * - PRO: Sinais de 'Value' (EV positivo) + 'Validation'.
   * - WHALE/VIP: Todos os sinais (Value, Validation, Noise) + Kelly Criterion.
   * @param signals Sinais classificados pelo Argos.
   * @param userTier Tier do usuário.
   * @returns Sinais filtrados.
   */
  public filterSignalsByTier(
    signals: any[],
    userTier: UserTier['tier_level']
  ): any[] {
    switch (userTier) {
      case 'FREE':
        return signals.filter(s => s.signal_type === SignalType.VALIDATION || s.status === 'HEDGED');
      case 'PRO':
        return signals.filter(s => s.signal_type === SignalType.VALUE || s.signal_type === SignalType.VALIDATION || s.status === 'OPTIMIZED' || s.status === 'HEDGED');
      case 'WHALE/VIP':
        // WHALE/VIP recebe todos os sinais, a lógica de Kelly será aplicada posteriormente
        return signals;
      default:
        return [];
    }
  }

  /**
   * Calcula a stake ideal usando o Kelly Criterion para sinais de 'Value'.
   * Apenas para usuários WHALE/VIP.
   * @param signal O sinal de aposta.
   * @param bankroll O capital total disponível para apostas.
   * @returns A fração da banca a ser apostada.
   */
  public calculateKellyCriterion(signal: any, bankroll: number): number {
    if ((signal.signal_type !== SignalType.VALUE && signal.status !== 'OPTIMIZED') || !signal.impliedOdds || signal.expectedValue <= 0) {
      return 0; // Kelly só se aplica a apostas de valor com EV positivo
    }

    const b = signal.impliedOdds - 1; // Decimal odds - 1
    const p = signal.probability; // Probabilidade de vitória do modelo
    const q = 1 - p; // Probabilidade de perda

    // Fórmula de Kelly: f = (bp - q) / b
    const kellyFraction = (b * p - q) / b;

    // Clamp para evitar apostas muito agressivas ou negativas
    return Math.max(0, Math.min(0.10, kellyFraction)); // Limite de 10% da banca para Kelly fracionário
  }

  /**
   * Envia notificações de sinais para o usuário (Telegram/Discord).
   * @param signal O sinal a ser notificado.
   * @param tier Tier do usuário.
   * @param notificationChannels Canais de notificação ('telegram', 'discord').
   */
  public async sendSignalNotifications(
    signal: any,
    tier: UserTier['tier_level'],
    notificationChannels: string[] = ['telegram', 'discord']
  ): Promise<void> {
    for (const channel of notificationChannels) {
      if (channel === 'telegram') {
        await this.notificationService.sendToTelegram(signal, tier);
      } else if (channel === 'discord') {
        await this.notificationService.sendToDiscord(signal, tier);
      }
    }
  }

  /**
   * Registra a entrega de um sinal no log.
   * @param userId ID do usuário.
   * @param signal O sinal entregue.
   * @param tier Tier do usuário no momento da entrega.
   * @param deliveryMethod Método de entrega (e.g., 'TELEGRAM', 'DISCORD', 'DASHBOARD').
   */
  public async logSignalDelivery(
    userId: string,
    signal: any,
    tier: UserTier['tier_level'],
    deliveryMethod: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('signal_delivery_log')
      .insert({
        user_id: userId,
        signal_id: signal.id, // Assumindo que ArgosSignal terá um ID após persistência
        delivered_at: new Date().toISOString(),
        tier_at_delivery: tier,
        delivery_method: deliveryMethod,
        settled_status: 'PENDING' // Status inicial
      });

    if (error) {
      console.error("[ValueDeliveryService] Erro ao logar entrega de sinal:", error);
    }
  }
}
