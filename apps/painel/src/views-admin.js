import { api } from "./api.js";
import { anel, barras, cardGrafico, kpi, serieVertical } from "./charts.js";
import { formatarData, formatarDataHora, formatarMoeda, h } from "./ui.js";

export function renderAdmin(container) {
  const corpo = h("div", { class: "admin-corpo" }, h("p", { class: "muted" }, "Carregando métricas da plataforma…"));

  container.append(
    h(
      "div",
      { class: "pagina-topo" },
      h(
        "div",
        {},
        h("p", { class: "kicker" }, "Gestão da plataforma"),
        h("h1", {}, "Admin global"),
        h(
          "p",
          { class: "pagina-sub" },
          "Saúde do negócio: crescimento, conversão, churn e uso por nicho. Visível apenas para a gestão."
        )
      ),
      h(
        "button",
        { class: "btn-painel btn-secundario-painel", on: { click: () => carregar() } },
        "Atualizar"
      )
    ),
    corpo
  );

  async function carregar() {
    corpo.replaceChildren(h("p", { class: "muted" }, "Carregando métricas da plataforma…"));
    try {
      const dados = await api("/api/admin/metricas");
      corpo.replaceChildren(...montar(dados));
    } catch (err) {
      corpo.replaceChildren(
        h(
          "section",
          { class: "painel-card" },
          h("h3", {}, err.status === 403 ? "Acesso restrito" : "Não foi possível carregar"),
          h(
            "p",
            { class: "card-desc" },
            err.status === 403
              ? "Sua conta não está na lista de administradores da plataforma. Configure PLATFORM_ADMIN_EMAILS no Worker."
              : err.message ?? "Tente novamente em instantes."
          )
        )
      );
    }
  }

  function montar(d) {
    const t = d.tenants ?? {};
    const n = d.negocio ?? {};
    const f = d.fichas ?? {};
    return [
      h(
        "div",
        { class: "kpi-grid kpi-grid-6" },
        kpi("MRR", formatarMoeda(n.mrr ?? 0), { detalhe: `ARR ${formatarMoeda(n.arr ?? 0)}`, destaque: true }),
        kpi("Clientes ativos", t.ativos ?? 0, {
          detalhe: `${t.trial ?? 0} em trial`,
          tom: "sucesso",
        }),
        kpi("Novos em 30 dias", t.novos_30d ?? 0, {
          detalhe: `${Number(t.variacao_novos ?? 0) >= 0 ? "+" : ""}${t.variacao_novos ?? 0}% vs. período anterior`,
        }),
        kpi("Conversão trial", `${n.conversao_trial ?? 0}%`, { detalhe: "Ativos / (ativos + trial)" }),
        kpi("Churn", `${n.churn ?? 0}%`, { detalhe: `${t.cancelados ?? 0} cancelados`, tom: "alerta" }),
        kpi("Fichas em 30 dias", f.ultimos_30_dias ?? 0, {
          detalhe: `${f.taxa_conclusao ?? 0}% concluídas`,
        })
      ),
      h(
        "div",
        { class: "graficos-grid" },
        cardGrafico("Crescimento de clientes", "Novos estabelecimentos por mês.", serieVertical(f.por_mes ?? [], { rotulo: "rotulo", valor: "novos_tenants" })),
        cardGrafico("Volume de fichas", "Fichas recebidas por mês na plataforma.", serieVertical(f.por_mes ?? [], { rotulo: "rotulo", valor: "fichas" })),
        cardGrafico("Receita por nicho", "Distribuição do MRR ativo.", anel(
          (d.nichos ?? []).map((x) => ({ valor: x.nicho, quantidade: x.mrr })),
          { rotulo: "valor", valor: "quantidade" }
        )),
        cardGrafico("Clientes ativos por nicho", "Onde a base está concentrada.", barras(
          (d.nichos ?? []).map((x) => ({ valor: x.nicho, quantidade: x.ativos }))
        )),
        cardGrafico("Profissionais mais usados", "Nas fichas dos últimos 30 dias.", barras(f.top_profissionais ?? [])),
        cardGrafico(
          "Saúde operacional",
          "Conclusão e erro no período.",
          h(
            "div",
            { class: "saude-operacional" },
            h("div", {}, h("span", {}, "Taxa de conclusão"), h("strong", {}, `${f.taxa_conclusao ?? 0}%`)),
            h("div", {}, h("span", {}, "Taxa de erro"), h("strong", {}, `${f.taxa_erro ?? 0}%`)),
            h("div", {}, h("span", {}, "Ticket médio"), h("strong", {}, formatarMoeda(n.ticket_medio ?? 0))),
            h("div", {}, h("span", {}, "ARPA"), h("strong", {}, formatarMoeda(n.arpa ?? 0)))
          )
        )
      ),
      h(
        "section",
        { class: "painel-card" },
        h("div", { class: "card-topo" }, h("h3", {}, "Estabelecimentos recentes")),
        h(
          "div",
          { class: "admin-tabela" },
          h(
            "div",
            { class: "admin-linha admin-cabecalho" },
            h("span", {}, "Estabelecimento"),
            h("span", {}, "Nicho"),
            h("span", {}, "Plano"),
            h("span", {}, "Status"),
            h("span", {}, "Entrada"),
            h("span", {}, "Trial até")
          ),
          ...(d.tenants_recentes ?? []).map((tenant) =>
            h(
              "div",
              { class: "admin-linha" },
              h("span", {}, h("strong", {}, tenant.nome_negocio), h("small", {}, tenant.slug)),
              h("span", {}, tenant.nicho_slug),
              h("span", {}, tenant.plano),
              h("span", {}, tenant.status),
              h("span", {}, formatarData(tenant.criado_em)),
              h("span", {}, tenant.trial_expira_em ? formatarData(tenant.trial_expira_em) : "—")
            )
          )
        )
      ),
      h("p", { class: "muted atualizado" }, `Atualizado em ${formatarDataHora(d.atualizado_em)}.`),
    ];
  }

  carregar();
  return container;
}
