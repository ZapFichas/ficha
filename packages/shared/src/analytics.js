/**
 * Helpers puros de analytics usados pelo Worker e pelo painel.
 * Sem dependências: fáceis de testar e rodar no browser.
 */

export function taxa(parte, total) {
  const t = Number(total || 0);
  if (!t) return 0;
  return Math.round((Number(parte || 0) / t) * 1000) / 10;
}

export function variacao(atual, anterior) {
  const a = Number(atual || 0);
  const b = Number(anterior || 0);
  if (!b) return a ? 100 : 0;
  return Math.round(((a - b) / b) * 1000) / 10;
}

export function chaveMes(data) {
  const d = data instanceof Date ? data : new Date(data);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** Série mensal contínua (inclui meses sem movimento). */
export function serieMensal(itens, { meses = 6, campo = "criado_em", hoje = new Date() } = {}) {
  const base = [];
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
    base.push({ mes: chaveMes(d), rotulo: rotuloMes(d), total: 0 });
  }
  const mapa = new Map(base.map((b) => [b.mes, b]));
  for (const item of itens ?? []) {
    const chave = chaveMes(item?.[campo]);
    const alvo = mapa.get(chave);
    if (alvo) alvo.total += 1;
  }
  return base;
}

export function rotuloMes(data) {
  const d = data instanceof Date ? data : new Date(data);
  return d.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");
}

/** Agrupa e ordena os valores mais frequentes de um campo do resumo. */
export function topValores(itens, campo, limite = 5) {
  const contagem = new Map();
  for (const item of itens ?? []) {
    const valor = item?.[campo] ?? item?.dados_json?.[campo];
    const chave = String(valor ?? "").trim();
    if (!chave) continue;
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
  }
  const total = [...contagem.values()].reduce((a, b) => a + b, 0);
  return [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limite)
    .map(([valor, quantidade]) => ({
      valor,
      quantidade,
      percentual: taxa(quantidade, total),
    }));
}

/** Funil simples de saúde operacional. */
export function funilOperacional({ total = 0, processando = 0, erro = 0, salvas = 0 } = {}) {
  return [
    { etapa: "Recebidas", total },
    { etapa: "PDF gerado", total: salvas },
    { etapa: "Com erro", total: erro },
    { etapa: "Processando", total: processando },
  ].map((e) => ({ ...e, percentual: taxa(e.total, total) }));
}

/** Churn de tenants com base em status e data do último acesso/ficha. */
export function churn({ cancelados = 0, base = 0 } = {}) {
  return taxa(cancelados, base);
}
