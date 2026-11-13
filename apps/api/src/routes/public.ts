import { Hono } from "hono";
import type { AppEnv } from "../env.js";
import {
  payloadFichaSchema,
  solicitacaoAlteracaoSchema,
} from "../lib/schemas.js";
import {
  consultarStatusPublico,
  criarFichaPublica,
  obterFormularioPublico,
} from "../services/fichas.js";
import {
  enviarDocumentoComplemento,
  obterComplementoPublico,
  solicitarAlteracaoPublica,
} from "../services/complementos.js";

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

// ------------------------------------------------------------
// Complemento de ficha (ex.: documento do respons�vel legal)
// ------------------------------------------------------------
rotasPublicas.get("/complementar", async (c) => {
  const f = c.req.query("f") ?? "";
  const p = c.req.query("p") ?? "";
  const t = c.req.query("t") ?? "";
  if (!f || !p || !t) return c.json({ erro: "Link incompleto." }, 400);
  const dados = await obterComplementoPublico(c.env, f, p, t);
  c.header("Cache-Control", "no-store");
  return c.json(dados);
});

rotasPublicas.post("/complementar", async (c) => {
  const tamanho = Number(c.req.header("content-length") ?? 0);
  if (tamanho > 16 * 1024 * 1024) {
    return c.json({ erro: "Envio acima do limite de 16 MB." }, 413);
  }
  const corpo = await c.req.json().catch(() => null);
  if (!corpo?.f || !corpo?.p || !corpo?.t || !corpo?.base64) {
    return c.json({ erro: "Dados incompletos." }, 400);
  }
  const ip =
    c.req.header("CF-Connecting-IP") ??
    c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ??
    null;
  const resultado = await enviarDocumentoComplemento(c.env, {
    fichaId: String(corpo.f),
    protocolo: String(corpo.p),
    token: String(corpo.t),
    nomeArquivo: String(corpo.nome_arquivo ?? "documento"),
    mime: String(corpo.mime ?? "application/pdf"),
    base64: String(corpo.base64),
    ip,
    userAgent: c.req.header("User-Agent") ?? null,
  });
  c.header("Cache-Control", "no-store");
  return c.json(resultado, 201);
});

// ------------------------------------------------------------
// Solicita��o de altera��o de dados (cliente -> aprova��o do dono)
// ------------------------------------------------------------
rotasPublicas.post("/fichas/solicitar-alteracao", async (c) => {
  const corpo = await c.req.json().catch(() => null);
  const parsed = solicitacaoAlteracaoSchema.safeParse(corpo);
  if (!parsed.success) {
    return c.json(
      {
        erro: "Dados inv�lidos.",
        detalhes: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])),
      },
      422
    );
  }
  const ip =
    c.req.header("CF-Connecting-IP") ??
    c.req.header("X-Forwarded-For")?.split(",")[0]?.trim() ??
    null;
  const resultado = await solicitarAlteracaoPublica(c.env, {
    tenantSlug: parsed.data.tenant_slug,
    protocolo: parsed.data.protocolo,
    cpf: parsed.data.cpf,
    cpfUltimos4: parsed.data.cpf_ultimos4,
    justificativa: parsed.data.justificativa,
    campos: parsed.data.campos,
    ip,
  });
  c.header("Cache-Control", "no-store");
  return c.json(resultado, 201);
});
