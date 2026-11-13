import { base64ParaBytes, normalizarPermissoes, somenteDigitos } from "@fichapro/shared";
import type { Env } from "../env.js";
import {
  normalizarIp,
  tokenComplementoValido,
  hashCPF,
} from "../lib/crypto.js";
import { clienteAdmin } from "../lib/supabase.js";
import { HttpError } from "./fichas.js";

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

async function carregarFichaPorToken(
  env: Env,
  fichaId: string,
  protocolo: string,
  token: string
) {
  const valido = await tokenComplementoValido(fichaId, protocolo, token, env.CPF_HASH_PEPPER);
  if (!valido) throw new HttpError(403, "Link inválido ou expirado.");

  const admin = clienteAdmin(env);
  const { data: ficha } = await admin
    .from("fichas")
    .select("*")
    .eq("id", fichaId)
    .eq("protocolo", protocolo)
    .maybeSingle();
  if (!ficha) throw new HttpError(404, "Ficha não encontrada.");

  const { data: tenant } = await admin
    .from("tenants")
    .select("*")
    .eq("id", ficha.tenant_id)
    .maybeSingle();
  if (!tenant) throw new HttpError(404, "Estabelecimento não encontrado.");
  if (tenant.status !== "ativo" && tenant.status !== "trial") {
    throw new HttpError(403, "Estabelecimento com acesso suspenso.");
  }
  return { ficha, tenant, admin };
}

/** Dados seguros para a página de complemento (sem CPF e sem respostas). */
export async function obterComplementoPublico(
  env: Env,
  fichaId: string,
  protocolo: string,
  token: string
) {
  const { ficha, tenant } = await carregarFichaPorToken(env, fichaId, protocolo, token);
  const pendencias = Array.isArray(ficha.pendencias) ? ficha.pendencias : [];
  return {
    ficha: {
      protocolo: ficha.protocolo,
      cliente_nome: ficha.cliente_nome,
      menor_idade: ficha.menor_idade,
      status: ficha.status,
    },
    tenant: {
      nome_negocio: tenant.nome_negocio,
      whatsapp: tenant.whatsapp,
      email_contato: tenant.email_contato,
    },
    pendencias,
    aceita_documento: normalizarPermissoes(tenant.permissoes).permite_pendencia_responsavel,
  };
}

export async function enviarDocumentoComplemento(
  env: Env,
  {
    fichaId,
    protocolo,
    token,
    nomeArquivo,
    mime,
    base64,
    ip,
    userAgent,
  }: {
    fichaId: string;
    protocolo: string;
    token: string;
    nomeArquivo: string;
    mime: string;
    base64: string;
    ip?: string | null;
    userAgent?: string | null;
  }
) {
  const { ficha, tenant, admin } = await carregarFichaPorToken(
    env,
    fichaId,
    protocolo,
    token
  );
  const permissoes = normalizarPermissoes(tenant.permissoes);
  if (!permissoes.permite_pendencia_responsavel) {
    throw new HttpError(
      403,
      "Este estabelecimento não aceita documentação por este canal. Fale diretamente com ele."
    );
  }

  const aceitos = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
  if (!aceitos.includes(mime)) {
    throw new HttpError(422, "Envie uma imagem (JPG/PNG/WEBP) ou PDF.");
  }
  const limpo = String(base64).replace(/^data:[^;]+;base64,/, "");
  const tamanho = Math.floor((limpo.length * 3) / 4);
  if (tamanho > 12 * 1024 * 1024) {
    throw new HttpError(413, "O arquivo deve ter no máximo 12 MB.");
  }
  try {
    if (base64ParaBytes(limpo).length < 200) throw new Error("vazio");
  } catch {
    throw new HttpError(422, "Arquivo inválido.");
  }

  const { error: erroAnexo } = await admin.from("ficha_anexos").insert({
    tenant_id: tenant.id,
    ficha_id: ficha.id,
    tipo: "documentacao_responsavel",
    nome_arquivo: String(nomeArquivo || "documento").slice(0, 255),
    mime,
    tamanho_bytes: tamanho,
    conteudo_base64: limpo,
    status: "pendente",
  });
  if (erroAnexo) {
    throw new HttpError(500, "Não foi possível receber o documento. Tente novamente.");
  }

  const pendencias = Array.isArray(ficha.pendencias) ? [...ficha.pendencias] : [];
  const indice = pendencias.findIndex((p: any) => p?.tipo === "documentacao_responsavel");
  if (indice >= 0) {
    pendencias[indice] = {
      ...pendencias[indice],
      status: "documento_recebido",
      recebido_em: new Date().toISOString(),
    };
  } else {
    pendencias.push({
      tipo: "documentacao_responsavel",
      descricao: "Documento do responsável recebido pelo link de complemento.",
      status: "documento_recebido",
      recebido_em: new Date().toISOString(),
    });
  }

  const { error: erroPendencia } = await admin
    .from("fichas")
    .update({ pendencias })
    .eq("id", ficha.id);

  await admin.from("eventos").insert({
    tenant_id: tenant.id,
    ficha_id: ficha.id,
    tipo: "documento_complementar_recebido",
    metadata: {
      tipo: "documentacao_responsavel",
      arquivo: String(nomeArquivo || "documento").slice(0, 200),
      ip: normalizarIp(ip),
      user_agent: String(userAgent ?? "").slice(0, 300),
      pendencias_atualizadas: !erroPendencia,
    },
  });

  return {
    ok: true,
    mensagem: "Documento recebido. O estabelecimento já pode consultar.",
    pendencia_atualizada: !erroPendencia,
  };
}

/** Solicitação de alteração de dados feita pelo cliente (com aprovação do dono). */
export async function solicitarAlteracaoPublica(
  env: Env,
  {
    tenantSlug,
    protocolo,
    cpf,
    cpfUltimos4,
    justificativa,
    campos,
    ip,
  }: {
    tenantSlug: string;
    protocolo: string;
    cpf?: string;
    cpfUltimos4?: string;
    justificativa: string;
    campos?: string[];
    ip?: string | null;
  }
) {
  const admin = clienteAdmin(env);
  const { data: tenant } = await admin
    .from("tenants")
    .select("*")
    .eq("slug", tenantSlug)
    .maybeSingle();
  if (!tenant) throw new HttpError(404, "Estabelecimento não encontrado.");
  const permissoes = normalizarPermissoes(tenant.permissoes);
  if (!permissoes.permite_alteracao_dados) {
    throw new HttpError(403, "Este estabelecimento não aceita solicitações de alteração.");
  }

  const { data: ficha } = await admin
    .from("fichas")
    .select("id, tenant_id, protocolo, cliente_cpf_hash, cliente_cpf_ultimos4, status")
    .eq("tenant_id", tenant.id)
    .eq("protocolo", protocolo)
    .maybeSingle();
  if (!ficha) throw new HttpError(404, "Ficha não encontrada.");
  const digitosCpf = somenteDigitos(cpf ?? "");
  if (digitosCpf.length === 11) {
    const hash = await hashCPF(digitosCpf, env.CPF_HASH_PEPPER);
    if (hash !== ficha.cliente_cpf_hash) {
      throw new HttpError(403, "CPF não confere com o titular da ficha.");
    }
  } else if (
    somenteDigitos(cpfUltimos4 ?? "").slice(-4) !== String(ficha.cliente_cpf_ultimos4 ?? "")
  ) {
    throw new HttpError(403, "Confira os 4 últimos dígitos do CPF do titular.");
  }

  const { data, error } = await admin
    .from("ficha_alteracoes")
    .insert({
      tenant_id: tenant.id,
      ficha_id: ficha.id,
      status: "pendente",
      justificativa: justificativa.slice(0, 500),
      campos: (campos ?? []).slice(0, 30),
      origem: "cliente",
      ip: normalizarIp(ip),
    })
    .select("id, status, criado_em")
    .maybeSingle();

  if (error) {
    if (tabelaAusente(error)) {
      throw new HttpError(
        409,
        "Solicitações de alteração serão liberadas em breve. Fale diretamente com o estabelecimento."
      );
    }
    throw new HttpError(500, "Não foi possível registrar a solicitação.");
  }

  await admin.from("eventos").insert({
    tenant_id: tenant.id,
    ficha_id: ficha.id,
    tipo: "alteracao_solicitada",
    metadata: { justificativa: justificativa.slice(0, 300), campos: campos ?? [] },
  });

  return {
    ok: true,
    solicitacao: data,
    mensagem: "Solicitação enviada. O estabelecimento vai analisar e responder.",
  };
}
