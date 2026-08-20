/** Canonical temporal contract shared by discovery and execution. */
export const ANALYSIS_HORIZON_HOURS = 48 as const;
export const ANALYSIS_HORIZON_MS = ANALYSIS_HORIZON_HOURS * 60 * 60 * 1000;

export interface AnalysisHorizonResult {
  eligible: boolean;
  hoursToKickoff: number;
  reason: "WITHIN_HORIZON" | "STARTED" | "BEYOND_HORIZON" | "INVALID_KICKOFF";
}

export function evaluateAnalysisHorizon(kickoff: Date | string | number, nowMs = Date.now()): AnalysisHorizonResult {
  const kickoffMs = kickoff instanceof Date ? kickoff.getTime() : new Date(kickoff).getTime();
  if (!Number.isFinite(kickoffMs)) {
    return { eligible: false, hoursToKickoff: Number.NaN, reason: "INVALID_KICKOFF" };
  }

  const delta = kickoffMs - nowMs;
  const hoursToKickoff = delta / (60 * 60 * 1000);
  if (delta < 0) return { eligible: false, hoursToKickoff, reason: "STARTED" };
  if (delta > ANALYSIS_HORIZON_MS) return { eligible: false, hoursToKickoff, reason: "BEYOND_HORIZON" };
  return { eligible: true, hoursToKickoff, reason: "WITHIN_HORIZON" };
}
