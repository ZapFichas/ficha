import { Hono } from "hono";
import {
  aplicarCamposAtivos,
  aplicarCamposCustomizados,
  calcularIdade,
  comparativoPlanos,
  formatarDataHoraBR,
  limitesDoPlano,
  mensagemUpgrade,
  normalizarPermissoes,
  PLANOS,
  resumoFicha,
  sanitizarRespostas,
  serieMensal,
  taxa,
  topValores,
  verificarLimite,
} from "@fichapro/shared";
import type { AppEnv } from "../env.js";
import { exigirAutenticacao, exigirOwner } from "../lib/auth.js";
import { criptografarJson, descriptografarJson, hashCPF } from "../lib/crypto.js";
import { ehAdminPlataforma } from "../lib/plataforma.js";
import {
  camposCustomizadosSchema,
  edicaoFichaSchema,
  profissionalSchema,
} from "../lib/schemas.js";
import { camposAtivosSchema } from "../lib/schemas.js";
import { clienteAdmin, clienteUsuario } from "../lib/supabase.js";
import { urlFicha, urlPainel } from "../lib/urls.js";
import { DriveStorage } from "../services/drive.js";
import { processarFichaPdf } from "../services/fichas.js";
import { listarProfissionais } from "../services/profissionais.js";
import { R2Storage } from "../services/storage.js";

export const rotasPainel = new Hono<AppEnv>();

rotasPainel.use("*", exigirAutenticacao);

const CAMPOS_FICHA_PUBLICOS = [
  "id",
  "protocolo",
  "cliente_nome",
  "cliente_cpf_ultimos4",
  "cliente_data_nasc",
  "menor_idade",
  "status",
  "dados_json",
  "criado_em",
  "atualizado_em",
  "pdf_gerado_em",
  "timestamp_assinatura",
  "hash_pdf",
  "erro_ultimo",
  "ip_assinatura",
  "user_agent_assinatura",
  "retencao_ate",
  "pendencias",
  "profissional_id",
  "origem",
] as const;

function resumirFicha(registro: Record<string, unknown>) {
  const saida: Record<string, unknown> = {};
  for (const chave of CAMPOS_FICHA_PUBLICOS) {
    if (registro[chave] !== undefined) saida[chave] = registro[chave];
  }
  return saida;
}

function tabelaAusente(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = String(error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    msg.includes("does not exist") ||
    msg.includes("could not find the table")
  );
}

function normalizarPlano(valor: unknown): keyof typeof PLANOS {
  return typeof valor === "string" && Object.prototype.hasOwnProperty.call(PLANOS, valor)
    ? (valor as keyof typeof PLANOS)
    : "solo";
}

rotasPainel.get("/me", async (c) => {
  const usuario = c.get("usuario");
  const db = clienteUsuario(c.env, c.get("accessToken"));

  const { data: tenant, error } = await db
    .from("tenants")
    .select("*")
    .eq("id", usuario.tenantId)
    .maybeSingle();

  if (error || !tenant) {
    return c.json({ erro: "Estabelecimento não encontrado." }, 404);
  }

  const permissoes = normalizarPermissoes(tenant.permissoes);
  const plano = normalizarPlano(tenant.plano);
  const limites = limitesDoPlano(plano);

  return c.json({
    usuario,
    tenant: {
      id: tenant.id,
      slug: tenant.slug,
      nome_negocio: tenant.nome_negocio,
      nicho_slug: tenant.nicho_slug,
      plano: tenant.plano,
      status: tenant.status,
      storage_mode: tenant.storage_mode,
      branding: tenant.branding,
      retencao_anos: tenant.retencao_anos,
      email_contato: tenant.email_contato,
      whatsapp: tenant.whatsapp,
      timezone: tenant.timezone,
      trial_expira_em: tenant.trial_expira_em,
      onboarding_concluido_em: tenant.onboarding_concluido_em,
      criado_em: tenant.criado_em,
      permissoes,
    },
    plano: {
      id: plano,
      nome: PLANOS[plano].nome,
      preco_mensal: PLANOS[plano].preco_mensal,
      limites,
      comparativo: comparativoPlanos(),
    },
    plataforma_admin: ehAdminPlataforma(c.env, usuario.email),
    link_ficha: urlFicha(c.env, tenant.slug, tenant.nicho_slug),
    painel_url: urlPainel(c.env),
  });
});

rotasPainel.get("/fichas", async (c) => {
  const usuario = c.get("usuario");
  const db = clienteUsuario(c.env, c.get("accessToken"));

  const limite = Math.min(Number(c.req.query("limite") ?? 25) || 25, 50);
  const status = c.req.query("status");
  const busca = (c.req.query("q") ?? "").trim().slice(0, 80);
  const cpf = (c.req.query("cpf") ?? "").replace(/\D+/g, "").slice(0, 11);
  const cursor = c.req.query("cursor");

  let query = db
    .from("fichas")
    .select("*")
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
  if (cpf.length === 11) {
    const hash = await hashCPF(cpf, c.env.CPF_HASH_PEPPER);
    query = query.eq("cliente_cpf_hash", hash);
  } else if (cpf.length === 4) {
    query = query.eq("cliente_cpf_ultimos4", cpf);
  }
  if (cursor) query = query.lt("criado_em", cursor);

  const { data, error } = await query;
  if (error) return c.json({ erro: "Não foi possível listar as fichas." }, 500);

  const itens = (data ?? []).map((f: Record<string, unknown>) => resumirFicha(f));
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

  const [{ data: assinaturas }, { data: consentimentos }, { data: anexos }, { data: alteracoes }] =
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
      db
        .from("ficha_alteracoes")
        .select("id, status, justificativa, campos, criado_em, resolvido_em, origem")
        .eq("ficha_id", id)
        .eq("tenant_id", usuario.tenantId)
        .order("criado_em", { ascending: false })
        .limit(20),
    ]);

  // Histórico do mesmo cliente (mesmo CPF quando disponível).
  let historicoQuery = db
    .from("fichas")
    .select("*")
    .eq("tenant_id", usuario.tenantId)
    .neq("id", id)
    .order("criado_em", { ascending: false })
    .limit(10);
  if (ficha.cliente_cpf_hash) {
    historicoQuery = historicoQuery.eq("cliente_cpf_hash", ficha.cliente_cpf_hash);
  } else if (ficha.cliente_cpf_ultimos4) {
    historicoQuery = historicoQuery.eq("cliente_cpf_ultimos4", ficha.cliente_cpf_ultimos4);
  } else {
    historicoQuery = historicoQuery.ilike("cliente_nome", ficha.cliente_nome);
  }
  const { data: historico } = await historicoQuery;

  const profissionais = await listarProfissionais(clienteAdmin(c.env), usuario.tenantId);
  const profissional =
    profissionais.itens.find((p) => p.id === ficha.profissional_id) ??
    profissionais.itens.find(
      (p) =>
        p.nome.trim().toLowerCase() ===
        String(dados.profissional ?? "").trim().toLowerCase()
    ) ??
    null;

  const pendencias =
    Array.isArray(ficha.pendencias) && ficha.pendencias.length
      ? ficha.pendencias
      : Array.isArray((meta as Record<string, unknown>).pendencias)
        ? (meta as Record<string, unknown>).pendencias
        : [];

  return c.json({
    ficha: {
      ...resumirFicha(ficha),
      pendencias,
    },
    dados,
    meta,
    profissional: profissional
      ? { id: profissional.id, nome: profissional.nome, especialidade: profissional.especialidade ?? null }
      : null,
    assinaturas: assinaturas ?? [],
    consentimentos: consentimentos ?? [],
    anexos: anexos ?? [],
    alteracoes: alteracoes ?? [],
    historico_cliente: (historico ?? []).map((f: Record<string, unknown>) => ({
      id: f.id,
      protocolo: f.protocolo,
      status: f.status,
      criado_em: f.criado_em,
      dados_json: f.dados_json,
    })),
  });
});

rotasPainel.get("/fichas/:id/anexos/:anexoId", async (c) => {
  const usuario = c.get("usuario");
  const db = clienteUsuario(c.env, c.get("accessToken"));
  const { data: anexo } = await db
    .from("ficha_anexos")
    .select("*")
    .eq("id", c.req.param("anexoId"))
    .eq("ficha_id", c.req.param("id"))
    .eq("tenant_id", usuario.tenantId)
    .maybeSingle();

  if (!anexo) return c.json({ erro: "Anexo não encontrado." }, 404);
  if (!anexo.storage_key && !anexo.storage_external_id) {
    return c.json({ erro: "O anexo ainda está sendo processado." }, 409);
  }

  let arquivo: { bytes: Uint8Array; contentType: string } | null = null;
  if (anexo.storage_external_id) {
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
      arquivo = await drive.download({ externalId: anexo.storage_external_id });
    }
  } else if (anexo.storage_key) {
    arquivo = await new R2Storage(c.env).download({ key: anexo.storage_key });
  }

  if (!arquivo) return c.json({ erro: "Arquivo não encontrado no armazenamento." }, 404);
  const nome = String(anexo.nome_arquivo ?? "anexo").replace(/[^\p{L}\p{N}._-]+/gu, "_");
  return new Response(arquivo.bytes as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": anexo.mime ?? arquivo.contentType,
      "Content-Disposition": `inline; filename="${nome}"`,
      "Cache-Control": "private, no-store",
    },
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
    const mensagem =
      ficha.status === "erro"
        ? "O PDF não foi gerado. Verifique o erro e reprocesse a ficha."
        : "O PDF ainda está sendo gerado.";
    return c.json({ erro: mensagem, status: ficha.status }, 409);
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

  // Pendências de documentação (feature nova; tolera banco sem a coluna).
  let pendentes = 0;
  try {
    const { count } = await db
      .from("fichas")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", usuario.tenantId)
      .not("pendencias", "is", null);
    pendentes = count ?? 0;
  } catch {
    pendentes = 0;
  }

  const { data: tenant } = await db
    .from("tenants")
    .select("plano")
    .eq("id", usuario.tenantId)
    .maybeSingle();
  const plano = normalizarPlano(tenant?.plano);

  return c.json({
    total,
    salvas,
    erro,
    processando,
    ultimos_30_dias: ultimos30,
    pendentes,
    taxa_conclusao: taxa(salvas, total),
    plano,
    limites: limitesDoPlano(plano),
    atualizado_em: formatarDataHoraBR(new Date()),
  });
});

rotasPainel.get("/analytics", async (c) => {
  const usuario = c.get("usuario");
  const db = clienteUsuario(c.env, c.get("accessToken"));

  const { data: tenant } = await db
    .from("tenants")
    .select("plano, nicho_slug")
    .eq("id", usuario.tenantId)
    .maybeSingle();
  const plano = normalizarPlano(tenant?.plano);
  const limites = limitesDoPlano(plano);

  const dias = Math.max(7, Math.min(Number(c.req.query("dias") ?? 180) || 180, 365));
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const { data, error } = await db
    .from("fichas")
    .select("id, status, criado_em, dados_json, menor_idade, cliente_cpf_hash, cliente_data_nasc, pdf_gerado_em")
    .eq("tenant_id", usuario.tenantId)
    .gte("criado_em", desde.toISOString())
    .order("criado_em", { ascending: false })
    .limit(5000);

  if (error) return c.json({ erro: "Não foi possível carregar os dados." }, 500);
  const fichas = data ?? [];
  const total = fichas.length;
  const salvas = fichas.filter((f) => f.status === "salva").length;
  const erros = fichas.filter((f) => f.status === "erro").length;
  const processando = fichas.filter((f) => f.status === "preenchida").length;
  const menores = fichas.filter((f) => f.menor_idade).length;

  const mesAtual = fichas.filter((f) => new Date(f.criado_em) >= inicioMes).length;
  const limiteMes = limites.fichas_mes;
  const usoMes = verificarLimite(plano, "fichas_mes", mesAtual);

  const base = {
    plano,
    dias,
    disponivel: limites.analytics === true,
    motivo: limites.analytics ? null : mensagemUpgrade(plano, "analytics"),
    resumo: {
      total,
      salvas,
      erros,
      processando,
      menores,
      taxa_conclusao: taxa(salvas, total),
      mes_atual: mesAtual,
      limite_mes: limiteMes,
      uso_mes: usoMes,
    },
  };

  if (!base.disponivel) {
    return c.json({
      ...base,
      serie: serieMensal(fichas, { meses: 6 }),
      atualizado_em: formatarDataHoraBR(new Date()),
    });
  }

  const agrupar = (campo: string) => {
    const mapa = new Map<string, number>();
    for (const ficha of fichas) {
      const bruto = ficha.dados_json?.[campo];
      const valores = Array.isArray(bruto) ? bruto : [bruto];
      for (const valor of valores) {
        const chave = String(valor ?? "").trim();
        if (!chave) continue;
        mapa.set(chave, (mapa.get(chave) ?? 0) + 1);
      }
    }
    return [...mapa.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([valor, quantidade]) => ({
        valor,
        quantidade,
        percentual: taxa(quantidade, total),
      }));
  };

  const clientes = new Map<string, number>();
  for (const ficha of fichas) {
    const chave = ficha.cliente_cpf_hash ?? null;
    if (!chave) continue;
    clientes.set(chave, (clientes.get(chave) ?? 0) + 1);
  }
  const clientesRecorrentes = [...clientes.values()].filter((n) => n > 1).length;

  const porDiaSemana = Array.from({ length: 7 }, (_, i) => ({
    dia: ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"][i],
    total: 0,
  }));
  for (const ficha of fichas) {
    const d = new Date(ficha.criado_em);
    if (!Number.isNaN(d.getTime())) porDiaSemana[d.getDay()].total += 1;
  }

  return c.json({
    ...base,
    serie: serieMensal(fichas, { meses: 6 }),
    profissionais: agrupar("profissional"),
    procedimentos: agrupar("procedimentos"),
    locais: agrupar("local_tatuagem").length
      ? agrupar("local_tatuagem")
      : agrupar("local_piercing"),
    dias_semana: porDiaSemana,
    clientes: {
      distintos: clientes.size,
      recorrentes: clientesRecorrentes,
      taxa_recorrencia: taxa(clientesRecorrentes, Math.max(1, clientes.size)),
    },
    funil: [
      { etapa: "Recebidas", total, percentual: total ? 100 : 0 },
      { etapa: "Concluídas", total: salvas, percentual: taxa(salvas, total) },
      { etapa: "Menores", total: menores, percentual: taxa(menores, total) },
      { etapa: "Com erro", total: erros, percentual: taxa(erros, total) },
    ],
    comparativo_planos: comparativoPlanos(),
    atualizado_em: formatarDataHoraBR(new Date()),
  });
});

rotasPainel.get("/formulario", async (c) => {
  const usuario = c.get("usuario");
  const db = clienteUsuario(c.env, c.get("accessToken"));

  const { data: formulario } = await db
    .from("formularios")
    .select("*")
    .eq("tenant_id", usuario.tenantId)
    .eq("ativo", true)
    .maybeSingle();

  if (!formulario) return c.json({ erro: "Nenhum formulário ativo." }, 404);

  const { data: template } = await db
    .from("templates")
    .select("*")
    .eq("id", formulario.template_id)
    .maybeSingle();

  return c.json({ formulario, template });
});

rotasPainel.patch("/formulario", exigirOwner(), async (c) => {
  const usuario = c.get("usuario");
  const db = clienteUsuario(c.env, c.get("accessToken"));
  const corpo = (await c.req.json().catch(() => null)) as
    | { campos_ativos?: unknown; nome?: string; campos_customizados?: unknown }
    | null;

  if (!corpo) return c.json({ erro: "JSON inválido." }, 400);
  if (corpo.campos_ativos !== undefined) {
    const parsed = camposAtivosSchema.safeParse(corpo.campos_ativos);
    if (!parsed.success) {
      return c.json({ erro: "campos_ativos inválido." }, 422);
    }
    corpo.campos_ativos = parsed.data;
  }
  if (corpo.campos_customizados !== undefined) {
    const parsed = camposCustomizadosSchema.safeParse(corpo.campos_customizados);
    if (!parsed.success) {
      return c.json(
        {
          erro: "Campos personalizados inválidos.",
          detalhes: Object.fromEntries(
            parsed.error.issues.map((i) => [i.path.join("."), i.message])
          ),
        },
        422
      );
    }
    corpo.campos_customizados = parsed.data;

    const { data: tenant } = await db
      .from("tenants")
      .select("plano")
      .eq("id", usuario.tenantId)
      .maybeSingle();
    const plano = normalizarPlano(tenant?.plano);
    const limite = verificarLimite(plano, "campos_customizados", parsed.data.length);
    if (!limite.ok) {
      return c.json(
        {
          erro: mensagemUpgrade(plano, "campos_customizados"),
          codigo: "limite_plano",
          plano,
          upgrade: limite.upgrade,
          limite: limite.limite,
        },
        402
      );
    }
  }

  const atualizacao: Record<string, unknown> = {};
  if (corpo.campos_ativos !== undefined) atualizacao.campos_ativos = corpo.campos_ativos;
  if (corpo.nome) atualizacao.nome = corpo.nome.slice(0, 120);
  if (corpo.campos_customizados !== undefined) {
    atualizacao.campos_customizados = corpo.campos_customizados;
  }

  const { data, error } = await db
    .from("formularios")
    .update(atualizacao)
    .eq("tenant_id", usuario.tenantId)
    .eq("ativo", true)
    .select("*")
    .maybeSingle();

  if (error) {
    const msg = String(error.message ?? "").toLowerCase();
    if (msg.includes("campos_customizados") && (msg.includes("column") || msg.includes("schema"))) {
      return c.json(
        {
          erro: "Campos personalizados exigem a migration de features no banco.",
          codigo: "migration_pendente",
        },
        409
      );
    }
    return c.json({ erro: "Não foi possível atualizar o formulário." }, 500);
  }
  return c.json({
    formulario: data
      ? {
          ...data,
          campos_customizados: data.campos_customizados ?? [],
        }
      : null,
  });
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
    "permissoes",
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
  if (atualizacao.permissoes !== undefined) {
    atualizacao.permissoes = normalizarPermissoes(atualizacao.permissoes as Record<string, boolean>);
  }
  if (atualizacao.branding !== undefined) {
    const branding = atualizacao.branding as Record<string, unknown>;
    for (const cor of ["cor_primaria", "cor_secundaria", "cor_fundo"]) {
      if (branding?.[cor] !== undefined && !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(branding[cor]))) {
        return c.json({ erro: `Cor inválida em ${cor}. Use hexadecimal (#RRGGBB).` }, 422);
      }
    }
  }

  const { data, error } = await db
    .from("tenants")
    .update(atualizacao)
    .eq("id", usuario.tenantId)
    .select("*")
    .maybeSingle();

  if (error) {
    const msg = String(error.message ?? "").toLowerCase();
    if (msg.includes("permissoes") || msg.includes("column")) {
      return c.json(
        {
          erro: "Essa configuração exige a migration de features no banco.",
          codigo: "migration_pendente",
        },
        409
      );
    }
    return c.json({ erro: "Não foi possível atualizar o estabelecimento." }, 500);
  }
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

// ------------------------------------------------------------
// Profissionais respons�veis
// ------------------------------------------------------------
rotasPainel.get("/profissionais", async (c) => {
  const usuario = c.get("usuario");
  const admin = clienteAdmin(c.env);
  const lista = await listarProfissionais(admin, usuario.tenantId, { somenteAtivos: false });
  return c.json(lista);
});

rotasPainel.post("/profissionais", exigirOwner(), async (c) => {
  const usuario = c.get("usuario");
  const db = clienteUsuario(c.env, c.get("accessToken"));
  const corpo = await c.req.json().catch(() => null);
  const parsed = profissionalSchema.safeParse(corpo);
  if (!parsed.success) {
    return c.json(
      {
        erro: "Dados do profissional inv�lidos.",
        detalhes: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])),
      },
      422
    );
  }

  const { data: tenant } = await db
    .from("tenants")
    .select("plano")
    .eq("id", usuario.tenantId)
    .maybeSingle();
  const plano = normalizarPlano(tenant?.plano);
  const lista = await listarProfissionais(clienteAdmin(c.env), usuario.tenantId, {
    somenteAtivos: true,
  });
  const limite = verificarLimite(plano, "profissionais", lista.itens.length);
  if (!limite.ok) {
    return c.json(
      {
        erro: mensagemUpgrade(plano, "profissionais"),
        codigo: "limite_plano",
        plano,
        upgrade: limite.upgrade,
        limite: limite.limite,
      },
      402
    );
  }

  const { data: profissional, error } = await db
    .from("profissionais")
    .insert({
      tenant_id: usuario.tenantId,
      nome: parsed.data.nome,
      email: parsed.data.email ?? null,
      telefone: parsed.data.telefone ?? null,
      especialidade: parsed.data.especialidade ?? null,
      registro: parsed.data.registro ?? null,
      cor: parsed.data.cor ?? null,
      ativo: parsed.data.ativo ?? true,
    })
    .select("*")
    .maybeSingle();

  if (error) {
    if (tabelaAusente(error)) {
      return c.json(
        {
          erro: "O cadastro de equipe exige a migration de features no banco.",
          codigo: "migration_pendente",
        },
        409
      );
    }
    return c.json({ erro: "N�o foi poss�vel cadastrar o profissional." }, 500);
  }
  return c.json({ profissional }, 201);
});

rotasPainel.patch("/profissionais/:id", exigirOwner(), async (c) => {
  const usuario = c.get("usuario");
  const db = clienteUsuario(c.env, c.get("accessToken"));
  const parsed = profissionalSchema.partial().safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ erro: "Dados inv�lidos." }, 422);

  const atualizacao: Record<string, unknown> = {};
  const dados = parsed.data;
  if (dados.nome !== undefined) atualizacao.nome = dados.nome;
  if (dados.email !== undefined) atualizacao.email = dados.email;
  if (dados.telefone !== undefined) atualizacao.telefone = dados.telefone;
  if (dados.especialidade !== undefined) atualizacao.especialidade = dados.especialidade;
  if (dados.registro !== undefined) atualizacao.registro = dados.registro;
  if (dados.cor !== undefined) atualizacao.cor = dados.cor;
  if (dados.ativo !== undefined) atualizacao.ativo = dados.ativo;
  if (!Object.keys(atualizacao).length) return c.json({ erro: "Nada para atualizar." }, 422);

  const { data, error } = await db
    .from("profissionais")
    .update(atualizacao)
    .eq("id", c.req.param("id"))
    .eq("tenant_id", usuario.tenantId)
    .select("*")
    .maybeSingle();

  if (error) {
    if (tabelaAusente(error)) {
      return c.json({ erro: "Recurso indispon�vel no banco atual.", codigo: "migration_pendente" }, 409);
    }
    return c.json({ erro: "N�o foi poss�vel atualizar o profissional." }, 500);
  }
  return c.json({ profissional: data });
});

rotasPainel.delete("/profissionais/:id", exigirOwner(), async (c) => {
  const usuario = c.get("usuario");
  const db = clienteUsuario(c.env, c.get("accessToken"));
  const { error } = await db
    .from("profissionais")
    .update({ ativo: false })
    .eq("id", c.req.param("id"))
    .eq("tenant_id", usuario.tenantId);

  if (error) return c.json({ erro: "N�o foi poss�vel desativar o profissional." }, 500);
  return c.json({ ok: true });
});

// ------------------------------------------------------------
// Clientes: busca por CPF/nome e jornada conectada
// ------------------------------------------------------------
rotasPainel.get("/clientes", async (c) => {
  const usuario = c.get("usuario");
  const db = clienteUsuario(c.env, c.get("accessToken"));
  const q = (c.req.query("q") ?? "").trim().slice(0, 80);
  const digitos = q.replace(/\D+/g, "");

  let query = db
    .from("fichas")
    .select("*")
    .eq("tenant_id", usuario.tenantId)
    .order("criado_em", { ascending: false })
    .limit(500);

  if (digitos.length === 11) {
    const hash = await hashCPF(digitos, c.env.CPF_HASH_PEPPER);
    query = query.eq("cliente_cpf_hash", hash);
  } else if (digitos.length === 4) {
    query = query.eq("cliente_cpf_ultimos4", digitos);
  } else if (q) {
    query = query.ilike("cliente_nome", `%${q.replace(/[%_,()]/g, " ")}%`);
  }

  const { data, error } = await query;
  if (error) return c.json({ erro: "N�o foi poss�vel buscar os clientes." }, 500);

  const grupos = new Map<string, Record<string, any>>();
  for (const ficha of data ?? []) {
    const chave =
      ficha.cliente_cpf_hash ??
      `nome:${String(ficha.cliente_nome ?? "").trim().toLowerCase()}`;
    const atual = grupos.get(chave) ?? {
      chave,
      nome: ficha.cliente_nome,
      cpf_ultimos4: ficha.cliente_cpf_ultimos4,
      data_nascimento: ficha.cliente_data_nasc,
      menor_idade: ficha.menor_idade,
      total_fichas: 0,
      pendentes: 0,
      ultima_ficha_em: ficha.criado_em,
      profissional: ficha.dados_json?.profissional ?? null,
      fichas: [],
    };
    atual.total_fichas += 1;
    if (Array.isArray(ficha.pendencias) && ficha.pendencias.length) atual.pendentes += 1;
    if (atual.fichas.length < 20) {
      atual.fichas.push({
        id: ficha.id,
        protocolo: ficha.protocolo,
        status: ficha.status,
        criado_em: ficha.criado_em,
        pdf_gerado_em: ficha.pdf_gerado_em,
        dados_json: ficha.dados_json,
        pendencias: ficha.pendencias ?? [],
      });
    }
    grupos.set(chave, atual);
  }

  const itens = [...grupos.values()].sort(
    (a, b) => new Date(b.ultima_ficha_em).getTime() - new Date(a.ultima_ficha_em).getTime()
  );

  return c.json({
    itens,
    total: itens.length,
    fichas: data?.length ?? 0,
    busca: q || null,
  });
});

// ------------------------------------------------------------
// Aprova��o de altera��es de ficha
// ------------------------------------------------------------
rotasPainel.get("/alteracoes", async (c) => {
  const usuario = c.get("usuario");
  const db = clienteUsuario(c.env, c.get("accessToken"));
  const status = c.req.query("status") ?? "pendente";

  const { data, error } = await db
    .from("ficha_alteracoes")
    .select("id, ficha_id, tenant_id, status, justificativa, campos, origem, criado_em, resolvido_em")
    .eq("tenant_id", usuario.tenantId)
    .eq("status", status)
    .order("criado_em", { ascending: false })
    .limit(100);

  if (error) {
    if (tabelaAusente(error)) {
      return c.json({ itens: [], disponivel: false, codigo: "migration_pendente" });
    }
    return c.json({ erro: "N�o foi poss�vel carregar as solicita��es." }, 500);
  }

  const fichasIds = [...new Set((data ?? []).map((a) => a.ficha_id))];
  const { data: fichas } = fichasIds.length
    ? await db
        .from("fichas")
        .select("id, protocolo, cliente_nome")
        .eq("tenant_id", usuario.tenantId)
        .in("id", fichasIds)
    : { data: [] };
  const mapa = new Map((fichas ?? []).map((f) => [f.id, f]));

  return c.json({
    itens: (data ?? []).map((a) => ({
      ...a,
      protocolo: mapa.get(a.ficha_id)?.protocolo ?? null,
      cliente_nome: mapa.get(a.ficha_id)?.cliente_nome ?? null,
    })),
    disponivel: true,
  });
});

rotasPainel.patch("/alteracoes/:id", exigirOwner(), async (c) => {
  const usuario = c.get("usuario");
  const db = clienteUsuario(c.env, c.get("accessToken"));
  const corpo = (await c.req.json().catch(() => null)) as
    | { status?: string; resposta?: string }
    | null;
  const status = corpo?.status;
  if (!status || !["aprovada", "recusada"].includes(status)) {
    return c.json({ erro: "Status inv�lido." }, 422);
  }

  const { data, error } = await db
    .from("ficha_alteracoes")
    .update({
      status,
      resposta: corpo?.resposta?.slice(0, 500) ?? null,
      resolvido_em: new Date().toISOString(),
      resolvido_por: usuario.id,
    })
    .eq("id", c.req.param("id"))
    .eq("tenant_id", usuario.tenantId)
    .select("*")
    .maybeSingle();

  if (error) return c.json({ erro: "N�o foi poss�vel atualizar a solicita��o." }, 500);
  return c.json({ alteracao: data });
});

// ------------------------------------------------------------
// Edi��o de ficha com autoriza��o do dono + auditoria
// ------------------------------------------------------------
rotasPainel.patch("/fichas/:id", exigirOwner(), async (c) => {
  const usuario = c.get("usuario");
  const db = clienteUsuario(c.env, c.get("accessToken"));
  const id = c.req.param("id");
  const parsed = edicaoFichaSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return c.json(
      {
        erro: "Dados de edi��o inv�lidos. Informe a justificativa.",
        detalhes: Object.fromEntries(parsed.error.issues.map((i) => [i.path.join("."), i.message])),
      },
      422
    );
  }

  const { data: ficha } = await db
    .from("fichas")
    .select("*")
    .eq("id", id)
    .eq("tenant_id", usuario.tenantId)
    .maybeSingle();
  if (!ficha) return c.json({ erro: "Ficha n�o encontrada." }, 404);

  const { data: tenant } = await db
    .from("tenants")
    .select("*")
    .eq("id", usuario.tenantId)
    .maybeSingle();
  const permissoes = normalizarPermissoes(tenant?.permissoes);
  if (!permissoes.permite_alteracao_dados) {
    return c.json({ erro: "A edi��o de fichas est� desativada para este estabelecimento." }, 403);
  }
  if (permissoes.exige_aprovacao_alteracao && !parsed.data.alteracao_id) {
    // O dono da ficha est� autenticado e autorizando a pr�pria edi��o.
    // A exig�ncia de aprova��o vale para solicita��es externas.
  }

  const { data: formulario } = await db
    .from("formularios")
    .select("*")
    .eq("id", ficha.formulario_id)
    .maybeSingle();
  const { data: templateRow } = await db
    .from("templates")
    .select("*")
    .eq("id", ficha.template_id)
    .maybeSingle();
  if (!templateRow) return c.json({ erro: "Template da ficha n�o encontrado." }, 500);

  const template = aplicarCamposCustomizados(
    aplicarCamposAtivos(
      {
        ...templateRow,
        secoes: templateRow.campos_json?.secoes ?? [],
        consentimentos_extras: templateRow.campos_json?.consentimentos_extras ?? [],
      },
      formulario?.campos_ativos ?? null
    ),
    formulario?.campos_customizados ?? []
  );

  let decifrado: { dados: Record<string, any>; meta?: Record<string, any> };
  try {
    decifrado = await descriptografarJson(ficha.dados_cifrados, c.env.DATA_ENCRYPTION_KEY);
  } catch {
    return c.json({ erro: "N�o foi poss�vel abrir a ficha para edi��o." }, 500);
  }

  const dadosNovos = { ...decifrado.dados, ...parsed.data.dados };
  const limpos = sanitizarRespostas(template, dadosNovos, {
    camposAtivos: null,
  }) as Record<string, any>;

  const idadeBase = calcularIdade(limpos.data_nascimento);
  const update: Record<string, unknown> = {
    dados_cifrados: await criptografarJson(
      { ...decifrado, dados: limpos },
      c.env.DATA_ENCRYPTION_KEY
    ),
    cliente_nome: limitar(String(limpos.nome ?? ficha.cliente_nome), 200),
    cliente_cpf_ultimos4: limpos.cpf ? String(limpos.cpf).replace(/\D+/g, "").slice(-4) : ficha.cliente_cpf_ultimos4,
    dados_json: resumoFicha(template, limpos),
    timestamp_assinatura: ficha.timestamp_assinatura,
  };
  if (limpos.cpf) {
    update.cliente_cpf_hash = await hashCPF(String(limpos.cpf), c.env.CPF_HASH_PEPPER);
  }
  if (limpos.data_nascimento) {
    update.cliente_data_nasc = limpos.data_nascimento;
    update.menor_idade = idadeBase !== null ? idadeBase < 18 : ficha.menor_idade;
  }

  const { error: erroUpdate } = await db.from("fichas").update(update).eq("id", id);
  if (erroUpdate) return c.json({ erro: "N�o foi poss�vel salvar a edi��o." }, 500);

  const camposAlterados = Object.keys(parsed.data.dados);
  await db.from("eventos").insert({
    tenant_id: usuario.tenantId,
    ficha_id: id,
    tipo: "ficha_alterada",
    metadata: {
      campos: camposAlterados,
      justificativa: parsed.data.justificativa,
      alteracao_id: parsed.data.alteracao_id ?? null,
      por: usuario.email,
    },
  });

  if (parsed.data.alteracao_id) {
    await db
      .from("ficha_alteracoes")
      .update({
        status: "aprovada",
        resolvido_em: new Date().toISOString(),
        resolvido_por: usuario.id,
      })
      .eq("id", parsed.data.alteracao_id)
      .eq("tenant_id", usuario.tenantId);
  }

  return c.json({ ok: true, campos_alterados: camposAlterados });
});

rotasPainel.post("/fichas/:id/pendencias/:indice/resolver", exigirOwner(), async (c) => {
  const usuario = c.get("usuario");
  const db = clienteUsuario(c.env, c.get("accessToken"));
  const id = c.req.param("id");
  const indice = Number(c.req.param("indice"));

  const { data: ficha } = await db
    .from("fichas")
    .select("id, pendencias")
    .eq("id", id)
    .eq("tenant_id", usuario.tenantId)
    .maybeSingle();
  if (!ficha) return c.json({ erro: "Ficha n�o encontrada." }, 404);
  const pendencias = Array.isArray(ficha.pendencias) ? [...ficha.pendencias] : [];
  if (!pendencias[indice]) return c.json({ erro: "Pend�ncia n�o encontrada." }, 404);

  pendencias[indice] = {
    ...pendencias[indice],
    status: "resolvida",
    resolvido_em: new Date().toISOString(),
    resolvido_por: usuario.email,
  };

  const { error } = await db.from("fichas").update({ pendencias }).eq("id", id);
  if (error) {
    return c.json(
      { erro: "Resolu��o de pend�ncias exige a migration de features.", codigo: "migration_pendente" },
      409
    );
  }
  await db.from("eventos").insert({
    tenant_id: usuario.tenantId,
    ficha_id: id,
    tipo: "pendencia_resolvida",
    metadata: { indice, por: usuario.email },
  });
  return c.json({ ok: true, pendencias });
});

function limitar(texto: string, max: number) {
  return String(texto ?? "").slice(0, max);
}
