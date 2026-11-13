import {
  aplicarCamposAtivos,
  aplicarCamposCustomizados,
  base64ParaBytes,
  calcularIdade,
  hashConteudo,
  mensagemUpgrade,
  normalizarPermissoes,
  PLANOS,
  produtosPara,
  renderizarTexto,
  resumoFicha,
  sanitizarRespostas,
  ultimos4CPF,
  validarRespostas,
  verificarLimite,
} from "@fichapro/shared";
import type { Env, PdfJob } from "../env.js";
import {
  criptografarJson,
  descriptografarJson,
  hashBytes,
  hashCPF,
  nomeArquivoSeguro,
  normalizarIp,
  tokenComplemento,
} from "../lib/crypto.js";
import { clienteAdmin } from "../lib/supabase.js";
import type { PayloadFicha } from "../lib/schemas.js";
import { gerarPdfFicha } from "./pdf.js";
import { listarProfissionais, resolverProfissional } from "./profissionais.js";
import { obterStorage, type StorageAdapter } from "./storage.js";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    mensagem: string,
    public readonly detalhes?: Record<string, string>
  ) {
    super(mensagem);
    this.name = "HttpError";
  }
}

interface TenantRow {
  id: string;
  slug: string;
  nome_negocio: string;
  nicho_slug: string;
  plano: string;
  status: string;
  storage_mode: "drive" | "r2";
  branding: Record<string, unknown> | null;
  email_contato: string | null;
  retencao_anos: number;
  trial_expira_em: string | null;
  whatsapp?: string | null;
  permissoes?: Record<string, boolean> | null;
}

interface TemplateRow {
  id: string;
  nicho_slug: string;
  nome: string;
  nome_comercial: string | null;
  versao: number;
  campos_json: {
    secoes: Array<Record<string, any>>;
    consentimentos_extras?: Array<{ id: string; label: string; obrigatorio?: boolean }>;
  };
  termo_texto: string;
  consentimento_lgpd: string;
}

function montarTemplate(row: TemplateRow) {
  return {
    ...row,
    secoes: row.campos_json?.secoes ?? [],
    consentimentos_extras: row.campos_json?.consentimentos_extras ?? [],
  };
}

function dataMaisAnos(anos: number): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() + anos);
  return d.toISOString().slice(0, 10);
}

function mesReferencia(data: string | Date | null | undefined): string {
  const d = data ? new Date(data) : new Date();
  if (Number.isNaN(d.getTime())) return new Date().toISOString().slice(0, 7);
  return d.toISOString().slice(0, 7);
}

function erroMensagem(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function normalizarPlano(valor: unknown): keyof typeof PLANOS {
  return typeof valor === "string" && Object.prototype.hasOwnProperty.call(PLANOS, valor)
    ? (valor as keyof typeof PLANOS)
    : "solo";
}

/** Erro do PostgREST quando uma coluna nova ainda não existe no banco. */
function colunaAusente(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = String(error.message ?? "").toLowerCase();
  return (
    error.code === "PGRST204" ||
    error.code === "42703" ||
    (msg.includes("column") && msg.includes("does not exist")) ||
    msg.includes("could not find") && msg.includes("column")
  );
}

/**
 * Limite de fichas do plano. O plano Solo atual é ilimitado; o trial tem
 * teto para evitar abuso. O bloqueio devolve 402 com instrução de upgrade.
 */
async function garantirLimiteFichas(env: Env, tenant: TenantRow): Promise<void> {
  const plano = normalizarPlano(tenant.plano);
  const limite = PLANOS[plano].limites.fichas_mes;
  if (limite === null || limite === undefined) return;

  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
  const admin = clienteAdmin(env);
  const { count } = await admin
    .from("fichas")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenant.id)
    .gte("criado_em", inicioMes);

  const verificacao = verificarLimite(plano, "fichas_mes", count ?? 0);
  if (!verificacao.ok) {
    throw new HttpError(
      402,
      `${mensagemUpgrade(plano, "fichas_mes")} Limite atual: ${verificacao.limite} fichas por mês.`,
      {
        codigo: "limite_plano",
        recurso: "fichas_mes",
        plano,
        upgrade: verificacao.upgrade ?? "estudio",
      }
    );
  }
}

function validarImagemAssinatura(base64: string): boolean {
  const limpo = base64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
  try {
    const bytes = base64ParaBytes(limpo);
    if (bytes.length < 200) return false;
    const png = bytes[0] === 0x89 && bytes[1] === 0x50;
    const jpg = bytes[0] === 0xff && bytes[1] === 0xd8;
    return png || jpg;
  } catch {
    return false;
  }
}

/** Configuração pública consumida pela ficha. */
export async function obterFormularioPublico(env: Env, slug: string) {
  const admin = clienteAdmin(env);

  const { data: tenant, error } = await admin
    .from("tenants")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<TenantRow>();

  if (error) throw new HttpError(500, "Não foi possível carregar o estabelecimento.");
  if (!tenant) throw new HttpError(404, "Ficha não encontrada.");

  const ativo = tenant.status === "ativo" || tenant.status === "trial";
  if (!ativo) {
    throw new HttpError(
      403,
      "Este estabelecimento está com o acesso suspenso. Fale com o responsável."
    );
  }
  if (
    tenant.status === "trial" &&
    tenant.trial_expira_em &&
    new Date(tenant.trial_expira_em).getTime() < Date.now()
  ) {
    throw new HttpError(403, "O período de teste deste estabelecimento expirou.");
  }

  const { data: formulario } = await admin
    .from("formularios")
    .select("*")
    .eq("tenant_id", tenant.id)
    .eq("ativo", true)
    .order("criado_em", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!formulario) {
    throw new HttpError(409, "Este estabelecimento ainda não configurou uma ficha.");
  }

  const { data: template, error: erroTemplate } = await admin
    .from("templates")
    .select("*")
    .eq("id", formulario.template_id)
    .eq("ativo", true)
    .maybeSingle<TemplateRow>();

  if (erroTemplate || !template) {
    throw new HttpError(409, "O template desta ficha não está disponível.");
  }

  const { itens: profissionais, aviso: avisoProfissionais } = await listarProfissionais(
    admin,
    tenant.id
  );

  const branding = {
    ...(tenant.branding ?? {}),
    ...((formulario.branding_override as Record<string, unknown> | null) ?? {}),
  };

  const templateCompleto = aplicarCamposCustomizados(
    montarTemplate(template),
    formulario.campos_customizados ?? []
  );
  const permissoes = normalizarPermissoes(tenant.permissoes);

  return {
    tenant: {
      slug: tenant.slug,
      nome_negocio: tenant.nome_negocio,
      nicho_slug: tenant.nicho_slug,
      branding,
      retencao_anos: tenant.retencao_anos,
      email_contato: tenant.email_contato,
      whatsapp: tenant.whatsapp ?? null,
    },
    template: {
      nicho_slug: template.nicho_slug,
      nome: template.nome,
      nome_comercial: template.nome_comercial,
      versao: template.versao,
      secoes: template.campos_json.secoes,
      consentimentos_extras: templateCompleto.consentimentos_extras ?? [],
      termo_texto: template.termo_texto,
      consentimento_lgpd: template.consentimento_lgpd,
    },
    formulario: {
      id: formulario.id,
      nome: formulario.nome,
      campos_ativos: formulario.campos_ativos ?? null,
      campos_customizados: formulario.campos_customizados ?? [],
    },
    profissionais: profissionais.map((p) => ({
      id: p.id,
      nome: p.nome?.trim() || "Profissional",
      especialidade: p.especialidade ?? null,
    })),
    permissoes,
    produtos: permissoes.mostrar_vitrine
      ? produtosPara(tenant.nicho_slug, 3)
      : [],
    avisos: avisoProfissionais ? [avisoProfissionais] : [],
    config: { api_version: 2 },
  };
}

/** Cria a ficha, os anexos, as assinaturas e enfileira o PDF. */
export async function criarFichaPublica(
  env: Env,
  payload: PayloadFicha,
  ip: string | null,
  userAgent: string | null
) {
  const admin = clienteAdmin(env);

  const { data: tenant, error } = await admin
    .from("tenants")
    .select("*")
    .eq("slug", payload.tenant_slug)
    .maybeSingle<TenantRow>();

  if (error) throw new HttpError(500, "Não foi possível carregar o estabelecimento.");
  if (!tenant) throw new HttpError(404, "Estabelecimento não encontrado.");
  if (tenant.status !== "ativo" && tenant.status !== "trial") {
    throw new HttpError(403, "Estabelecimento com acesso suspenso.");
  }
  if (
    tenant.status === "trial" &&
    tenant.trial_expira_em &&
    new Date(tenant.trial_expira_em).getTime() < Date.now()
  ) {
    throw new HttpError(403, "O período de teste deste estabelecimento expirou.");
  }

  const consultaFormulario = admin
    .from("formularios")
    .select("*")
    .eq("tenant_id", tenant.id)
    .eq("ativo", true);

  const { data: formulario } = payload.formulario_id
    ? await consultaFormulario.eq("id", payload.formulario_id).maybeSingle()
    : await consultaFormulario.order("criado_em", { ascending: true }).limit(1).maybeSingle();

  if (!formulario) throw new HttpError(409, "Formulário não encontrado ou inativo.");

  const { data: templateRow, error: erroTemplate } = await admin
    .from("templates")
    .select("*")
    .eq("id", formulario.template_id)
    .eq("ativo", true)
    .maybeSingle<TemplateRow>();

  if (erroTemplate || !templateRow) throw new HttpError(409, "Template indisponível.");
  if (templateRow.nicho_slug !== payload.template_slug) {
    throw new HttpError(409, "O template enviado não corresponde ao formulário do estabelecimento.");
  }

  const templateBase = montarTemplate(templateRow);
  const template = aplicarCamposCustomizados(
    aplicarCamposAtivos(templateBase, formulario.campos_ativos ?? null),
    formulario.campos_customizados ?? []
  );
  const permissoes = normalizarPermissoes(tenant.permissoes);
  const dadosBrutos = payload.dados ?? {};

  await garantirLimiteFichas(env, tenant);

  const validacao = validarRespostas(template, dadosBrutos, { camposAtivos: null }) as {
    valido: boolean;
    erros: Record<string, string>;
  };
  if (!validacao.valido) {
    throw new HttpError(422, "Há campos inválidos ou obrigatórios não preenchidos.", validacao.erros);
  }

  const idade = calcularIdade(dadosBrutos.data_nascimento);
  if (idade === null) {
    throw new HttpError(422, "Data de nascimento inválida.", {
      data_nascimento: "Data de nascimento inválida.",
    });
  }
  const menorIdade = idade < 18;

  const assinaturaCliente = payload.assinaturas.find((a) => a.papel === "cliente");
  const assinaturaResponsavel = payload.assinaturas.find((a) => a.papel === "responsavel");
  const pendenciaSolicitada = menorIdade && payload.meta?.pendencia_documentacao === true;
  const pendenciaPermitida = permissoes.permite_pendencia_responsavel === true;
  const pendencias: Array<Record<string, unknown>> = [];

  if (!assinaturaCliente || !validarImagemAssinatura(assinaturaCliente.imagem_base64)) {
    throw new HttpError(422, "A assinatura do cliente é obrigatória.");
  }
  if (menorIdade) {
    const assinouResponsavel =
      assinaturaResponsavel && validarImagemAssinatura(assinaturaResponsavel.imagem_base64);
    if (!assinouResponsavel && !pendenciaSolicitada) {
      throw new HttpError(422, "A assinatura do responsável legal é obrigatória.");
    }
    if (!assinouResponsavel && pendenciaSolicitada) {
      if (!pendenciaPermitida) {
        throw new HttpError(
          422,
          "Este estabelecimento não permite concluir a ficha sem a assinatura do responsável."
        );
      }
      pendencias.push({
        tipo: "documentacao_responsavel",
        descricao: "Aguardando assinatura e documento do responsável legal.",
        status: "pendente",
        criado_em: new Date().toISOString(),
      });
    }
  } else if (assinaturaResponsavel) {
    throw new HttpError(422, "Assinatura de responsável enviada sem cliente menor de idade.");
  }

  const consentPorTipo = new Map(payload.consentimentos.map((c) => [c.tipo, c]));
  for (const tipo of ["termo", "lgpd"]) {
    const c = consentPorTipo.get(tipo);
    if (!c || c.aceito !== true) {
      throw new HttpError(422, `O consentimento "${tipo}" é obrigatório.`);
    }
  }
  for (const extra of template.consentimentos_extras ?? []) {
    const c = consentPorTipo.get(`extra:${extra.id}`);
    if (extra.obrigatorio && (!c || c.aceito !== true)) {
      throw new HttpError(422, `O consentimento "${extra.label}" é obrigatório.`);
    }
  }

  const limpos = sanitizarRespostas(template, dadosBrutos, { camposAtivos: null }) as Record<
    string,
    any
  >;
  const profissional = await resolverProfissional(admin, tenant.id, {
    id: payload.profissional_id ?? null,
    nome: limpos.profissional ?? null,
  });
  const dadosSemArquivos: Record<string, any> = { ...limpos };
  const anexos: Array<{
    tipo: string;
    nome_arquivo: string;
    mime: string;
    tamanho_bytes: number;
    conteudo_base64: string;
  }> = [];

  const templateFiltrado = template;
  for (const secao of templateFiltrado.secoes ?? []) {
    for (const campo of secao.campos ?? []) {
      if (campo.tipo !== "upload") continue;
      const valor = limpos[campo.id] as
        | { base64?: string; mime?: string; nome?: string; tamanho?: number }
        | undefined;
      if (!valor?.base64) continue;
      const tamanho =
        valor.tamanho ?? Math.floor((String(valor.base64).length * 3) / 4);
      anexos.push({
        tipo: campo.id,
        nome_arquivo: valor.nome ?? `${campo.id}.bin`,
        mime: valor.mime ?? "application/octet-stream",
        tamanho_bytes: tamanho,
        conteudo_base64: String(valor.base64).replace(/^data:[^;]+;base64,/, ""),
      });
      dadosSemArquivos[campo.id] = {
        nome: valor.nome ?? "documento",
        mime: valor.mime ?? "application/octet-stream",
        tamanho,
        anexo: true,
      };
    }
  }

  const assinadoEm = new Date();
  const ipNormalizado = normalizarIp(ip);
  const ua = (userAgent ?? "").slice(0, 800) || null;

  const consentimentosNormalizados = payload.consentimentos.map((c) => ({
    tipo: c.tipo,
    aceito: c.aceito === true,
    texto_aceito: c.texto_aceito?.slice(0, 20000),
    versao: c.versao?.slice(0, 20),
  }));

  const hashConteudoAssinado = await hashConteudo({
    tenant: tenant.slug,
    template: template.nicho_slug,
    versao: template.versao,
    dados: dadosSemArquivos,
    consentimentos: consentimentosNormalizados.map((c) => ({
      tipo: c.tipo,
      aceito: c.aceito,
    })),
    assinaturas: payload.assinaturas.map((a) => a.papel),
    assinado_em: assinadoEm.toISOString(),
  });

  const idempotencyKey = payload.meta?.idempotencia?.slice(0, 100) || null;

  if (idempotencyKey) {
    const { data: existente } = await admin
      .from("fichas")
      .select("id, protocolo, status")
      .eq("tenant_id", tenant.id)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
    if (existente) {
      return {
        id: existente.id,
        protocolo: existente.protocolo,
        status: existente.status,
        idempotente: true,
      };
    }
  }

  const dadosCifrados = await criptografarJson(
    {
      dados: dadosSemArquivos,
      meta: {
        iniciado_em: payload.meta?.iniciado_em,
        concluido_em: payload.meta?.concluido_em,
        idioma: payload.meta?.idioma,
        user_agent: payload.meta?.user_agent,
        menor_idade: menorIdade,
        pendencias,
        profissional_id: profissional?.id ?? null,
      },
      template_versao: template.versao,
    },
    env.DATA_ENCRYPTION_KEY
  );

  const clienteCpfHash = await hashCPF(String(limpos.cpf ?? ""), env.CPF_HASH_PEPPER);

  const registroFicha: Record<string, unknown> = {
    tenant_id: tenant.id,
    formulario_id: formulario.id,
    template_id: template.id,
    cliente_nome: String(limpos.nome),
    cliente_cpf_hash: clienteCpfHash,
    cliente_cpf_ultimos4: ultimos4CPF(String(limpos.cpf ?? "")),
    cliente_data_nasc: limpos.data_nascimento,
    menor_idade: menorIdade,
    status: "preenchida",
    dados_json: resumoFicha(template, dadosSemArquivos),
    dados_cifrados: dadosCifrados,
    ip_assinatura: ipNormalizado,
    user_agent_assinatura: ua,
    timestamp_assinatura: assinadoEm.toISOString(),
    retencao_ate: dataMaisAnos(tenant.retencao_anos),
    origem: "form_publico",
    idempotency_key: idempotencyKey,
  };

  const extrasFicha: Record<string, unknown> = {};
  if (profissional?.id) extrasFicha.profissional_id = profissional.id;
  if (pendencias.length) extrasFicha.pendencias = pendencias;

  let { data: ficha, error: erroInsert } = await admin
    .from("fichas")
    .insert({ ...registroFicha, ...extrasFicha })
    .select("id, protocolo, status")
    .single();

  // Compatibilidade com bancos que ainda não receberam a migration de features.
  if (erroInsert && Object.keys(extrasFicha).length && colunaAusente(erroInsert)) {
    ({ data: ficha, error: erroInsert } = await admin
      .from("fichas")
      .insert(registroFicha)
      .select("id, protocolo, status")
      .single());
  }

  if (erroInsert || !ficha) {
    // Corrida de idempotência: devolve a ficha já criada.
    if (erroInsert?.code === "23505" && idempotencyKey) {
      const { data: existente } = await admin
        .from("fichas")
        .select("id, protocolo, status")
        .eq("tenant_id", tenant.id)
        .eq("idempotency_key", idempotencyKey)
        .maybeSingle();
      if (existente) {
        return {
          id: existente.id,
          protocolo: existente.protocolo,
          status: existente.status,
          idempotente: true,
        };
      }
    }
    throw new HttpError(500, "Não foi possível salvar a ficha. Tente novamente.");
  }

  // Anexos
  if (anexos.length) {
    const { error: erroAnexos } = await admin.from("ficha_anexos").insert(
      anexos.map((a) => ({
        tenant_id: tenant.id,
        ficha_id: ficha.id,
        tipo: a.tipo,
        nome_arquivo: a.nome_arquivo,
        mime: a.mime,
        tamanho_bytes: a.tamanho_bytes,
        conteudo_base64: a.conteudo_base64,
        status: "pendente",
      }))
    );
    if (erroAnexos) {
      await admin.from("fichas").update({ status: "erro", erro_ultimo: "Falha ao salvar anexos" }).eq("id", ficha.id);
      throw new HttpError(500, "Não foi possível salvar os anexos da ficha.");
    }
  }

  // Assinaturas
  const imagens = new Map(
    payload.assinaturas.map((a) => [
      a.papel,
      String(a.imagem_base64).replace(/^data:image\/(png|jpeg|jpg);base64,/, ""),
    ])
  );
  const { error: erroAssinaturas } = await admin.from("assinaturas").insert(
    payload.assinaturas.map((a) => ({
      tenant_id: tenant.id,
      ficha_id: ficha.id,
      papel: a.papel,
      imagem_base64: imagens.get(a.papel),
      hash_conteudo: hashConteudoAssinado,
      ip: ipNormalizado,
      user_agent: ua,
      timestamp: assinadoEm.toISOString(),
    }))
  );
  if (erroAssinaturas) {
    await admin.from("fichas").update({ status: "erro", erro_ultimo: "Falha ao salvar assinaturas" }).eq("id", ficha.id);
    throw new HttpError(500, "Não foi possível salvar as assinaturas.");
  }

  // Consentimentos com texto canônico do template (não confiar no cliente)
  const textoTermo = renderizarTexto(template.termo_texto, {
    nome_negocio: tenant.nome_negocio,
    retencao_anos: tenant.retencao_anos,
    email_contato: tenant.email_contato,
  });
  const textoLgpd = renderizarTexto(template.consentimento_lgpd, {
    nome_negocio: tenant.nome_negocio,
    retencao_anos: tenant.retencao_anos,
    email_contato: tenant.email_contato,
  });

  const registrosConsentimento = [
    { tipo: "termo", texto: textoTermo, aceito: true },
    { tipo: "lgpd", texto: textoLgpd, aceito: true },
    ...(template.consentimentos_extras ?? []).map(
      (extra: { id: string; label: string; obrigatorio?: boolean }) => {
        const c = consentPorTipo.get(`extra:${extra.id}`);
        return {
          tipo: `extra:${extra.id}`,
          texto: extra.label,
          aceito: Boolean(c?.aceito),
        };
      }
    ),
  ].map((c) => ({
    tenant_id: tenant.id,
    ficha_id: ficha.id,
    tipo: c.tipo,
    texto_aceito: c.texto,
    versao_termo: String(template.versao),
    aceito: c.aceito,
    ip: ipNormalizado,
    user_agent: ua,
    timestamp: assinadoEm.toISOString(),
  }));

  const { error: erroConsent } = await admin.from("consentimentos").insert(registrosConsentimento);
  if (erroConsent) {
    await admin.from("fichas").update({ status: "erro", erro_ultimo: "Falha ao salvar consentimentos" }).eq("id", ficha.id);
    throw new HttpError(500, "Não foi possível registrar os consentimentos.");
  }

  await admin.from("eventos").insert({
    tenant_id: tenant.id,
    ficha_id: ficha.id,
    tipo: "ficha_preenchida",
    metadata: {
      nicho: template.nicho_slug,
      versao: template.versao,
      menor_idade: menorIdade,
      anexos: anexos.length,
      origem: "form_publico",
    },
  });

  try {
    const job: PdfJob = { fichaId: ficha.id, tenantId: tenant.id };
    await env.PDF_QUEUE.send(job);
  } catch (err) {
    await admin.from("eventos").insert({
      tenant_id: tenant.id,
      ficha_id: ficha.id,
      tipo: "pdf_enfileirado_erro",
      metadata: { erro: erroMensagem(err).slice(0, 500) },
    });
  }

  const token = await tokenComplemento(ficha.id, ficha.protocolo, env.CPF_HASH_PEPPER);
  const baseSite = (env.FICHA_URL_TEMPLATE ?? "https://zapfichas.github.io/ficha/{nicho}/write/?t={slug}")
    .split("{nicho}")[0]
    .replace(/\/$/, "");
  const linkComplemento = `${baseSite}/complementar/?f=${encodeURIComponent(
    ficha.id
  )}&p=${encodeURIComponent(ficha.protocolo)}&t=${encodeURIComponent(token)}`;

  return {
    id: ficha.id,
    protocolo: ficha.protocolo,
    status: pendencias.length ? "pendente_documentacao" : ficha.status,
    idempotente: false,
    pendencia_documentacao: pendencias.length > 0,
    link_complemento: pendencias.length ? linkComplemento : undefined,
  };
}

export async function consultarStatusPublico(
  env: Env,
  tenantSlug: string,
  protocolo: string
) {
  const admin = clienteAdmin(env);
  const { data: tenant } = await admin
    .from("tenants")
    .select("id")
    .eq("slug", tenantSlug)
    .maybeSingle();
  if (!tenant) throw new HttpError(404, "Estabelecimento não encontrado.");

  const { data: ficha } = await admin
    .from("fichas")
    .select("protocolo, status, pdf_gerado_em")
    .eq("tenant_id", tenant.id)
    .eq("protocolo", protocolo)
    .maybeSingle();

  if (!ficha) throw new HttpError(404, "Ficha não encontrada.");
  return {
    protocolo: ficha.protocolo,
    status: ficha.status,
    pdf_disponivel: ficha.status === "salva",
    atualizado_em: ficha.pdf_gerado_em,
  };
}

/** Consome um job da fila: envia anexos, gera o PDF e salva no storage. */
export async function processarFichaPdf(env: Env, fichaId: string): Promise<void> {
  const admin = clienteAdmin(env);

  const { data: ficha, error } = await admin
    .from("fichas")
    .select("*")
    .eq("id", fichaId)
    .maybeSingle();

  if (error) throw new Error(`Falha ao carregar ficha: ${error.message}`);
  if (!ficha) {
    console.warn("Ficha não encontrada para o job:", fichaId);
    return;
  }
  if (ficha.status === "salva" && ficha.hash_pdf) return;

  const { data: tenant, error: erroTenant } = await admin
    .from("tenants")
    .select("*")
    .eq("id", ficha.tenant_id)
    .maybeSingle<TenantRow>();
  if (erroTenant || !tenant) throw new Error("Tenant da ficha não encontrado.");

  const { data: templateRow } = await admin
    .from("templates")
    .select("*")
    .eq("id", ficha.template_id)
    .maybeSingle<TemplateRow>();
  if (!templateRow) throw new Error("Template da ficha não encontrado.");

  const { data: formulario } = await admin
    .from("formularios")
    .select("*")
    .eq("id", ficha.formulario_id)
    .maybeSingle();

  const templateCompleto = aplicarCamposCustomizados(
    aplicarCamposAtivos(montarTemplate(templateRow), formulario?.campos_ativos ?? null),
    formulario?.campos_customizados ?? []
  );

  const { data: segredos } = await admin
    .from("tenant_secrets")
    .select("*")
    .eq("tenant_id", tenant.id)
    .maybeSingle();

  const { data: assinaturas } = await admin
    .from("assinaturas")
    .select("papel, imagem_base64, hash_conteudo, ip, user_agent, timestamp")
    .eq("ficha_id", ficha.id)
    .order("papel", { ascending: true });

  const { data: consentimentos } = await admin
    .from("consentimentos")
    .select("tipo, aceito, texto_aceito, timestamp, ip")
    .eq("ficha_id", ficha.id);

  const { data: anexos } = await admin
    .from("ficha_anexos")
    .select("id, tipo, nome_arquivo, mime, tamanho_bytes, conteudo_base64, storage_key, status")
    .eq("ficha_id", ficha.id);

  let dados: Record<string, any>;
  try {
    const decifrado = await descriptografarJson<{ dados: Record<string, any> }>(
      ficha.dados_cifrados,
      env.DATA_ENCRYPTION_KEY
    );
    dados = decifrado.dados;
  } catch (err) {
    throw new Error(`Falha ao descriptografar a ficha: ${erroMensagem(err)}`);
  }

  let refreshToken: string | null = null;
  if (segredos?.drive_refresh_token_enc) {
    try {
      const token = await descriptografarJson<{ token: string }>(
        segredos.drive_refresh_token_enc,
        env.DATA_ENCRYPTION_KEY
      );
      refreshToken = token.token;
    } catch {
      refreshToken = null;
    }
  }

  const storage = obterStorage(env, {
    id: tenant.id,
    storage_mode: tenant.storage_mode,
    drive_refresh_token: refreshToken,
    drive_folder_id: segredos?.drive_folder_id ?? null,
    nome_negocio: tenant.nome_negocio,
  });

  try {
    await enviarAnexosPendentes(
      admin,
      storage,
      tenant,
      ficha,
      anexos ?? []
    );

    const resultado = await gerarPdfFicha({
      tenant: {
        nome_negocio: tenant.nome_negocio,
        branding: tenant.branding,
        email_contato: tenant.email_contato,
        retencao_anos: tenant.retencao_anos,
      },
      template: templateCompleto,
      ficha: {
        protocolo: ficha.protocolo,
        cliente_nome: ficha.cliente_nome,
        cliente_cpf_ultimos4: ficha.cliente_cpf_ultimos4,
        timestamp_assinatura: ficha.timestamp_assinatura,
        ip_assinatura: ficha.ip_assinatura,
        user_agent_assinatura: ficha.user_agent_assinatura,
        hash_conteudo: assinaturas?.[0]?.hash_conteudo ?? null,
      },
      dados,
      consentimentos: (consentimentos ?? []).map((c) => ({
        tipo: c.tipo,
        aceito: c.aceito,
        texto_aceito: c.texto_aceito,
        timestamp: c.timestamp,
        ip: c.ip,
      })),
      assinaturas: (assinaturas ?? []).map((a) => ({
        papel: a.papel,
        imagem_base64: a.imagem_base64,
        timestamp: a.timestamp,
        ip: a.ip,
        user_agent: a.user_agent,
        hash_conteudo: a.hash_conteudo,
      })),
      anexos: (anexos ?? []).map((a) => ({
        tipo: a.tipo,
        nome_arquivo: a.nome_arquivo,
        status: a.status,
      })),
    });

    const mes = mesReferencia(ficha.timestamp_assinatura ?? ficha.criado_em);
    const nomeBase = `${ficha.protocolo}_${nomeArquivoSeguro(ficha.cliente_nome, "cliente")}.pdf`;
    const key = `${tenant.id}/${ficha.id}/${nomeBase}`;

    const enviado = await storage.upload({
      key,
      bytes: resultado.bytes,
      contentType: "application/pdf",
      fileName: nomeBase,
      pastas: [mes],
    });

    const atualizacao: Record<string, unknown> = {
      status: "salva",
      hash_pdf: resultado.hash,
      pdf_gerado_em: new Date().toISOString(),
      tentativas_pdf: (ficha.tentativas_pdf ?? 0) + 1,
      erro_ultimo: null,
    };
    if (storage.modo === "drive") atualizacao.drive_file_id = enviado.externalId ?? null;
    else atualizacao.r2_key = enviado.key;

    const { error: erroUpdate } = await admin
      .from("fichas")
      .update(atualizacao)
      .eq("id", ficha.id);
    if (erroUpdate) throw new Error(`Falha ao atualizar ficha: ${erroUpdate.message}`);

    await admin.from("eventos").insert([
      {
        tenant_id: tenant.id,
        ficha_id: ficha.id,
        tipo: "pdf_gerado",
        metadata: { paginas: resultado.paginas, bytes: resultado.bytes.length },
      },
      {
        tenant_id: tenant.id,
        ficha_id: ficha.id,
        tipo: "pdf_salvo",
        metadata: { storage: storage.modo, hash: resultado.hash },
      },
    ]);
  } catch (err) {
    const mensagem = erroMensagem(err).slice(0, 1000);
    await admin
      .from("fichas")
      .update({
        status: "erro",
        erro_ultimo: mensagem,
        tentativas_pdf: (ficha.tentativas_pdf ?? 0) + 1,
      })
      .eq("id", ficha.id);

    await admin.from("eventos").insert({
      tenant_id: tenant.id,
      ficha_id: ficha.id,
      tipo: "erro",
      metadata: { etapa: "pdf", erro: mensagem },
    });

    throw err;
  }
}

async function enviarAnexosPendentes(
  admin: ReturnType<typeof clienteAdmin>,
  storage: StorageAdapter,
  tenant: TenantRow,
  ficha: Record<string, any>,
  anexos: Array<Record<string, any>>
) {
  const mes = mesReferencia(ficha.timestamp_assinatura ?? ficha.criado_em);
  for (const anexo of anexos) {
    if (anexo.status === "enviado" || !anexo.conteudo_base64) continue;

    try {
      const bytes = base64ParaBytes(String(anexo.conteudo_base64));
      const nome = nomeArquivoSeguro(anexo.nome_arquivo ?? `${anexo.tipo}.bin`);
      const key = `${tenant.id}/${ficha.id}/${anexo.id}_${nome}`;
      const resultado = await storage.upload({
        key,
        bytes,
        contentType: anexo.mime,
        fileName: `${ficha.protocolo}_${nome}`,
        pastas: [mes],
      });

      const atualizacaoAnexo: Record<string, unknown> = {
        status: "enviado",
        storage_key: resultado.key,
        conteudo_base64: null,
        enviado_em: new Date().toISOString(),
        erro: null,
      };
      if (resultado.externalId) atualizacaoAnexo.storage_external_id = resultado.externalId;
      let { error: erroAtualizacao } = await admin
        .from("ficha_anexos")
        .update(atualizacaoAnexo)
        .eq("id", anexo.id);
      if (erroAtualizacao && colunaAusente(erroAtualizacao)) {
        delete atualizacaoAnexo.storage_external_id;
        ({ error: erroAtualizacao } = await admin
          .from("ficha_anexos")
          .update(atualizacaoAnexo)
          .eq("id", anexo.id));
      }
      if (erroAtualizacao) throw new Error(erroAtualizacao.message);
    } catch (err) {
      await admin
        .from("ficha_anexos")
        .update({ status: "erro", erro: erroMensagem(err).slice(0, 500) })
        .eq("id", anexo.id);
      throw err;
    }
  }
}

/** Reenfileira fichas que ficaram sem PDF (cron). */
export async function reprocessarPendentes(env: Env): Promise<number> {
  const admin = clienteAdmin(env);
  const limite = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  const { data } = await admin
    .from("fichas")
    .select("id, tenant_id")
    .in("status", ["preenchida", "erro"])
    .lt("atualizado_em", limite)
    .lt("tentativas_pdf", 5)
    .limit(50);

  let enviados = 0;
  for (const ficha of data ?? []) {
    try {
      await env.PDF_QUEUE.send({ fichaId: ficha.id, tenantId: ficha.tenant_id });
      enviados++;
    } catch (err) {
      console.error("Falha ao reenfileirar ficha", ficha.id, err);
    }
  }
  return enviados;
}

/** Executa o expurgo por retenção e devolve quantas fichas foram removidas. */
export async function expurgarVencidas(env: Env): Promise<number> {
  const admin = clienteAdmin(env);
  const { data, error } = await admin.rpc("expurgar_fichas_vencidas");
  if (error) {
    console.error("Falha no expurgo:", error.message);
    return 0;
  }
  return Number(data ?? 0);
}
