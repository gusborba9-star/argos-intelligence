import { GoogleGenerativeAI } from "@google/generative-ai";
import { MarketRegime, RegimeProfile } from "./RegimeSchema";

// ============================================================
// REGIME ENGINE v4.1 — CONTEXTUAL INTELLIGENCE
// Integração de RAG + Fatores Externos (Árbitro, Clima, Motivação)
// ============================================================

export interface ExternalFactors {
  refereeStrictness: number; // 0.8 (permissivo) -> 1.2 (rigoroso)
  weatherCondition: 'CLEAR' | 'RAIN' | 'EXTREME_HEAT';
  motivationLevel: 'NORMAL' | 'HIGH' | 'LOW'; // Final, Rebaixamento, Amistoso
  isDerby: boolean;
}

export class RegimeEngineV4 {
  private genAI: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Analisa o contexto extraído pelo RAG e fatores externos para definir o Regime de Mercado
   */
  async analyze(input: {
    matchId: string;
    leagueId?: string;
    contextEvidence: any;
    factors?: ExternalFactors;
  }): Promise<RegimeProfile> {
    const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `Analise o contexto do jogo ${input.matchId} e classifique o regime de mercado.
    Contexto: ${JSON.stringify(input.contextEvidence)}
    Fatores Externos: ${JSON.stringify(input.factors)}
    
    Responda APENAS com um JSON seguindo o RegimeSchema:
    {
      "regime": "NORMAL | VOLATILE | DECISION | COMPRESSED | RELEGATION | DERBY",
      "confidence": 0.0 a 1.0,
      "model_bias": -0.05 a 0.05,
      "variance_multiplier": 0.5 a 1.5,
      "explanation": "string",
      "reasoning_tags": ["tag1", "tag2"]
    }`;

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const profile: RegimeProfile = JSON.parse(response.text().replace(/```json|```/g, ''));
      
      // Heurísticas de ajuste baseadas em fatores externos (Segurança Adicional)
      if (input.factors?.weatherCondition === 'RAIN') {
        profile.model_bias -= 0.02;
        profile.variance_multiplier *= 1.1;
      }

      return profile;
    } catch (error) {
      return {
        regime: MarketRegime.NORMAL,
        confidence: 0.5,
        model_bias: 0,
        variance_multiplier: 1.0,
        explanation: "Regime detectado (fallback): NORMAL",
        reasoning_tags: ["fallback"]
      };
    }
  }
}
