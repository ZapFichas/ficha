import { h } from "./ui.js";

export function kpi(titulo, valor, { detalhe = "", tom = "", destaque = false } = {}) {
  return h(
    "article",
    { class: `kpi ${tom}${destaque ? " destaque" : ""}` },
    h("span", { class: "kpi-titulo" }, titulo),
    h("strong", { class: "kpi-valor" }, String(valor ?? 0)),
    detalhe ? h("small", { class: "kpi-detalhe" }, detalhe) : null
  );
}

export function barras(itens, { rotulo = "valor", valor = "quantidade", sufixo = "" } = {}) {
  const lista = (itens ?? []).filter((i) => Number(i?.[valor] ?? 0) > 0);
  if (!lista.length) return vazio("Sem dados no período.");
  const max = Math.max(...lista.map((i) => Number(i[valor]) || 0), 1);
  const box = h("div", { class: "grafico-barras" });
  for (const item of lista) {
    const n = Number(item[valor]) || 0;
    const pct = Math.round((n / max) * 100);
    box.append(
      h(
        "div",
        { class: "barra-linha" },
        h("span", { class: "barra-rotulo", title: String(item[rotulo] ?? "") }, String(item[rotulo] ?? "—")),
        h(
          "span",
          { class: "barra-trilho" },
          h("span", { class: "barra-preenchimento", style: `width:${Math.max(pct, 4)}%` })
        ),
        h("span", { class: "barra-valor" }, `${n}${sufixo}`)
      )
    );
  }
  return box;
}

export function serieVertical(itens, { rotulo = "rotulo", valor = "total" } = {}) {
  const lista = itens ?? [];
  if (!lista.length) return vazio("Sem dados no período.");
  const max = Math.max(...lista.map((i) => Number(i[valor]) || 0), 1);
  const box = h("div", { class: "grafico-serie" });
  for (const item of lista) {
    const n = Number(item[valor]) || 0;
    const altura = Math.max(4, Math.round((n / max) * 100));
    box.append(
      h(
        "div",
        { class: "serie-coluna", title: `${item[rotulo]}: ${n}` },
        h("span", { class: "serie-valor" }, n ? String(n) : ""),
        h("span", { class: "serie-barra", style: `height:${altura}%` }),
        h("span", { class: "serie-rotulo" }, String(item[rotulo] ?? ""))
      )
    );
  }
  return box;
}

export function anel(itens, { rotulo = "valor", valor = "quantidade" } = {}) {
  const total = (itens ?? []).reduce((soma, i) => soma + (Number(i?.[valor]) || 0), 0);
  if (!total) return vazio("Sem dados no período.");
  const cores = ["#4f7963", "#8a5a6b", "#2f6f73", "#8a6a2f", "#4f5f8a", "#7a4f8a"];
  let acumulado = 0;
  const stops = [];
  const legenda = h("ul", { class: "anel-legenda" });
  (itens ?? []).forEach((item, indice) => {
    const n = Number(item[valor]) || 0;
    if (!n) return;
    const inicio = acumulado;
    acumulado += (n / total) * 100;
    stops.push(`${cores[indice % cores.length]} ${inicio}% ${acumulado}%`);
    legenda.append(
      h(
        "li",
        {},
        h("span", { class: "anel-cor", style: `background:${cores[indice % cores.length]}` }),
        h("span", {}, String(item[rotulo] ?? "—")),
        h("strong", {}, String(n))
      )
    );
  });
  return h(
    "div",
    { class: "anel-wrap" },
    h("div", { class: "anel", style: `background: conic-gradient(${stops.join(",")})` }),
    legenda
  );
}

export function vazio(mensagem) {
  return h("p", { class: "grafico-vazio" }, mensagem);
}

export function cardGrafico(titulo, descricao, conteudo, extra = null) {
  return h(
    "section",
    { class: "painel-card grafico-card" },
    h(
      "div",
      { class: "card-topo" },
      h("div", {}, h("h3", {}, titulo), descricao ? h("p", { class: "card-desc" }, descricao) : null),
      extra
    ),
    conteudo
  );
}
