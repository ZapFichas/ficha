import type { Env } from "../env.js";

export function baseFicha(env: Env): string {
  return (env.FICHA_URL || env.APP_URL).replace(/\/$/, "");
}

export function basePainel(env: Env): string {
  return (env.PANEL_URL || `${baseFicha(env)}/painel`).replace(/\/$/, "");
}

export function urlFicha(env: Env, slug: string): string {
  return `${baseFicha(env)}/f/${encodeURIComponent(slug)}`;
}

export function urlPainel(env: Env, caminho = ""): string {
  return `${basePainel(env)}${caminho}`;
}
