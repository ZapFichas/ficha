import { Hono } from "hono";
import { formatarDataHoraBR } from "@fichapro/shared";
import type { AppEnv } from "../env.js";
import { exigirAutenticacao, exigirOwner } from "../lib/auth.js";
import { descriptografarJson } from "../lib/crypto.js";
import { clienteAdmin, clienteUsuario } from "../lib/supabase.js";
import { urlFicha, urlPainel } from "../lib/urls.js";
import { DriveStorage } from "../services/drive.js";
import { R2Storage } from "../services/storage.js";
import { processarFichaPdf } from "../services/fichas.js";

export const rotasPainel = new Hono<AppEnv>();

rotasPainel.use("*", exigirAutenticacao);

rotasPainel.get("/me", async (c) => {
  const usuario = c.get("usuario");
  const db = clienteUsuario(c.env, c.get("accessToken"));

  const { data: tenant, error } = await db
    .from("tenants")
    .select(
      "id, slug, nome_negocio, nicho_slug, plano, status, storage_mode, branding, retencao_anos, email_contato, whatsapp, timezone, trial_expira_em, onboarding_concluido_em, criado_em"
    )
    .eq("id", usuario.tenantId)
    .maybeSingle();

  if (error || !tenant) {
    return c.json({ erro: "Estabelecimento não encontrado." }, 404);
  }

  return c.json({
    usuario,
    tenant,
    link_ficha: urlFicha(c.env, tenant.slug),
    painel_url: urlPainel(c.env),
  });
});

rotasPainel.get("/fichas", async (c) => {
  const usuario = c.get("usuario");
  const db = clienteUsuario(c.env, c.get("accessToken"));

  const limite = Math.min(Number(c.req.query("limite") ?? 25) || 25, 50);
  const status = c.req.query("status");
  const busca = (c.req.query("q") ?? "").trim().slice(0, 80);
  const cursor = c.req.query("cursor");

  let query = db
    .from("fichas")
    .select(
      "id, protocolo, cliente_nome, cliente_cpf_ultimos4, cliente_data_nasc, menor_idade, status, dados_json, criado_em, pdf_gerado_em, timestamp_assinatura"
    )
    .eq("tenant_id", usuario.tenantId)
    .order("criado_em", { ascending: false })
    .limit(limite + 1);

  if (status && ["rascunho", "preenchida", "pdf_gerado", "salva", "erro"].includes(status)) {
    query = query.eq("status", status);
  }
  if (busca) {
    const seguro = busca.replace(/[%_,()]/g, " ").trim();
    if (seguro) query = query.ilike("cliente_nome", `%${seguro}%`);
  }
  if (cursor) query = query.lt("criado_em", cursor);

  const { data, error } = await query;
  if (error) return c.json({ erro: "Não foi possível listar as fichas." }, 500);

  const itens = data ?? [];
  const temMais = itens.length > limite;
  const pagina = temMais ? itens.slice(0, limite) : itens;
  const ultimo = pagina[pagina.length - 1];

  return c.json({
    itens: pagina,
    proximo_cursor: temMais ? ultimo?.criado_em ?? null : null,
  });
});

rotasPainel.get("/fichas/:id", async (c) => {
  const usuario = c.get("usuario");
  const db = clienteUsuario(c.env, c.get("accessToken"));
  const id = c.req.param("id");

  const { data: ficha, error } = await db
    .from("fichas")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", usuario.tenantId)
    .maybeSingle();

  if (error) return c.json({ erro: "Não foi possível carregar a ficha." }, 500);
  if (!ficha) return c.json({ erro: "Ficha não encontrada." }, 404);

  let dados: Record<string, unknown> = {};
  let meta: Record<string, unknown> = {};
  try {
    const decifrado = await descriptografarJson<{
      dados: Record<string, unknown>;
      meta: Record<string, unknown>;
    }>(ficha.dados_cifrados, c.env.DATA_ENCRYPTION_KEY);
    dados = decifrado.dados;
    meta = decifrado.meta ?? {};
  } catch {
    return c.json(
      { erro: "Não foi possível abrir os dados desta ficha. Verifique a chave de criptografia." },
      500
    );
  }

  const [{ data: assinaturas }, { data: consentimentos }, { data: anexos }] =
    await Promise.all([
      db
        .from("assinaturas")
        .select("id, papel, timestamp, ip, user_agent, hash_conteudo")
        .eq("ficha_id", id)
        .eq("tenant_id", usuario.tenantId),
      db
        .from("consentimentos")
        .select("id, tipo, aceito, versao_termo, timestamp, ip")
        .eq("ficha_id", id)
        .eq("tenant_id", usuario.tenantId),
      db
        .from("ficha_anexos")
        .select("id, tipo, nome_arquivo, mime, tamanho_bytes, storage_key, status, enviado_em")
        .eq("ficha_id", id)
        .eq("tenant_id", usuario.tenantId),
    ]);

  return c.json({
    ficha: {
      ...ficha,
      dados_cifrados: undefined,
    },
    dados,
    meta,
    assinaturas: assinaturas ?? [],
    consentimentos: consentimentos ?? [],
    anexos: anexos ?? [],
  });
});

rotasPainel.get("/fichas/:id/pdf", async (c) => {
  const usuario = c.get("usuario");
  const db = clienteUsuario(c.env, c.get("accessToken"));
  const id = c.req.param("id");

  const { data: ficha } = await db
    .from("fichas")
    .select("id, tenant_id, protocolo, status, r2_key, drive_file_id, cliente_nome")
    .eq("id", id)
    .eq("tenant_id", usuario.tenantId)
    .maybeSingle();

  if (!ficha) return c.json({ erro: "Ficha não encontrada." }, 404);
  if (ficha.status !== "salva") {
    return c.json({ erro: "O PDF ainda está sendo gerado.", status: ficha.status }, 409);
  }

  let arquivo: { bytes: Uint8Array; contentType: string } | null = null;

  if (ficha.r2_key) {
    arquivo = await new R2Storage(c.env).download({ key: ficha.r2_key });
  } else if (ficha.drive_file_id) {
    const admin = clienteAdmin(c.env);
    const { data: segredos } = await admin
      .from("tenant_secrets")
      .select("drive_refresh_token_enc, drive_folder_id")
      .eq("tenant_id", usuario.tenantId)
      .maybeSingle();

    if (segredos?.drive_refresh_token_enc) {
      const token = await descriptografarJson<{ token: string }>(
        segredos.drive_refresh_token_enc,
        c.env.DATA_ENCRYPTION_KEY
      );
      const drive = new DriveStorage(c.env, {
        refreshToken: token.token,
        folderId: segredos.drive_folder_id,
        nomeNegocio: "FichaPro",
      });
      arquivo = await drive.download({ externalId: ficha.drive_file_id });
    }
  }

  if (!arquivo) {
    return c.json({ erro: "Arquivo não encontrado no storage." }, 404);
  }

  const nome = `${ficha.protocolo}_${(ficha.cliente_nome ?? "cliente").replace(/[^\p{L}\p{N}]+/gu, "_")}.pdf`;
  return new Response(arquivo.bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${nome}"`,
      "Cache-Control": "private, no-store",
    },
  });
});

rotasPainel.get("/stats", async (c) => {
  const usuario = c.get("usuario");
  const db = clienteUsuario(c.env, c.get("accessToken"));
  const desde = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const contar = async (status?: string, recente = false) => {
    let q = db
      .from("fichas")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", usuario.tenantId);
    if (status) q = q.eq("status", status);
    if (recente) q = q.gte("criado_em", desde);
    const { count } = await q;
    return count ?? 0;
  };

  const [total, salvas, erro, processando, ultimos30] = await Promise.all([
    contar(),
    contar("salva"),
    contar("erro"),
    contar("preenchida"),
    contar(undefined, true),
  ]);

  return c.json({
    total,
    salvas,
    erro,
    processando,
    ultimos_30_dias: ultimos30,
    atualizado_em: formatarDataHoraBR(new Date()),
  });
});

rotasPainel.get("/formulario", async (c) => {
  const usuario = c.get("usuario");
  const db = clienteUsuario(c.env, c.get("accessToken"));

  const { data: formulario } = await db
    .from("formularios")
    .select("id, template_id, nome, campos_ativos, branding_override, ativo, criado_em")
    .eq("tenant_id", usuario.tenantId)
    .eq("ativo", true)
    .maybeSingle();

  if (!formulario) return c.json({ erro: "Nenhum formulário ativo." }, 404);

  const { data: template } = await db
    .from("templates")
    .select("id, nicho_slug, nome, nome_comercial, versao, campos_json, termo_texto")
    .eq("id", formulario.template_id)
    .maybeSingle();

  return c.json({ formulario, template });
});

rotasPainel.patch("/formulario", exigirOwner(), async (c) => {
  const usuario = c.get("usuario");
  const db = clienteUsuario(c.env, c.get("accessToken"));
  const corpo = (await c.req.json().catch(() => null)) as
    | { campos_ativos?: unknown; nome?: string }
    | null;

  if (!corpo) return c.json({ erro: "JSON inválido." }, 400);
  if (corpo.campos_ativos !== undefined) {
    const tipo = Array.isArray(corpo.campos_ativos)
      ? "array"
      : typeof corpo.campos_ativos === "object" && corpo.campos_ativos !== null
        ? "object"
        : null;
    if (!tipo) return c.json({ erro: "campos_ativos inválido." }, 422);
  }

  const atualizacao: Record<string, unknown> = {};
  if (corpo.campos_ativos !== undefined) atualizacao.campos_ativos = corpo.campos_ativos;
  if (corpo.nome) atualizacao.nome = corpo.nome.slice(0, 120);

  const { data, error } = await db
    .from("formularios")
    .update(atualizacao)
    .eq("tenant_id", usuario.tenantId)
    .eq("ativo", true)
    .select("id, nome, campos_ativos")
    .maybeSingle();

  if (error) return c.json({ erro: "Não foi possível atualizar o formulário." }, 500);
  return c.json({ formulario: data });
});

rotasPainel.patch("/tenant", exigirOwner(), async (c) => {
  const usuario = c.get("usuario");
  const db = clienteUsuario(c.env, c.get("accessToken"));
  const corpo = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!corpo) return c.json({ erro: "JSON inválido." }, 400);

  const permitidos = [
    "nome_negocio",
    "branding",
    "email_contato",
    "whatsapp",
    "timezone",
    "retencao_anos",
  ];
  const atualizacao: Record<string, unknown> = {};
  for (const chave of permitidos) {
    if (corpo[chave] !== undefined) atualizacao[chave] = corpo[chave];
  }
  if (!Object.keys(atualizacao).length) {
    return c.json({ erro: "Nenhum campo permitido informado." }, 422);
  }
  if (atualizacao.retencao_anos !== undefined) {
    const n = Number(atualizacao.retencao_anos);
    if (!Number.isInteger(n) || n < 1 || n > 30) {
      return c.json({ erro: "retencao_anos deve estar entre 1 e 30." }, 422);
    }
    atualizacao.retencao_anos = n;
  }

  const { data, error } = await db
    .from("tenants")
    .update(atualizacao)
    .eq("id", usuario.tenantId)
    .select(
      "id, slug, nome_negocio, branding, email_contato, whatsapp, timezone, retencao_anos"
    )
    .maybeSingle();

  if (error) return c.json({ erro: "Não foi possível atualizar o estabelecimento." }, 500);
  return c.json({ tenant: data });
});

rotasPainel.post("/fichas/:id/reprocessar", exigirOwner(), async (c) => {
  const usuario = c.get("usuario");
  const db = clienteUsuario(c.env, c.get("accessToken"));
  const id = c.req.param("id");

  const { data: ficha } = await db
    .from("fichas")
    .select("id, status")
    .eq("id", id)
    .eq("tenant_id", usuario.tenantId)
    .maybeSingle();

  if (!ficha) return c.json({ erro: "Ficha não encontrada." }, 404);
  if (ficha.status === "salva") return c.json({ ok: true, mensagem: "PDF já gerado." });

  await c.env.PDF_QUEUE.send({ fichaId: ficha.id, tenantId: usuario.tenantId });
  return c.json({ ok: true, mensagem: "Reprocessamento enfileirado." }, 202);
});
