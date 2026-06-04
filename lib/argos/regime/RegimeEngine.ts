// ============================================================
// ARGOS v4.0 — REGIME ENGINE
// Context-aware market classification layer
// ============================================================

import {
  MarketRegime,
  RegimeProfile
} from "./RegimeSchema";

export interface RegimeInput {
  matchId: string;
  leagueId?: string;

  // sinais contextuais (RAG futuro vai enriquecer isso)
  oddsSpread?: number;
  injuryIndex?: number;
  importanceScore?: number; // 0–1
  volatilityIndex?: number; // 0–1
  historicalGoalsAvg?: number;
}

// ============================================================
// CORE ENGINE
// ============================================================
export class RegimeEngine {
  static analyze(input: RegimeInput): RegimeProfile {

    const {
      oddsSpread = 0,
      injuryIndex = 0,
      importanceScore = 0.5,
      volatilityIndex = 0.5,
      historicalGoalsAvg = 2.5
    } = input;

    // --------------------------------------------------------
    // 1. SCORE BASE (heurística inicial)
    // --------------------------------------------------------

    let score = 0;

    // alta importância → mais pressão emocional
    score += importanceScore * 2;

    // volatilidade estrutural
    score += volatilityIndex * 2;

    // lesões aumentam imprevisibilidade
    score += injuryIndex * 1.5;

    // odds comprimidas reduzem valor estatístico
    if (oddsSpread < 0.15) score += 1.2;

    // jogos muito ofensivos → volatilidade
    if (historicalGoalsAvg > 3) score += 0.8;

    // --------------------------------------------------------
    // 2. CLASSIFICAÇÃO
    // --------------------------------------------------------

    let regime: MarketRegime = MarketRegime.NORMAL;

    if (importanceScore > 0.75 && volatilityIndex > 0.6) {
      regime = MarketRegime.DECISION;
    }

    if (oddsSpread < 0.1) {
      regime = MarketRegime.COMPRESSED;
    }

    if (volatilityIndex > 0.75) {
      regime = MarketRegime.VOLATILE;
    }

    if (importanceScore > 0.85 && oddsSpread < 0.12) {
      regime = MarketRegime.RELEGATION;
    }

    if (importanceScore > 0.8 && volatilityIndex > 0.7 && oddsSpread < 0.2) {
      regime = MarketRegime.DERBY;
    }

    // --------------------------------------------------------
    // 3. NORMALIZAÇÃO DE CONFIANÇA
    // --------------------------------------------------------

    const confidence = Math.max(0.55, Math.min(0.98, score / 6));

    // --------------------------------------------------------
    // 4. AJUSTES DE MODELO
    // --------------------------------------------------------

    let model_bias = 0;
    let variance_multiplier = 1;

    switch (regime) {

      case MarketRegime.COMPRESSED:
        model_bias = -0.02;
        variance_multiplier = 0.75;
        break;

      case MarketRegime.VOLATILE:
        model_bias = +0.01;
        variance_multiplier = 1.4;
        break;

      case MarketRegime.DERBY:
        model_bias = +0.03;
        variance_multiplier = 1.25;
        break;

      case MarketRegime.RELEGATION:
        model_bias = +0.02;
        variance_multiplier = 1.2;
        break;

      case MarketRegime.DECISION:
        model_bias = +0.015;
        variance_multiplier = 1.15;
        break;

      default:
        model_bias = 0;
        variance_multiplier = 1;
    }

    // --------------------------------------------------------
    // 5. RAG PLACEHOLDER (futuro hook)
    // --------------------------------------------------------

    const reasoning_tags: string[] = [];

    if (oddsSpread < 0.12) reasoning_tags.push("compressed_odds");
    if (importanceScore > 0.8) reasoning_tags.push("high_stakes");
    if (volatilityIndex > 0.7) reasoning_tags.push("high_variance");

    return {
      regime,
      confidence,
      model_bias,
      variance_multiplier,
      reasoning_tags,
      explanation: `Regime detected: ${regime} (score=${score.toFixed(2)})`
    };
  }
  }
