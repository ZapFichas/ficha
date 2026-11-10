import { Hono } from "hono";
import type { AppEnv } from "../env.js";
import { payloadFichaSchema } from "../lib/schemas.js";
import {
  consultarStatusPublico,
  criarFichaPublica,
  obterFormularioPublico,
} from "../services/fichas.js";

export const rotasPublicas = new Hono<AppEnv>();

rotasPublicas.get("/form/:slug", async (c) => {
  const dados = await obterFormularioPublico(c.env, c.req.param("slug"));
  c.header("Cache-Control", "public, max-age=30, stale-while-revalidate=120");
  return c.json(dados);
});

rotasPublicas.post("/fichas", async (c) => {
  const tamanho = Number(c.req.header("content-length") ?? 0);
  if (tamanho > 22 * 1024 * 1024) {
    return c.json({ erro: "Envio acima do limite de 22 MB." }, 413);
  }

  let corpo: unknown;
  try {
    corpo = await c.req.json();
  } catch {
    return c.json({ erro: "JSON inválido." }, 400);
  }

  const parsed = payloadFichaSchema.safeParse(corpo);
  if (!parsed.success) {
    return c.json(
      {
        erro: "Dados da ficha inválidos.",
        detalhes: Object.fromEntries(
          parsed.error.issues.map((i) => [i.path.join("."), i.message])
        ),
      },
      400
    );
  }

  const ip =
    c.req.header("CF-Connecting-IP") ??
    c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ??
    null;
  const userAgent = c.req.header("User-Agent") ?? null;

  const resultado = await criarFichaPublica(c.env, parsed.data, ip, userAgent);
  c.header("Cache-Control", "no-store");

  return c.json(
    {
      ...resultado,
      mensagem: "Ficha recebida. O PDF será gerado e salvo automaticamente.",
    },
    201
  );
});

rotasPublicas.get("/fichas/:protocolo/status", async (c) => {
  const tenant = c.req.query("tenant");
  if (!tenant) return c.json({ erro: "Informe o estabelecimento." }, 400);
  const status = await consultarStatusPublico(c.env, tenant, c.req.param("protocolo"));
  c.header("Cache-Control", "no-store");
  return c.json(status);
});
