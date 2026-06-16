import { NextResponse } from "next/server";
import { redisCache } from "@/lib/core/RedisCache";

// ============================================================
// CACHE STATUS ENDPOINT v5.0
// Monitoramento de saúde do cache distribuído
// ============================================================

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    // Verificar se Redis está disponível
    const testKey = `health-check-${Date.now()}`;
    const testValue = { timestamp: Date.now(), status: "ok" };

    // Tentar escrever e ler do cache
    await redisCache.set(testKey, testValue, 10);
    const retrieved = await redisCache.get(testKey);

    if (!retrieved) {
      return NextResponse.json(
        {
          status: "DEGRADED",
          message: "Redis cache is not responding correctly",
          timestamp: Date.now(),
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: "HEALTHY",
      message: "Redis cache is operational",
      cacheType: "Upstash Redis",
      timestamp: Date.now(),
    });
  } catch (error: any) {
    console.error("[Cache Status] Error:", error.message);
    return NextResponse.json(
      {
        status: "UNHEALTHY",
        message: `Redis cache error: ${error.message}`,
        timestamp: Date.now(),
      },
      { status: 503 }
    );
  }
}
