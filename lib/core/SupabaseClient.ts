import { createClient } from "@supabase/supabase-js";

/**
 * Utilitário para sanitizar a URL do Supabase e evitar erro PGRST125
 * Remove sufixos como /rest/v1/ e barras finais que causam malformação da URL no client
 */
export function getSanitizedSupabaseUrl(url: string): string {
  if (!url) return "";
  // Remove /rest/v1, /rest/v1/, e qualquer barra final
  return url.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
}

export function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase URL ou Service Role Key não configurados nas variáveis de ambiente.");
  }

  const sanitizedUrl = getSanitizedSupabaseUrl(url);
  
  return createClient(sanitizedUrl, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}
