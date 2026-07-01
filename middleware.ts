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
    // Extrair token de autorização do header ou query param
    const authHeader = request.headers.get("authorization");
    const apiKey = request.headers.get("x-api-key") || request.headers.get("x-argos-key") || request.nextUrl.searchParams.get("apiKey");

    if (!authHeader && !apiKey) {
      // Permitir que o endpoint lide com sua própria autenticação se o header específico estiver presente
      if (request.headers.get("x-argos-key")) {
        return NextResponse.next();
      }

      console.warn(`[Middleware] Acesso negado em ${pathname}: Nenhuma credencial fornecida.`);
      return NextResponse.json(
        { error: "Unauthorized: Missing authentication" },
        { status: 401 }
      );
    }

    // PRIORIDADE 1: Validar API Key (Bypass para Cron Jobs e Orquestradores)
    if (apiKey) {
      const isLegacyKey = apiKey === "argos_2026";
      const isCurrentKey = apiKey === process.env.ARGOS_API_KEY;

      if (isLegacyKey || isCurrentKey) {
        // API Key válida = VIP access imediato
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set("x-user-tier", UserTier.VIP);
        requestHeaders.set("x-authorized", "true");
        requestHeaders.set("x-auth-source", isLegacyKey ? "SUPABASE_CRON" : "DIRECT_API");

        console.log(`[Middleware] Acesso autorizado via API Key (${requestHeaders.get("x-auth-source")}) para: ${pathname}`);

        return NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        });
      } else {
        console.warn(`[Middleware] Tentativa de acesso com API Key inválida: ${apiKey.substring(0, 4)}...`);
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
        const requestHeaders = new Headers(request.headers);
        requestHeaders.set("x-user-id", validation.payload?.userId || "");
        requestHeaders.set("x-user-tier", validation.payload?.userTier || UserTier.FREE);
        requestHeaders.set("x-authorized", "true");

        return NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        });
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
