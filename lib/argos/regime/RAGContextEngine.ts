import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getSanitizedSupabaseUrl } from "@/lib/core/SupabaseClient";

// ============================================================
// RAG CONTEXT ENGINE v4.0
// ============================================================

export interface ContextQueryResult {
  lesoes: string[];
  clima: string;
  motivacao: string;
  historico_confrontos: string;
  noticias_relevantes: string[];
}

export class RAGContextEngine {
  private supabase;
  private genAI;
  private model;

  constructor(supabaseUrl: string, supabaseKey: string, googleApiKey: string) {
    const sanitizedUrl = getSanitizedSupabaseUrl(supabaseUrl);
    this.supabase = createClient(sanitizedUrl, supabaseKey);
    this.genAI = new GoogleGenerativeAI(googleApiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-embedding-001" });
  }

  async retrieveContext(matchId: string, leagueId?: string): Promise<ContextQueryResult> {
    try {
      const query = `Contexto do jogo ${matchId} na liga ${leagueId || 'desconhecida'}`;
      const embeddingResponse = await this.model.embedContent(query);
      const queryEmbedding = embeddingResponse.embedding.values;

      const { data: similarFacts, error: searchError } = await this.supabase.rpc(
        'match_context_search',
        {
          query_embedding: queryEmbedding,
          match_id_filter: matchId,
          similarity_threshold: 0.7,
          match_count: 10
        }
      );

      if (searchError) return this.getDefaultContext();

      // Argos v5.0: Extração real de contexto via similaridade semântica
      if (similarFacts && similarFacts.length > 0) {
        const context: ContextQueryResult = this.getDefaultContext();
        similarFacts.forEach((fact: any) => {
          if (fact.fact_type === 'injury') context.lesoes.push(fact.content);
          else if (fact.fact_type === 'weather') context.clima = fact.content;
          else if (fact.fact_type === 'motivation') context.motivacao = fact.content;
          else if (fact.fact_type === 'historical') context.historico_confrontos = fact.content;
          else if (fact.fact_type === 'news') context.noticias_relevantes.push(fact.content);
        });
        return context;
      }

      return this.getDefaultContext(); 
    } catch (error) {
      console.error("[RAGContextEngine] Erro na recuperação de contexto:", error);
      return this.getDefaultContext();
    }
  }

  private getDefaultContext(): ContextQueryResult {
    return {
      lesoes: [],
      clima: 'Condições normais',
      motivacao: 'Jogo regular',
      historico_confrontos: 'Sem informações de histórico',
      noticias_relevantes: []
    };
  }
}
