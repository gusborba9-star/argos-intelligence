import { GoogleGenerativeAI } from "@google/generative-ai";
import { MarketRegime, RegimeProfile } from "./RegimeSchema";

// ============================================================
// REGIME ENGINE v4.0
// ============================================================

export class RegimeEngineV4 {
  private genAI: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async analyze(input: {
    matchId: string;
    leagueId?: string;
    contextEvidence: any;
  }): Promise<RegimeProfile> {
    const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = `Analise o contexto do jogo ${input.matchId} e classifique o regime de mercado.
    Contexto: ${JSON.stringify(input.contextEvidence)}
    
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
      return JSON.parse(response.text().replace(/```json|```/g, ''));
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
