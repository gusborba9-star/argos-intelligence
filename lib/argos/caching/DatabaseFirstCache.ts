// ============================================================
// DATABASE-FIRST CACHING STRATEGY v1.0
// Supabase como fonte primária antes de chamar APIs
// ============================================================

import { createClient } from "@supabase/supabase-js";

export interface CachedFixture {
  id: string;
  matchId: string;
  leagueId: number;
  homeTeamId: number;
  awayTeamId: number;
  homeTeam: string;
  awayTeam: string;
  league: string;
  kickoffTime: string;
  homeMetrics: any;
  awayMetrics: any;
  externalFactors: any;
  status: "PENDING" | "LIVE" | "FINISHED";
  lastUpdatedAt: string;
  cachedAt: string;
}

export interface CachedAnalysis {
  id: string;
  matchId: string;
  analysisType: string; // "WINNER" | "OVER_UNDER" | "CORNERS" | etc
  prediction: string;
  probability: number;
  odds: number;
  ev?: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  analysisData: any;
  createdAt: string;
  expiresAt: string;
}

/**
 * DATABASE-FIRST CACHING STRATEGY v1.0
 *
 * Filosofia:
 * 1. SEMPRE check Supabase ANTES de chamar PropLine
 * 2. Se dados estão frescos (< 30min), reutiliza
 * 3. Processamento é feito UMA VEZ, serve para TODOS
 * 4. Reduz custos de API drasticamente
 * 5. Latência mínima (local database lookup)
 */
export class DatabaseFirstCache {
  private supabase: ReturnType<typeof createClient>;
  private readonly CACHE_TTL_MINUTES = 30;
  private readonly ANALYSIS_CACHE_TTL_MINUTES = 60;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || "",
      process.env.SUPABASE_SERVICE_ROLE_KEY || ""
    );
  }

  /**
   * Busca fixture do cache (Supabase) ANTES de chamar API
   * Se não encontrar ou estiver expirado, retorna null para triggerar API call
   */
  public async getFixtureFromCache(matchId: string): Promise<CachedFixture | null> {
    try {
      const { data, error } = await this.supabase
        .from("fixture_cache")
        .select("*")
        .eq("matchId", matchId)
        .gt("cachedAt", new Date(Date.now() - this.CACHE_TTL_MINUTES * 60000).toISOString())
        .single();

      if (error || !data) {
        console.log(`[DatabaseFirstCache] Cache miss para fixture ${matchId}`);
        return null;
      }

      console.log(`[DatabaseFirstCache] ✅ Cache hit para fixture ${matchId}`);
      return data as CachedFixture;
    } catch (error: any) {
      console.warn(`[DatabaseFirstCache] Erro ao buscar cache:`, error.message);
      return null;
    }
  }

  /**
   * Salva fixture no cache (Supabase)
   * Chamado após processar dados da API
   */
  public async saveFixtureToCache(fixture: CachedFixture): Promise<void> {
    try {
      await this.supabase.from("argos_market_snapshot_cache").upsert({ ... })
  ...fixture,
  cachedAt: new Date().toISOString(),
});


      console.log(`[DatabaseFirstCache] ✅ Fixture ${fixture.matchId} salvo no cache`);
    } catch (error: any) {
      console.error(`[DatabaseFirstCache] Erro ao salvar cache:`, error.message);
    }
  }

  /**
   * Busca análises já realizadas (p/ não processar 2x)
   */
  public async getAnalysisFromCache(
    matchId: string,
    analysisType: string
  ): Promise<CachedAnalysis | null> {
    try {
      const { data, error } = await this.supabase
        .from("analysis_cache")
        .select("*")
        .eq("matchId", matchId)
        .eq("analysisType", analysisType)
        .gt("expiresAt", new Date().toISOString())
        .single();

      if (error || !data) {
        return null;
      }

      console.log(
        `[DatabaseFirstCache] ✅ Analysis cache hit para ${matchId}/${analysisType}`
      );
      return data as CachedAnalysis;
    } catch (error: any) {
      return null;
    }
  }

  /**
   * Salva análise no cache
   * Evita re-processar o mesmo jogo + mercado
   */
  public async saveAnalysisToCache(analysis: CachedAnalysis): Promise<void> {
    try {
      analysis.expiresAt = new Date(
        Date.now() + this.ANALYSIS_CACHE_TTL_MINUTES * 60000
      ).toISOString();

      await this.supabase.from("analysis_cache").upsert({
        matchId: analysis.matchId,
        analysisType: analysis.analysisType,
        ...analysis,
        createdAt: new Date().toISOString(),
      });

      console.log(
        `[DatabaseFirstCache] ✅ Analysis ${analysis.matchId}/${analysis.analysisType} salvo`
      );
    } catch (error: any) {
      console.error(`[DatabaseFirstCache] Erro ao salvar análise:`, error.message);
    }
  }

  /**
   * Limpa cache expirado (maintenance)
   * Chamado periodicamente pelo cron
   */
  public async cleanExpiredCache(): Promise<{ fixtures: number; analyses: number }> {
    try {
      const now = new Date().toISOString();

      const [fixturesRes, analysesRes] = await Promise.all([
        this.supabase
          .from("fixture_cache")
          .delete()
          .lt("cachedAt", new Date(Date.now() - this.CACHE_TTL_MINUTES * 60000).toISOString()),
        this.supabase.from("analysis_cache").delete().lt("expiresAt", now),
      ]);

      console.log(
        `[DatabaseFirstCache] 🧹 Limpeza de cache completa: ${fixturesRes.count} fixtures, ${analysesRes.count} analyses`
      );

      return {
        fixtures: fixturesRes.count || 0,
        analyses: analysesRes.count || 0,
      };
    } catch (error: any) {
      console.error(`[DatabaseFirstCache] Erro ao limpar cache:`, error.message);
      return { fixtures: 0, analyses: 0 };
    }
  }

  /**
   * Obtém estatísticas de cache (para monitoring)
   */
  public async getCacheStats(): Promise<{
    fixturesCount: number;
    analysesCount: number;
    cacheHitRate: number;
  }> {
    try {
      const [fixtures, analyses] = await Promise.all([
        this.supabase.from("fixture_cache").select("count", { count: "exact" }),
        this.supabase.from("analysis_cache").select("count", { count: "exact" }),
      ]);

      return {
        fixturesCount: fixtures.count || 0,
        analysesCount: analyses.count || 0,
        cacheHitRate: 0, // TODO: Implementar tracking de hits vs misses
      };
    } catch (error: any) {
      return { fixturesCount: 0, analysesCount: 0, cacheHitRate: 0 };
    }
  }
}

export const databaseFirstCache = new DatabaseFirstCache();
