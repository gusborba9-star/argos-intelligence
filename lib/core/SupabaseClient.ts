import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

/**
 * Utilitário para sanitizar a URL do Supabase e evitar erro PGRST125
 * Remove sufixos como /rest/v1/ e barras finais que causam malformação da URL no client
 */
export function getSanitizedSupabaseUrl(url: string): string {
  if (!url) return "";
  // Remove /rest/v1, /rest/v1/, e qualquer barra final
  return url.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    console.log(`[SupabaseClient] Original URL: ${url}`);
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!url || !key) {
      console.error("[SupabaseClient] Supabase URL or Service Role Key not configured in environment variables.");
      throw new Error("Supabase URL ou Service Role Key não configurados nas variáveis de ambiente.");
    }

    const sanitizedUrl = getSanitizedSupabaseUrl(url);
    console.log(`[SupabaseClient] Sanitized URL: ${sanitizedUrl}`);
    
    supabaseInstance = createClient(sanitizedUrl, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    });
  }
  return supabaseInstance;
}
