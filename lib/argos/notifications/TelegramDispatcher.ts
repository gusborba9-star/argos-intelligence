import axios from "axios";
import { getSupabaseClient } from "@/lib/core/SupabaseClient";

// ============================================================
// TELEGRAM DISPATCHER v6.1.0 — SYNDICATE MASTER EDITION
// Gestão de Canais FREE e VIP com Informações Totais e Agrupamento.
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
  kellyCriterion: number;
  ratingLabel: string;
  tier: "FREE" | "VIP";
  line?: number;
  analysisSummary?: string;
}

export class TelegramDispatcher {
  private botToken = process.env.TELEGRAM_BOT_TOKEN;
  private freeChannelId = process.env.TELEGRAM_FREE_CHANNEL_ID;
  private vipChannelId = process.env.TELEGRAM_CHAT_ID;
  private readonly VIP_LINK = "https://t.me/+T_gr8u0lKTpjMmMx";

  /**
   * Despacha múltiplos sinais para os canais específicos, agrupando por partida.
   */
  public async dispatch(payloads: TelegramSignalPayload[], regime?: any) {
    if (!this.botToken) {
      console.error("[Telegram] ❌ Bot Token ausente.");
      return;
    }

    // Agrupar sinais por partida para enviar um único post rico por jogo
    const matchGroups: Record<string, TelegramSignalPayload[]> = {};
    
    for (const p of payloads) {
      const key = `${p.matchName}_${p.tier}`;
      if (!matchGroups[key]) matchGroups[key] = [];
      matchGroups[key].push(p);
    }

    for (const [key, signals] of Object.entries(matchGroups)) {
      const first = signals[0];
      const tier = first.tier;
      const channelId = tier === "FREE" ? this.freeChannelId : this.vipChannelId;

      if (!channelId) {
        console.error(`[Telegram] ❌ Canal ${tier} não configurado.`);
        continue;
      }

      const message = tier === "FREE" 
        ? this.formatFreeMessage(signals, regime) 
        : this.formatVipMessage(signals, regime);

      await this.sendToQueue(channelId, message);
    }
  }

  private formatFreeMessage(signals: TelegramSignalPayload[], regime?: any): string {
    const s = signals[0];
    const kickoff = new Date(s.kickoffTime).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    
    // FREE: Máximo 2 mercados de alta probabilidade — priorizando MERCADOS
    // DIFERENTES (ex: Winner + BTTS), não duas linhas do mesmo mercado
    // (ex: Over 2.5 e Over 5.5 contam como um só "GOALS").
    const seenVerticals = new Set<string>();
    const topSignals: TelegramSignalPayload[] = [];
    for (const sig of [...signals].sort((a, b) => b.probability - a.probability)) {
      if (seenVerticals.has(sig.vertical)) continue;
      seenVerticals.add(sig.vertical);
      topSignals.push(sig);
      if (topSignals.length === 2) break;
    }

    let msg = `🆓 <b>ARGOS FREE SIGNAL</b> 🆓\n\n`;
    msg += `⚽ <b>Jogo</b>: <code>${s.matchName}</code>\n`;
    msg += `🏆 <b>Liga</b>: ${s.leagueName}\n`;
    msg += `📅 <b>Data/Hora</b>: ${kickoff}\n\n`;
    msg += `🎯 <b>Sugestões de Alta Probabilidade</b>:\n`;

    topSignals.forEach(sig => {
      const probLabel = sig.probability >= 0.75 ? "🔥 ALTA" : "⚡ MÉDIA";
      msg += `\n• ${this.getVerticalEmoji(sig.vertical)} <b>${sig.vertical}</b>: <b>${sig.selection}</b> ${sig.line ? `(${sig.line})` : ''} @ ${sig.odd.toFixed(2)}\n`;
      msg += `  └ Probabilidade: ${probLabel} (<b>${(sig.probability * 100).toFixed(1)}%</b>)\n`;
      msg += `  └ <i>${this.buildFreeRationale(sig)}</i>\n`;
    });

    msg += `\n🧠 <b>Leitura do jogo</b>: <i>Regime ${regime?.market_regime === 'VOLATILE' ? 'volátil (mais variância que o normal)' : 'estável'} para essa partida — a seleção acima foi a de maior probabilidade calculada pelo nosso modelo, sem considerar se a odd paga bem ou não (isso é o trabalho do VIP: achar onde a odd paga MAIS do que deveria).</i>\n`;
    msg += `\n🚀 <a href="${this.VIP_LINK}">QUER ANÁLISE PROFUNDA E TODOS OS MERCADOS? ENTRE NO VIP!</a>`;
    return msg;
  }

  private buildFreeRationale(sig: TelegramSignalPayload): string {
    const pct = (sig.probability * 100).toFixed(0);
    switch (sig.vertical) {
      case "GOALS":
        return sig.selection === "Over"
          ? `Modelo aponta ${pct}% de chance desse jogo passar de ${sig.line} gols.`
          : `Modelo aponta ${pct}% de chance desse jogo ficar abaixo de ${sig.line} gols.`;
      case "BTTS":
        return sig.selection === "Yes"
          ? `Modelo aponta ${pct}% de chance de AMBOS os times marcarem.`
          : `Modelo aponta ${pct}% de chance de pelo menos um time NÃO marcar.`;
      case "WINNER":
        return `Modelo aponta ${pct}% de chance de vitória para ${sig.selection === "Home" ? "o mandante" : sig.selection === "Away" ? "o visitante" : "empate"}.`;
      case "HANDICAP":
        return `Modelo aponta ${pct}% de chance de ${sig.selection} cobrir o handicap de ${sig.line}.`;
      default:
        return `Modelo aponta ${pct}% de probabilidade para essa seleção.`;
    }
  }

  private formatVipMessage(signals: TelegramSignalPayload[], regime?: any): string {
    const s = signals[0];
    const kickoff = new Date(s.kickoffTime).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

    // Mercados de linha (Goals, Handicap) podem gerar várias linhas próximas
    // e correlacionadas (Over 1.5/2.5/3.5...) — isso lota a mensagem com o
    // mesmo mercado repetido. Mantém só a de MAIOR EV por mercado, abrindo
    // espaço pra diversidade real (Vencedor, BTTS, Escanteios, Cartões...).
    const LINE_BASED_VERTICALS = new Set(["GOALS", "HANDICAP"]);
    const bestByVertical = new Map<string, TelegramSignalPayload>();
    const passthrough: TelegramSignalPayload[] = [];

    for (const sig of signals) {
      if (LINE_BASED_VERTICALS.has(sig.vertical)) {
        const current = bestByVertical.get(sig.vertical);
        if (!current || sig.expectedValue > current.expectedValue) {
          bestByVertical.set(sig.vertical, sig);
        }
      } else {
        passthrough.push(sig);
      }
    }
    const displaySignals = [...bestByVertical.values(), ...passthrough]
      .sort((a, b) => b.expectedValue - a.expectedValue);

    let msg = `💎 <b>ARGOS SYNDICATE VIP</b> 💎\n\n`;
    msg += `⚽ <b>Jogo</b>: <code>${s.matchName}</code>\n`;
    msg += `🏆 <b>Liga</b>: ${s.leagueName}\n`;
    msg += `📅 <b>Data/Hora</b>: ${kickoff}\n`;
    msg += `📊 <b>Regime</b>: <code>${regime?.market_regime || 'ESTÁVEL'}</code> | Var: <code>${regime?.variance_multiplier || '1.1'}x</code>\n\n`;

    msg += `📑 <b>VARREDURA TOTAL DE MERCADOS</b>:\n`;

    displaySignals.forEach(sig => {
      const evLabel = (sig.expectedValue * 100).toFixed(1);
      const ratingEmoji = sig.ratingLabel === "ELITE" ? "🌟" : "✅";

      msg += `──────────────────────\n`;
      msg += `${ratingEmoji} <b>${sig.vertical}</b>\n`;
      msg += `   Seleção: <code>${sig.selection}</code> ${sig.line ? `(${sig.line})` : ''}\n`;
      msg += `   Odd: <b>${sig.odd.toFixed(2)}</b> | Fair: <code>${sig.fairOdd.toFixed(2)}</code>\n`;
      msg += `   EV: <b>+${evLabel}%</b> | Prob: <b>${(sig.probability * 100).toFixed(1)}%</b>\n`;
      msg += `   Kelly Sugerido: <code>${(sig.kellyCriterion * 100).toFixed(1)}%</code>\n`;
    });

    if (s.analysisSummary) {
      msg += `\n🧠 <b>Análise Profunda</b>:\n<i>${s.analysisSummary}</i>\n`;
    }

    msg += `\n🛡️ <i>Gestão de banca é obrigatória. Siga o Kelly.</i>`;
    return msg;
  }

  private async sendToQueue(chatId: string, text: string) {
    const supabase = getSupabaseClient();
    try {
      // Usar a fila de mensagens do Supabase para garantir entrega e evitar rate limit do Telegram
      const { error } = await supabase.from('argos_http_queue').insert({
        url: `https://api.telegram.org/bot${this.botToken}/sendMessage`,
        method: 'POST',
        headers: { "Content-Type": "application/json" },
        // A coluna `body` é do tipo TEXT no banco — precisa ir serializada.
        // O argos-http-worker (edge function) já faz JSON.parse/stringify corretamente ao ler.
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: "HTML",
          disable_web_page_preview: true
        }),
        status: 'PENDING'
      });

      if (error) throw error;
      console.log(`[Telegram] ✅ Mensagem enfileirada para ${chatId}`);
    } catch (error: any) {
      console.error(`[Telegram] ❌ Erro ao enfileirar mensagem:`, error.message);
    }
  }

  private getVerticalEmoji(v: string): string {
    const m: Record<string, string> = {
      WINNER: "🏁",
      GOALS: "⚽",
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
