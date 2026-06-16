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

    // Validar token se presente
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const validation = EdgeGatekeeper.validateAuthToken(token);

      if (!validation.valid) {
        return NextResponse.json(
          { error: `Unauthorized: ${validation.reason}` },
          { status: 401 }
        );
      }

      // Adicionar payload do token aos headers para uso posterior
      const response = NextResponse.next();
      response.headers.set("x-user-id", validation.payload?.userId || "");
      response.headers.set("x-user-tier", validation.payload?.userTier || UserTier.FREE);
      return response;
    }

    // Validar API Key
    if (apiKey) {
      if (apiKey !== process.env.ARGOS_API_KEY) {
        return NextResponse.json(
          { error: "Unauthorized: Invalid API Key" },
          { status: 401 }
        );
      }

      // API Key válida = VIP access
      const response = NextResponse.next();
      response.headers.set("x-user-tier", UserTier.VIP);
      return response;
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
