import { TelegramDispatcher } from "./TelegramDispatcher";
import { ArgosSignal } from "@/lib/core/contracts/SignalContract";

/**
 * NOTIFICATION SERVICE v6.0.0 (WRAPPER)
 * Mantido para compatibilidade legado, roteando para o novo TelegramDispatcher Master.
 */
export class NotificationService {
  private dispatcher: TelegramDispatcher;

  constructor() {
    this.dispatcher = new TelegramDispatcher();
  }

  public async sendToTelegram(signal: ArgosSignal, userTier: string): Promise<any> {
    const mockRegime: any = { 
      regime: "STABLE", 
      confidence: 0.85,
      model_bias: 0,
      variance_multiplier: 1.0,
      reasoning_tags: ["LEGACY_WRAPPER"]
    };
    
    const signals = [{ 
      ...signal, 
      tier: userTier === 'WHALE/VIP' ? 'VIP' : 'FREE',
      home_team: signal.market || "Legacy Game",
      away_team: "",
      odd: (signal as any).odds || 0,
      fairOdd: (signal as any).impliedOdds || 0,
      edge: signal.expectedValue || 0,
      line: 0,
      selection: signal.market,
      probability: signal.probability || 0,
      confidence: 0.8,
      kellyCriterion: 0.02
    }] as any[];
    
    return this.dispatcher.dispatch(signals, mockRegime);
  }

  public async sendToDiscord(signal: ArgosSignal, userTier: string): Promise<void> {
    console.warn("[NotificationService] Discord delivery is deprecated in v6.0.0.");
  }
}
