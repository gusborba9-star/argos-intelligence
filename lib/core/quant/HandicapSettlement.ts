export type HandicapOutcome = "WIN" | "HALF_WIN" | "PUSH" | "HALF_LOSS" | "LOSS";

export interface HandicapSettlementProbability {
  win: number;
  halfWin: number;
  push: number;
  halfLoss: number;
  loss: number;
}

export function emptySettlement(): HandicapSettlementProbability {
  return { win: 0, halfWin: 0, push: 0, halfLoss: 0, loss: 0 };
}

export function normalizeSettlement(value: HandicapSettlementProbability): HandicapSettlementProbability {
  const clean: HandicapSettlementProbability = {
    win: Math.max(0, Number(value.win) || 0),
    halfWin: Math.max(0, Number(value.halfWin) || 0),
    push: Math.max(0, Number(value.push) || 0),
    halfLoss: Math.max(0, Number(value.halfLoss) || 0),
    loss: Math.max(0, Number(value.loss) || 0),
  };
  const total = clean.win + clean.halfWin + clean.push + clean.halfLoss + clean.loss;
  if (total <= 0) return emptySettlement();
  return {
    win: clean.win / total,
    halfWin: clean.halfWin / total,
    push: clean.push / total,
    halfLoss: clean.halfLoss / total,
    loss: clean.loss / total,
  };
}

/** Splits an Asian quarter line into its two adjacent half/integer lines. */
export function splitAsianQuarterLine(line: number): [number, number] | null {
  if (!Number.isFinite(line)) return null;
  const quarter = Math.abs(line * 4 - Math.round(line * 4)) < 1e-9 && Math.abs(line * 2 - Math.round(line * 2)) >= 1e-9;
  if (!quarter) return null;
  const lower = Math.floor(line * 2) / 2;
  const upper = Math.ceil(line * 2) / 2;
  return [lower, upper];
}

export function combineQuarterSettlement(a: HandicapSettlementProbability, b: HandicapSettlementProbability): HandicapSettlementProbability {
  return normalizeSettlement({
    win: a.win * b.win,
    halfWin: a.win * b.push + a.push * b.win,
    push: a.push * b.push,
    halfLoss: a.push * b.loss + a.loss * b.push,
    loss: a.loss * b.loss,
  });
}
