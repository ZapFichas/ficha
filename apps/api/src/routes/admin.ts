import { Hono } from "hono";
import type { AppEnv } from "../env.js";
import { exigirAutenticacao } from "../lib/auth.js";
import { ehAdminPlataforma } from "../lib/plataforma.js";
import { metricasPlataforma } from "../services/metricas.js";

export const rotasAdmin = new Hono<AppEnv>();

rotasAdmin.use("*", exigirAutenticacao);
rotasAdmin.use("*", async (c, next) => {
  const usuario = c.get("usuario");
  if (!ehAdminPlataforma(c.env, usuario?.email)) {
    return c.json(
      {
        erro: "Acesso restrito à gestão da plataforma.",
        codigo: "admin_necessario",
      },
      403
    );
  }
  await next();
});

rotasAdmin.get("/metricas", async (c) => {
  try {
    const metricas = await metricasPlataforma(c.env);
    return c.json(metricas);
  } catch (err) {
    console.error("Falha ao calcular métricas globais:", err);
    return c.json(
      {
        erro: "Não foi possível calcular as métricas agora.",
        dica: "Confirme se PLATFORM_ADMIN_EMAILS e a service role estão configurados.",
      },
      500
    );
  }
});
