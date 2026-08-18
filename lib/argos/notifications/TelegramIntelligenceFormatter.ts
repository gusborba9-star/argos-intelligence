// ============================================================
// ARGOS TELEGRAM INTELLIGENCE FORMATTER v1.0
// Neutral presentation layer for sports intelligence.
// This formatter intentionally contains no price, EV, Kelly, staking,
// bankroll or call-to-action semantics.
// ============================================================

export interface TelegramPredictionSummary {
  matchName: string;
  leagueName: string;
  kickoffTime: string;
  modelVersion: string;
  featureVersion: string;
  expectedGoalsHome: number;
  expectedGoalsAway: number;
  homeWin: number;
  draw: number;
  awayWin: number;
  bttsYes: number;
  uncertaintyLabel?: string;
  context?: string[];
}

export class TelegramIntelligenceFormatter {
  static format(summary: TelegramPredictionSummary): string {
    const kickoff = new Date(summary.kickoffTime).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
    });

    const pct = (value: number) => `${(value * 100).toFixed(1)}%`;

    let message = `🧠 <b>ARGOS FOOTBALL INTELLIGENCE</b>\n\n`;
    message += `⚽ <b>${this.escape(summary.matchName)}</b>\n`;
    message += `🏆 ${this.escape(summary.leagueName)}\n`;
    message += `🕒 ${kickoff}\n\n`;

    message += `📊 <b>PROJEÇÃO QUANTITATIVA</b>\n`;
    message += `├ Mandante: <b>${pct(summary.homeWin)}</b>\n`;
    message += `├ Empate: <b>${pct(summary.draw)}</b>\n`;
    message += `└ Visitante: <b>${pct(summary.awayWin)}</b>\n\n`;

    message += `⚽ <b>GOLS ESPERADOS</b>\n`;
    message += `├ Mandante: ${summary.expectedGoalsHome.toFixed(2)}\n`;
    message += `├ Visitante: ${summary.expectedGoalsAway.toFixed(2)}\n`;
    message += `└ Total: ${(summary.expectedGoalsHome + summary.expectedGoalsAway).toFixed(2)}\n\n`;

    message += `🔄 <b>AMBAS MARCAM</b>: ${pct(summary.bttsYes)}\n`;

    if (summary.uncertaintyLabel) {
      message += `\n🎚️ <b>Incerteza:</b> ${this.escape(summary.uncertaintyLabel)}\n`;
    }

    if (summary.context?.length) {
      message += `\n🧩 <b>Contexto considerado</b>\n`;
      for (const item of summary.context.slice(0, 5)) {
        message += `• ${this.escape(item)}\n`;
      }
    }

    message += `\n🔬 <i>Modelo: ${this.escape(summary.modelVersion)} | Features: ${this.escape(summary.featureVersion)}</i>`;
    return message;
  }

  private static escape(value: string): string {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
}
