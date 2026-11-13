import { comparativoPlanos, PLANOS, SUPORTE_WHATSAPP } from "@fichapro/shared";
import { formatarMoeda, h } from "./ui.js";

export function renderPlanos(container, { state, navegar } = {}) {
  const atual = state?.plano?.id ?? state?.tenant?.plano ?? "solo";
  const planoAtual = PLANOS[atual] ?? PLANOS.solo;
  const comparativo = state?.plano?.comparativo ?? comparativoPlanos();
  const limites = state?.plano?.limites ?? planoAtual.limites;

  const topo = h(
    "div",
    { class: "pagina-topo" },
    h(
      "div",
      {},
      h("p", { class: "kicker" }, "Assinatura"),
      h("h1", {}, "Planos e limites"),
      h(
        "p",
        { class: "pagina-sub" },
        "Cada plano tem um ponto de corte claro. O upgrade aparece quando você precisa de mais equipe, campos ou dados."
      )
    ),
    h(
      "a",
      {
        class: "btn-painel btn-primario-painel",
        href: SUPORTE_WHATSAPP.url(`Olá! Quero fazer upgrade do plano ${planoAtual.nome} do FichaPro.`),
        target: "_blank",
        rel: "noopener noreferrer",
      },
      "Solicitar upgrade"
    )
  );

  const atualCard = h(
    "section",
    { class: "painel-card plano-atual" },
    h(
      "div",
      {},
      h("span", { class: "kicker" }, "Plano atual"),
      h("h2", {}, planoAtual.nome),
      h("p", { class: "card-desc" }, planoAtual.resumo),
      h(
        "div",
        { class: "limites-grid" },
        limiteItem("Profissionais", limites.profissionais),
        limiteItem("Fichas/mês", limites.fichas_mes),
        limiteItem("Campos personalizados", limites.campos_customizados),
        limiteItem("Dashboard de dados", limites.analytics ? "Incluído" : "Não incluído")
      )
    ),
    h(
      "div",
      { class: "plano-preco" },
      h("strong", {}, formatarMoeda(planoAtual.preco_mensal)),
      h("small", {}, "por mês")
    )
  );

  const gatilhos = h(
    "section",
    { class: "painel-card" },
    h("h3", {}, "Quando faz sentido subir de plano"),
    h(
      "p",
      { class: "card-desc" },
      "Estes são os gatilhos reais de upgrade. Nada de bloquear o básico: o limite aparece só quando o negócio cresce."
    ),
    h(
      "div",
      { class: "gatilhos-grid" },
      ...gatilhosDoPlano(atual).map((g) =>
        h(
          "div",
          { class: "gatilho-card" },
          h("strong", {}, g.titulo),
          h("span", {}, g.descricao),
          h("small", {}, `Vai para o ${g.plano}`)
        )
      )
    )
  );

  const grid = h("div", { class: "planos-grid-painel" });
  for (const plano of comparativo) {
    const destaque = plano.id === "estudio";
    grid.append(
      h(
        "article",
        { class: `plano-card-painel${destaque ? " destaque" : ""}${plano.id === atual ? " atual" : ""}` },
        h(
          "div",
          { class: "plano-card-topo" },
          h("h3", {}, plano.nome),
          destaque ? h("span", { class: "selo-plano" }, "Mais escolhido") : null,
          plano.id === atual ? h("span", { class: "selo-plano atual" }, "Seu plano") : null
        ),
        h("p", { class: "card-desc" }, plano.resumo),
        h("div", { class: "plano-preco" }, h("strong", {}, formatarMoeda(plano.preco_mensal)), h("small", {}, "/mês")),
        h(
          "ul",
          { class: "plano-recursos" },
          ...plano.recursos.map((r) =>
            h("li", {}, h("span", {}, r.rotulo), h("strong", {}, String(r.valor)))
          )
        ),
        plano.id === atual
          ? h("span", { class: "btn-painel btn-secundario-painel btn-pequeno bloqueado" }, "Plano atual")
          : h(
              "a",
              {
                class: "btn-painel btn-primario-painel",
                href: SUPORTE_WHATSAPP.url(`Olá! Quero o plano ${plano.nome} do FichaPro.`),
                target: "_blank",
                rel: "noopener noreferrer",
              },
              "Quero este plano"
            )
      )
    );
  }

  container.append(
    topo,
    atualCard,
    gatilhos,
    h(
      "section",
      { class: "painel-card" },
      h("h3", {}, "Comparativo de planos"),
      h("p", { class: "card-desc" }, "Valores de referência. A cobrança é combinada com o suporte durante a validação."),
      grid
    ),
    h(
      "p",
      { class: "muted" },
      "Precisa de algo específico (API, domínio próprio, retenção estendida)? Fale com o suporte para desenhar o plano ideal."
    )
  );

  return container;
}

function limiteItem(rotulo, valor) {
  return h(
    "div",
    { class: "limite-item" },
    h("span", {}, rotulo),
    h("strong", {}, valor === null || valor === undefined ? "Ilimitado" : String(valor))
  );
}

function gatilhosDoPlano(plano) {
  if (plano === "solo") {
    return [
      { titulo: "Contratou o 2º profissional", descricao: "O Solo inclui 1 profissional responsável.", plano: "Estúdio" },
      { titulo: "Precisa de gráficos", descricao: "O dashboard de dados entra no Estúdio.", plano: "Estúdio" },
      { titulo: "Passou de 3 campos extras", descricao: "Campos personalizados até 15 no Estúdio.", plano: "Estúdio" },
      { titulo: "Precisa de API ou domínio", descricao: "Integrações e marca própria são exclusivas do Pro.", plano: "Pro" },
    ];
  }
  if (plano === "estudio") {
    return [
      { titulo: "Chegou ao 6º profissional", descricao: "O Estúdio inclui até 5 profissionais.", plano: "Pro" },
      { titulo: "Passou de 15 campos extras", descricao: "No Pro os campos são ilimitados.", plano: "Pro" },
      { titulo: "Precisa de integrações", descricao: "API e domínio próprio entram no Pro.", plano: "Pro" },
      { titulo: "Quer relatórios avançados", descricao: "Comparativos e exportações no Pro.", plano: "Pro" },
    ];
  }
  return [
    { titulo: "Seu plano é o topo", descricao: "Fale com o suporte para necessidades específicas de operação.", plano: "Suporte" },
  ];
}
