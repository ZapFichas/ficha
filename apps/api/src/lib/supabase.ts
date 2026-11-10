import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Env } from "../env.js";

const OPCOES_AUTH = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
} as const;

/** Cliente com service_role: ignora RLS. Usar apenas no servidor. */
export function clienteAdmin(env: Env): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: OPCOES_AUTH,
    global: { headers: { "X-Client-Info": "fichapro-worker/admin" } },
  });
}

/** Cliente com o JWT do usuário: todas as queries passam por RLS. */
export function clienteUsuario(env: Env, token: string): SupabaseClient {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: OPCOES_AUTH,
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-Client-Info": "fichapro-worker/user",
      },
    },
  });
}
