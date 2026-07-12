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
    console.log(`[RedisCache] Initialized with URL: ${url ? '✅ Active' : '❌ UNDEFINED'}`);
  }

  async set<T>(key: string, value: T, ttl: number = this.DEFAULT_TTL): Promise<void> {
    try {
      const cacheEntry: CacheEntry<T> = {
        data: value,
        timestamp: Date.now(),
        ttl,
      };
      await this.redis.setex(key, ttl, JSON.stringify(cacheEntry));
      console.log(`[RedisCache] SET: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      console.error(`[RedisCache] SET Error for ${key}:`, error);
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);
      if (!cached) {
        console.log(`[RedisCache] MISS: ${key}`);
        return null;
      }

      const cacheEntry: CacheEntry<T> = JSON.parse(cached as string);
      const age = Date.now() - cacheEntry.timestamp;
      console.log(`[RedisCache] HIT: ${key} (Age: ${age}ms)`);
      return cacheEntry.data;
    } catch (error) {
      console.error(`[RedisCache] GET Error for ${key}:`, error);
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
      console.log(`[RedisCache] DELETE: ${key}`);
    } catch (error) {
      console.error(`[RedisCache] DELETE Error for ${key}:`, error);
    }
  }

  async flushAll(): Promise<void> {
    try {
      await this.redis.flushall();
      console.log(`[RedisCache] FLUSH ALL`);
    } catch (error) {
      console.error(`[RedisCache] FLUSH ALL Error:`, error);
    }
  }

  getMatchDataKey(matchId: string): string {
    return `match:data:${matchId}`;
  }

  getRegimeKey(matchId: string, leagueId?: string): string {
    return `regime:${matchId}:${leagueId || 'global'}`;
  }

  getSignalsKey(matchId: string): string {
    return `signals:${matchId}`;
  }
}

let redisCacheInstance: RedisCache | null = null;

export function getRedisCacheInstance(): RedisCache {
  if (!redisCacheInstance) {
    const url = process.env.UPSTASH_REDIS_URL || '';
    const token = process.env.UPSTASH_REDIS_TOKEN || '';
    redisCacheInstance = new RedisCache(url, token);
  }
  return redisCacheInstance;
}
