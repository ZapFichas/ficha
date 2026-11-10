import { createClient } from "@supabase/supabase-js";
import { CONFIG, configurado } from "./config.js";

export const supabase = configurado
  ? createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export async function tokenAtual() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}

export async function sessaoAtual() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return data.session ?? null;
}
