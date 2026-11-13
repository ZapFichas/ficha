/**
 * Campos personalizados das fichas.
 *
 * O template continua sendo a fonte de verdade do nicho. O tenant pode
 * acrescentar campos próprios sem alterar o template global. Os campos são
 * armazenados em `formularios.campos_customizados` e mesclados em tempo de
 * leitura na ficha, no painel, na validação e no servidor.
 */

export const TIPOS_CAMPO_CUSTOMIZADO = [
  "text",
  "textarea",
  "date",
  "cpf",
  "tel",
  "email",
  "number",
  "sim_nao",
  "select",
  "checkbox",
];

export const LIMITE_CAMPOS_CUSTOMIZADOS = 40;
export const SECAO_CUSTOMIZADA_ID = "informacoes_adicionais";
const TITULO_SECAO_CUSTOMIZADA = "Informações adicionais";

function normalizarTexto(valor, max = 120) {
  return String(valor ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

export function slugCampo(texto, max = 48) {
  return String(texto ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, max);
}

export function idCampoCustomizado(texto, existentes = new Set()) {
  const base = `custom_${slugCampo(texto) || "campo"}`;
  let id = base;
  let n = 2;
  while (existentes.has(id)) {
    id = `${base}_${n}`;
    n += 1;
  }
  return id;
}

/**
 * Normaliza um campo vindo do painel ou de um payload antigo.
 * `existentes` evita colisão com ids do template e com outros customizados.
 */
export function normalizarCampoCustomizado(entrada = {}, existentes = new Set()) {
  const label = normalizarTexto(entrada.label ?? entrada.titulo, 80) || "Campo personalizado";
  const tipo = TIPOS_CAMPO_CUSTOMIZADO.includes(entrada.tipo) ? entrada.tipo : "text";
  const existentesSet = existentes instanceof Set ? existentes : new Set(existentes);
  const id =
    entrada.id && /^custom_[a-z0-9_]{1,60}$/.test(entrada.id) && !existentesSet.has(entrada.id)
      ? entrada.id
      : idCampoCustomizado(label, existentesSet);
  existentesSet.add(id);

  const opcoes = Array.isArray(entrada.opcoes)
    ? entrada.opcoes
        .map((o) => normalizarTexto(o, 60))
        .filter(Boolean)
        .slice(0, 30)
    : [];

  const campo = {
    id,
    label,
    tipo,
    obrigatorio: Boolean(entrada.obrigatorio),
    customizado: true,
  };

  if (tipo === "select" || tipo === "checkbox") {
    campo.opcoes = opcoes.length ? opcoes : ["Sim", "Não"];
  }
  if (entrada.placeholder) campo.placeholder = normalizarTexto(entrada.placeholder, 120);
  if (entrada.hint) campo.hint = normalizarTexto(entrada.hint, 180);
  if (tipo === "textarea" && entrada.max) {
    campo.max = Math.max(20, Math.min(Number(entrada.max) || 600, 2000));
  }
  if (tipo === "number") {
    if (entrada.min !== undefined && Number.isFinite(Number(entrada.min))) {
      campo.min = Number(entrada.min);
    }
    if (entrada.max !== undefined && Number.isFinite(Number(entrada.max))) {
      campo.max = Number(entrada.max);
    }
  }
  if (entrada.secao_id && /^[a-z0-9_]{1,60}$/.test(entrada.secao_id)) {
    campo.secao_id = entrada.secao_id;
  }
  if (entrada.secao_titulo) {
    campo.secao_titulo = normalizarTexto(entrada.secao_titulo, 80);
  }
  return campo;
}

/**
 * Normaliza uma lista de campos customizados. Aceita também o formato
 * `{ secoes: [{ id, titulo, campos: [...] }] }` para compatibilidade futura.
 */
export function normalizarCamposCustomizados(entrada, existentes = new Set()) {
  const lista = Array.isArray(entrada)
    ? entrada
    : Array.isArray(entrada?.campos)
      ? entrada.campos
      : Array.isArray(entrada?.secoes)
        ? entrada.secoes.flatMap((s) =>
            (s.campos ?? []).map((c) => ({ ...c, secao_id: c.secao_id ?? s.id, secao_titulo: c.secao_titulo ?? s.titulo }))
          )
        : [];

  const ids = existentes instanceof Set ? new Set(existentes) : new Set(existentes);
  return lista
    .slice(0, LIMITE_CAMPOS_CUSTOMIZADOS)
    .map((c) => normalizarCampoCustomizado(c, ids))
    .filter((c) => c.label && c.id);
}

/**
 * Mescla os campos customizados no template. Não altera o objeto original.
 * - `secao_id` existente: anexa ao final daquela seção.
 * - caso contrário: cria/reaproveita a seção "Informações adicionais".
 */
export function aplicarCamposCustomizados(template, camposCustomizados) {
  if (!template) return template;
  const idsExistentes = new Set(
    (template.secoes ?? []).flatMap((s) => (s.campos ?? []).map((c) => c.id))
  );
  const campos = normalizarCamposCustomizados(camposCustomizados ?? [], idsExistentes);
  if (!campos.length) return template;

  const secoes = (template.secoes ?? []).map((secao) => ({
    ...secao,
    campos: [...(secao.campos ?? [])],
  }));

  const extras = [];
  for (const campo of campos) {
    const alvo = campo.secao_id && secoes.find((s) => s.id === campo.secao_id);
    if (alvo) {
      const { secao_id, secao_titulo, ...limpo } = campo;
      alvo.campos.push(limpo);
    } else {
      const { secao_id, secao_titulo, ...limpo } = campo;
      extras.push({ ...limpo, _titulo: secao_titulo });
    }
  }

  if (extras.length) {
    let secao = secoes.find((s) => s.id === SECAO_CUSTOMIZADA_ID);
    if (!secao) {
      secao = {
        id: SECAO_CUSTOMIZADA_ID,
        titulo: TITULO_SECAO_CUSTOMIZADA,
        rotulo_curto: "Extras",
        descricao: "Informações específicas solicitadas pelo estabelecimento.",
        campos: [],
      };
      secoes.push(secao);
    }
    for (const campo of extras) {
      const { _titulo, ...limpo } = campo;
      secao.campos.push(limpo);
    }
  }

  return { ...template, secoes };
}

/** Lista campos customizados já mesclados (para exibir no painel). */
export function listarCamposCustomizados(template) {
  return (template?.secoes ?? [])
    .flatMap((s) => (s.campos ?? []).map((c) => ({ ...c, secao_id: s.id, secao_titulo: s.titulo })))
    .filter((c) => c.customizado);
}
