import { api } from "./api.js";
import { formatarData, formatarDataHora, h, iniciais, toast } from "./ui.js";

export function renderClientes(container, { abrirFicha } = {}) {
  let timer = null;
  let buscaAtual = "";

  const input = h("input", {
    class: "entrada-painel",
    type: "search",
    placeholder: "Buscar por CPF completo, 4 últimos dígitos ou nome…",
    "aria-label": "Buscar cliente por CPF ou nome",
  });
  const resumo = h("p", { class: "muted busca-resumo" }, "Digite para buscar ou veja os clientes recentes.");
  const lista = h("div", { class: "clientes-lista" });

  const topo = h(
    "div",
    { class: "pagina-topo" },
    h(
      "div",
      {},
      h("p", { class: "kicker" }, "Jornada do cliente"),
      h("h1", {}, "Clientes"),
      h(
        "p",
        { class: "pagina-sub" },
        "Busque por CPF e veja todas as fichas da mesma pessoa em um só lugar."
      )
    )
  );

  const buscaCard = h(
    "section",
    { class: "painel-card busca-card" },
    h("div", { class: "busca-linha" }, input),
    h(
      "small",
      { class: "campo-painel-hint" },
      "O CPF completo é usado apenas para localizar o histórico. Ele não aparece na tela."
    ),
    resumo
  );

  container.append(topo, buscaCard, lista);

  input.addEventListener("input", () => {
    buscaAtual = input.value;
    clearTimeout(timer);
    timer = setTimeout(() => carregar(), 350);
  });

  async function carregar() {
    lista.replaceChildren(h("p", { class: "muted" }, "Carregando clientes…"));
    try {
      const params = new URLSearchParams();
      if (buscaAtual.trim()) params.set("q", buscaAtual.trim());
      const dados = await api(`/api/panel/clientes?${params.toString()}`);
      resumo.textContent = buscaAtual.trim()
        ? `${dados.total} cliente(s) encontrados para “${buscaAtual.trim()}”.`
        : `${dados.total} cliente(s) com fichas neste estabelecimento.`;
      renderLista(dados.itens ?? []);
    } catch (err) {
      lista.replaceChildren(
        h(
          "section",
          { class: "painel-card" },
          h("h3", {}, "Busca indisponível"),
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

  function renderLista(clientes) {
    lista.replaceChildren();
    if (!clientes.length) {
      lista.append(
        h(
          "section",
          { class: "painel-card vazio-painel" },
          h("div", { class: "vazio-icone" }, "🔎"),
          h("h3", {}, buscaAtual ? "Nenhum cliente encontrado" : "Nenhum cliente ainda"),
          h(
            "p",
            {},
            buscaAtual
              ? "Confira o CPF digitado ou tente buscar pelo nome completo."
              : "As fichas enviadas aparecem aqui, conectadas por cliente."
          )
        )
      );
      return;
    }

    for (const cliente of clientes) {
      const pendentes = Number(cliente.pendentes ?? 0);
      const card = h(
        "article",
        { class: "cliente-card" },
        h(
          "header",
          { class: "cliente-topo" },
          h("span", { class: "ficha-avatar" }, iniciais(cliente.nome)),
          h(
            "div",
            { class: "cliente-identidade" },
            h("strong", {}, cliente.nome ?? "Cliente"),
            h(
              "small",
              {},
              [
                cliente.cpf_ultimos4 ? `CPF ***.***.***-${cliente.cpf_ultimos4}` : "CPF não informado",
                cliente.data_nascimento ? `nasc. ${formatarData(cliente.data_nascimento)}` : null,
                cliente.menor_idade ? "menor de idade" : null,
              ]
                .filter(Boolean)
                .join(" · ")
            )
          ),
          h(
            "div",
            { class: "cliente-badges" },
            h("span", { class: "badge-status neutro" }, `${cliente.total_fichas} ficha(s)`),
            pendentes ? h("span", { class: "badge-status alerta" }, `${pendentes} pendência(s)`) : null
          )
        ),
        h("p", { class: "cliente-ultima" }, `Última ficha em ${formatarDataHora(cliente.ultima_ficha_em)}`),
        h(
          "div",
          { class: "cliente-historico" },
          ...cliente.fichas.map((ficha) =>
            h(
              "button",
              {
                class: "cliente-ficha",
                type: "button",
                on: { click: () => abrirFicha?.(ficha.id) },
              },
              h("span", { class: "cliente-ficha-data" }, formatarData(ficha.criado_em)),
              h("span", { class: "cliente-ficha-protocolo" }, ficha.protocolo),
              h(
                "span",
                { class: `badge-status ${ficha.status === "salva" ? "sucesso" : ficha.status === "erro" ? "erro" : "processando"}` },
                ficha.status === "salva" ? "Concluída" : ficha.status
              ),
              h("span", { class: "cliente-ficha-seta" }, "→")
            )
          )
        )
      );
      lista.append(card);
    }
  }

  carregar();
  return container;
}
