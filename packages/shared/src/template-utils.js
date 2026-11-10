/** Helpers de template usados pela ficha, API e painel. */

export function obterSecoes(template) {
  return template?.secoes ?? template?.campos_json?.secoes ?? [];
}

export function obterTermo(template) {
  return template?.termo_texto ?? template?.campos_json?.termo_texto ?? "";
}

export function obterConsentimentoLgpd(template) {
  return (
    template?.consentimento_lgpd ??
    template?.campos_json?.consentimento_lgpd ??
    ""
  );
}

/** Substitui placeholders do termo com dados do tenant. */
export function renderizarTexto(texto, variaveis = {}) {
  if (!texto) return "";
  const valores = {
    nome_negocio: variaveis.nome_negocio ?? "estabelecimento",
    retencao_anos: variaveis.retencao_anos ?? 5,
    email_contato: variaveis.email_contato ?? "contato do estabelecimento",
    nicho: variaveis.nicho ?? "procedimento",
    ...variaveis,
  };
  return String(texto).replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (_, chave) => {
    const valor = valores[chave];
    return valor === undefined || valor === null ? "" : String(valor);
  });
}

/** Lista de passos da ficha (seções + termo + revisão + assinatura). */
export function passosDaFicha(template, ctx = {}) {
  const secoes = (obterSecoes(template) ?? []).filter((secao) => {
    if (!secao.condicional) return true;
    if (secao.condicional.tipo === "menor_idade") return Boolean(ctx.menorIdade);
    if (secao.condicional.tipo === "maior_idade") return !ctx.menorIdade;
    return true;
  });

  return [
    ...secoes.map((secao, index) => ({
      tipo: "secao",
      id: secao.id,
      titulo: secao.titulo,
      rotulo: secao.rotulo_curto ?? `Etapa ${index + 1}`,
      secao,
    })),
    { tipo: "termo", id: "__termo", titulo: "Termo de consentimento", rotulo: "Termo" },
    { tipo: "revisao", id: "__revisao", titulo: "Revisão dos dados", rotulo: "Revisão" },
    { tipo: "assinatura", id: "__assinatura", titulo: "Assinatura", rotulo: "Assinar" },
  ];
}
