import { produtosPara, SUPORTE_WHATSAPP } from "@fichapro/shared";
import { api } from "./api.js";
import { anel, barras, cardGrafico, kpi, serieVertical } from "./charts.js";
import { formatarDataHora, h } from "./ui.js";

export function renderInsights(container, { state, navegar } = {}) {
  let dias = "180";

  const topo = h(
    "div",
    { class: "pagina-topo" },
    h(
      "div",
      {},
      h("p", { class: "kicker" }, "Dados do seu negócio"),
      h("h1", {}, "Insights"),
      h(
        "p",
        { class: "pagina-sub" },
        "Entenda o volume de atendimentos, os profissionais mais acionados e a jornada dos clientes."
      )
    ),
    h(
      "div",
      { class: "acoes-painel" },
      periodoSelect(),
      h(
        "button",
        { class: "btn-painel btn-secundario-painel", on: { click: () => carregar() } },
        "Atualizar"
      )
    )
  );

  const corpo = h("div", { class: "insights-corpo" }, h("p", { class: "muted" }, "Carregando dados…"));
  container.append(topo, corpo);

  function periodoSelect() {
    const select = h(
      "select",
      { class: "entrada-painel", "aria-label": "Período" },
      h("option", { value: "30" }, "Últimos 30 dias"),
      h("option", { value: "90" }, "Últimos 90 dias"),
      h("option", { value: "180", selected: true }, "Últimos 6 meses")
    );
    select.addEventListener("change", () => {
      dias = select.value;
      carregar();
    });
    return select;
  }

  async function carregar() {
    corpo.replaceChildren(h("p", { class: "muted" }, "Carregando dados…"));
    try {
      const dados = await api(`/api/panel/analytics?dias=${dias}`);
      corpo.replaceChildren(...montar(dados));
    } catch (err) {
      corpo.replaceChildren(
        h(
          "section",
          { class: "painel-card" },
          h("h3", {}, "Não foi possível carregar os insights"),
          h("p", { class: "card-desc" }, err.message ?? "Tente novamente em instantes."),
          h(
            "button",
            { class: "btn-painel btn-secundario-painel btn-pequeno", on: { click: () => carregar() } },
            "Tentar novamente"
          )
        )
      );
    }
  }

  function montar(dados) {
    const resumo = dados.resumo ?? {};
    const elementos = [];

    if (!dados.disponivel) {
      elementos.push(
        h(
          "section",
          { class: "painel-card upgrade-card" },
          h("span", { class: "upgrade-selo" }, "Recurso do plano Estúdio"),
          h("h3", {}, "Seus dados já estão aqui. Falta liberar os gráficos."),
          h("p", { class: "card-desc" }, dados.motivo ?? "Faça upgrade para ver relatórios."),
          h(
            "div",
            { class: "acoes-painel" },
            h(
              "button",
              {
                class: "btn-painel btn-primario-painel",
                on: { click: () => (navegar ? navegar("planos") : null) },
              },
              "Ver planos e upgrade"
            ),
            h(
              "a",
              {
                class: "btn-painel btn-secundario-painel",
                href: SUPORTE_WHATSAPP.url("Olá! Quero saber sobre o upgrade do FichaPro."),
                target: "_blank",
                rel: "noopener noreferrer",
              },
              "Falar com o suporte"
            )
          )
        )
      );
    }

    elementos.push(
      h(
        "div",
        { class: "kpi-grid" },
        kpi("Fichas no período", resumo.total ?? 0, {
          detalhe: `${resumo.mes_atual ?? 0} neste mês`,
        }),
        kpi("Concluídas", resumo.salvas ?? 0, {
          detalhe: `${resumo.taxa_conclusao ?? 0}% de conclusão`,
          tom: "sucesso",
        }),
        kpi("Clientes distintos", dados.clientes?.distintos ?? "—", {
          detalhe: dados.clientes
            ? `${dados.clientes.taxa_recorrencia ?? 0}% voltaram`
            : "Disponível no Estúdio",
        }),
        kpi("Menores de idade", resumo.menores ?? 0, {
          detalhe: "Exigem responsável",
          tom: "alerta",
        })
      )
    );

    if (dados.disponivel) {
      elementos.push(
        h(
          "div",
          { class: "graficos-grid" },
          cardGrafico("Fichas por mês", "Volume de fichas recebidas.", serieVertical(dados.serie ?? [])),
          cardGrafico("Profissionais mais acionados", "Quem mais atende pela ficha.", barras(dados.profissionais ?? [])),
          cardGrafico("Procedimentos", "O que os clientes mais procuram.", barras(dados.procedimentos ?? [])),
          cardGrafico(
            "Dias da semana",
            "Quando a demanda se concentra.",
            barras(
              (dados.dias_semana ?? []).map((d) => ({ ...d, quantidade: d.total })),
              { rotulo: "dia", valor: "quantidade" }
            )
          ),
          cardGrafico("Funil operacional", "Da recepção até o PDF concluído.", barras(dados.funil ?? [], { rotulo: "etapa", valor: "total" })),
          cardGrafico("Distribuição por status", "Situação atual das fichas.", anel(dados.funil ?? [], { rotulo: "etapa", valor: "total" }))
        )
      );
    } else {
      elementos.push(
        h(
          "div",
          { class: "graficos-grid" },
          cardGrafico("Fichas por mês", "Prévia disponível em todos os planos.", serieVertical(dados.serie ?? []))
        )
      );
    }

    const produtos = produtosPara(state?.tenant?.nicho_slug ?? "", 3);
    elementos.push(
      h(
        "section",
        { class: "painel-card vitrine-painel" },
        h("h3", {}, "Conheça também"),
        h(
          "p",
          { class: "card-desc" },
          "Soluções FichaPro para outros tipos de atendimento. Indique para um colega e ajude a reduzir o papel."
        ),
        h(
          "div",
          { class: "vitrine-painel-grid" },
          ...produtos.map((produto) =>
            h(
              "div",
              { class: "vitrine-painel-card" },
              h("strong", {}, produto.nome),
              h("span", {}, produto.descricao),
              produto.em_breve
                ? h("small", {}, "Em breve")
                : h(
                    "a",
                    {
                      class: "link-painel",
                      href: `https://zapfichas.github.io/ficha/${produto.caminho}/`,
                      target: "_blank",
                      rel: "noopener noreferrer",
                    },
                    "Conhecer →"
                  )
            )
          )
        )
      )
    );

    elementos.push(
      h(
        "p",
        { class: "muted atualizado" },
        `Atualizado em ${dados.atualizado_em ?? formatarDataHora(new Date())}.`
      )
    );

    return elementos;
  }

  carregar();
  return container;
}
