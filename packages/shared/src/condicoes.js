/** Avaliação de condicionais de exibição (seções e campos). */

export function valorVazio(valor) {
  if (valor === null || valor === undefined) return true;
  if (typeof valor === "string") return valor.trim() === "";
  if (Array.isArray(valor)) return valor.length === 0;
  if (typeof valor === "object") {
    if ("base64" in valor) return !valor.base64;
    return Object.keys(valor).length === 0;
  }
  return false;
}

export function avaliarCondicao(cond, ctx = {}) {
  if (!cond) return true;

  if (cond.tipo === "menor_idade") return Boolean(ctx.menorIdade);
  if (cond.tipo === "maior_idade") return !ctx.menorIdade;
  if (cond.tipo === "parq_positivo") return Boolean(ctx.parqPositivo);

  if (cond.campo) {
    const valor = ctx.dados?.[cond.campo];
    switch (cond.operador) {
      case "igual":
        return String(valor ?? "") === String(cond.valor ?? "");
      case "diferente":
        return String(valor ?? "") !== String(cond.valor ?? "");
      case "contem":
        return Array.isArray(valor)
          ? valor.includes(cond.valor)
          : String(valor ?? "").includes(String(cond.valor ?? ""));
      case "nao_contem":
        return Array.isArray(valor)
          ? !valor.includes(cond.valor)
          : !String(valor ?? "").includes(String(cond.valor ?? ""));
      case "verdadeiro":
        return Boolean(valor);
      case "preenchido":
        return !valorVazio(valor);
      default:
        return true;
    }
  }

  return true;
}

/**
 * PAR-Q positivo = qualquer campo marcado com `parq: true` respondido "Sim".
 * Usado para exigir liberação médica no template de fitness.
 */
export function calcularParqPositivo(template, dados = {}) {
  const secoes = template?.secoes ?? template?.campos_json?.secoes ?? [];
  for (const secao of secoes) {
    const campos = secao.campos ?? [];
    for (const campo of campos) {
      if (campo.parq && dados[campo.id] === "Sim") return true;
    }
  }
  return false;
}
