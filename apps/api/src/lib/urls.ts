import type { Env } from "../env.js";

export function baseFicha(env: Env): string {
  return (env.FICHA_URL || env.APP_URL).replace(/\/$/, "");
}

export function basePainel(env: Env): string {
  return (env.PANEL_URL || `${baseFicha(env)}/painel`).replace(/\/$/, "");
}

export function urlFicha(env: Env, slug: string, nicho = ""): string {
  if (env.FICHA_URL_TEMPLATE) {
    return env.FICHA_URL_TEMPLATE.replaceAll("{slug}", encodeURIComponent(slug)).replaceAll(
      "{nicho}",
      encodeURIComponent(nicho)
    );
  }
  return `${baseFicha(env)}/f/${encodeURIComponent(slug)}`;
}

export function urlPainel(env: Env, caminho = ""): string {
  const base = basePainel(env);
  if (!caminho) return `${base}/`;
  return `${base}${caminho.startsWith("/") ? caminho : `/${caminho}`}`;
}
