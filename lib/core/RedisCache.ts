// ============================================================
// REDIS CACHE v5.0 — DISTRIBUTED GLOBAL CACHE
// Upstash Redis para latência zero e escalabilidade global
// ============================================================

import { Redis } from "@upstash/redis";

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

export class RedisCache {
  private redis: Redis;
  private readonly DEFAULT_TTL = 300; // 5 minutos
  private readonly MATCH_CACHE_TTL = 600; // 10 minutos para dados de jogo
  private readonly REGIME_CACHE_TTL = 1800; // 30 minutos para regimes

  constructor(url: string, token: string) {
    this.redis = new Redis({
      url,
      token,
    });
    console.log(`[RedisCache] Initialized with URL: ${url ? '******' : 'UNDEFINED'}`);
  }

  /**
   * Armazena um valor no cache com TTL
   */
  async set<T>(key: string, value: T, ttl: number = this.DEFAULT_TTL): Promise<void> {
    try {
      const cacheEntry: CacheEntry<T> = {
        data: value,
        timestamp: Date.now(),
        ttl,
      };
      await this.redis.setex(key, ttl, cacheEntry);
      console.log(`[RedisCache] SET: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      console.error(`[RedisCache] SET Error for ${key}:`, error);
      throw error;
    }
  }

  /**
   * Recupera um valor do cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);
      if (!cached) {
        console.log(`[RedisCache] MISS: ${key}`);
        return null;
      }

      const cacheEntry: CacheEntry<T> = cached as CacheEntry<T>;
      const age = Date.now() - cacheEntry.timestamp;

      console.log(`[RedisCache] HIT: ${key} (Age: ${age}ms)`);
      return cacheEntry.data;
    } catch (error) {
      console.error(`[RedisCache] GET Error for ${key}:`, error);
      return null;
    }
  }

  /**
   * Deleta um valor do cache
   */
  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
      console.log(`[RedisCache] DELETE: ${key}`);
    } catch (error) {
      console.error(`[RedisCache] DELETE Error for ${key}:`, error);
    }
  }

  /**
   * Limpa todos os valores do cache (use com cuidado)
   */
  async flushAll(): Promise<void> {
    try {
      await this.redis.flushall();
      console.log(`[RedisCache] FLUSH ALL`);
    } catch (error) {
      console.error(`[RedisCache] FLUSH ALL Error:`, error);
    }
  }

  /**
   * Chave para cache de dados de ingestão
   */
  getMatchDataKey(matchId: string): string {
    return `match:data:${matchId}`;
  }

  /**
   * Chave para cache de regime
   */
  getRegimeKey(matchId: string, leagueId?: string): string {
    return `regime:${matchId}:${leagueId || 'global'}`;
  }

  /**
   * Chave para cache de sinais classificados
   */
  getSignalsKey(matchId: string): string {
    return `signals:${matchId}`;
  }

  /**
   * Chave para cache de contexto RAG
   */
  getContextKey(matchId: string): string {
    return `context:${matchId}`;
  }

  /**
   * Armazena dados de jogo no cache
   */
  async cacheMatchData(matchId: string, data: any): Promise<void> {
    await this.set(this.getMatchDataKey(matchId), data, this.MATCH_CACHE_TTL);
  }

  /**
   * Recupera dados de jogo do cache
   */
  async getMatchData(matchId: string): Promise<any | null> {
    return this.get(this.getMatchDataKey(matchId));
  }

  /**
   * Armazena regime no cache
   */
  async cacheRegime(matchId: string, regime: any, leagueId?: string): Promise<void> {
    await this.set(this.getRegimeKey(matchId, leagueId), regime, this.REGIME_CACHE_TTL);
  }

  /**
   * Recupera regime do cache
   */
  async getRegime(matchId: string, leagueId?: string): Promise<any | null> {
    return this.get(this.getRegimeKey(matchId, leagueId));
  }

  /**
   * Armazena sinais no cache
   */
  async cacheSignals(matchId: string, signals: any[]): Promise<void> {
    await this.set(this.getSignalsKey(matchId), signals, this.MATCH_CACHE_TTL);
  }

  /**
   * Recupera sinais do cache
   */
  async getSignals(matchId: string): Promise<any[] | null> {
    return this.get(this.getSignalsKey(matchId));
  }

  /**
   * Armazena contexto RAG no cache
   */
  async cacheContext(matchId: string, context: any): Promise<void> {
    await this.set(this.getContextKey(matchId), context, this.REGIME_CACHE_TTL);
  }

  /**
   * Recupera contexto RAG do cache
   */
  async getContext(matchId: string): Promise<any | null> {
    return this.get(this.getContextKey(matchId));
  }
}

let redisCacheInstance: RedisCache | null = null;

export function getRedisCacheInstance(): RedisCache {
  if (!redisCacheInstance) {
    const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
    const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    console.log(`[getRedisCacheInstance] Raw URL: ${redisUrl}`);
    console.log(`[getRedisCacheInstance] Raw Token: ${redisToken ? '******' : 'UNDEFINED'}`);

    if (!redisUrl || !redisToken) {
      console.error("[RedisCache] UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN is not defined.");
      throw new Error("Upstash Redis credentials are not configured.");
    }
    redisCacheInstance = new RedisCache(redisUrl, redisToken);
  }
  return redisCacheInstance;
}
