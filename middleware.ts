// ============================================================
// MIDDLEWARE v5.0 — EDGE GATEKEEPER & TIER VALIDATION
// Processamento na Edge para latência zero
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { EdgeGatekeeper, UserTier } from "@/lib/core/EdgeGatekeeper";

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Rotas que requerem autenticação
  if (pathname.startsWith("/api/argos")) {
    // Extrair token de autorização do header
    const authHeader = request.headers.get("authorization");
    const apiKey = request.headers.get("x-api-key");

    if (!authHeader && !apiKey) {
      return NextResponse.json(
        { error: "Unauthorized: Missing authentication" },
        { status: 401 }
      );
    }

    // PRIORIDADE 1: Validar API Key (Bypass para Cron Jobs e Orquestradores)
    if (apiKey) {
      if (apiKey === process.env.ARGOS_API_KEY) {
        // API Key válida = VIP access imediato
        const response = NextResponse.next();
        response.headers.set("x-user-tier", UserTier.VIP);
        return response;
      } else {
        return NextResponse.json(
          { error: "Unauthorized: Invalid API Key" },
          { status: 401 }
        );
      }
    }

    // PRIORIDADE 2: Validar Token Bearer (Acesso via Dashboard/App)
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const validation = EdgeGatekeeper.validateAuthToken(token);

      if (validation.valid) {
        const response = NextResponse.next();
        response.headers.set("x-user-id", validation.payload?.userId || "");
        response.headers.set("x-user-tier", validation.payload?.userTier || UserTier.FREE);
        return response;
      } else {
        return NextResponse.json(
          { error: `Unauthorized: ${validation.reason}` },
          { status: 401 }
        );
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/argos/:path*",
    "/dashboard/:path*",
  ],
};
