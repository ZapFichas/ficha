import { SUPORTE_WHATSAPP } from "@fichapro/shared";
import { api } from "./api.js";
import { h, iniciais, toast } from "./ui.js";

export function renderEquipe(container, { state, recarregarPainel } = {}) {
  const lista = h("div", { class: "equipe-lista" }, h("p", { class: "muted" }, "Carregando equipe…"));
  const aviso = h("div", { class: "aviso-painel", hidden: true });
  const limite = state?.plano?.limites?.profissionais;

  const nome = h("input", {
    class: "entrada-painel",
    id: "prof-nome",
    placeholder: "Ex.: Ana Ribeiro",
    required: true,
  });
  const especialidade = h("input", {
    class: "entrada-painel",
    id: "prof-especialidade",
    placeholder: "Ex.: tatuadora, piercer, esteticista",
  });
  const email = h("input", { class: "entrada-painel", id: "prof-email", type: "email", placeholder: "ana@estudio.com" });
  const telefone = h("input", { class: "entrada-painel", id: "prof-telefone", placeholder: "(61) 99999-9999" });
  const registro = h("input", { class: "entrada-painel", id: "prof-registro", placeholder: "Opcional (ex.: CRM, CRO)" });

  const form = h(
    "form",
    { class: "form-painel" },
    h(
      "div",
      { class: "form-grid" },
      grupo("Nome", nome),
      grupo("Especialidade", especialidade),
      grupo("E-mail", email, "Opcional. Não cria login."),
      grupo("Telefone", telefone),
      grupo("Registro profissional", registro)
    ),
    h(
      "div",
      { class: "acoes-painel" },
      h("button", { class: "btn-painel btn-primario-painel", type: "submit" }, "Adicionar profissional")
    )
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const botao = form.querySelector("button[type=submit]");
    botao.disabled = true;
    try {
      await api("/api/panel/profissionais", {
        method: "POST",
        body: {
          nome: nome.value.trim(),
          especialidade: especialidade.value.trim() || null,
          email: email.value.trim() || null,
          telefone: telefone.value.trim() || null,
          registro: registro.value.trim() || null,
        },
      });
      toast("Profissional adicionado.");
      form.reset();
      await carregar();
      recarregarPainel?.();
    } catch (err) {
      toast(err.message ?? "Não foi possível adicionar.", "erro");
    } finally {
      botao.disabled = false;
    }
  });

  container.append(
    h(
      "div",
      { class: "pagina-topo" },
      h(
        "div",
        {},
        h("p", { class: "kicker" }, "Equipe"),
        h("h1", {}, "Profissionais responsáveis"),
        h(
          "p",
          { class: "pagina-sub" },
          "Cadastre quem atende. Cada ficha fica vinculada ao profissional escolhido pelo cliente."
        )
      ),
      h(
        "a",
        {
          class: "btn-painel btn-secundario-painel",
          href: SUPORTE_WHATSAPP.url("Olá! Preciso de ajuda com o cadastro de profissionais."),
          target: "_blank",
          rel: "noopener noreferrer",
        },
        "Falar com o suporte"
      )
    ),
    limite
      ? h(
          "p",
          { class: "limite-plano" },
          `Seu plano ${state?.plano?.nome ?? ""} inclui ${limite} profissional(is). Ao crescer, o upgrade libera mais lugares.`
        )
      : null,
    aviso,
    lista,
    h(
      "section",
      { class: "painel-card" },
      h("h3", { class: "card-titulo-painel" }, "Novo profissional"),
      h("p", { class: "card-desc" }, "O nome aparece na ficha como opção de atendimento."),
      form
    )
  );

  async function carregar() {
    try {
      const dados = await api("/api/panel/profissionais");
      lista.replaceChildren();
      const itens = dados.itens ?? [];
      if (dados.fonte === "usuarios" || dados.aviso) {
        aviso.hidden = false;
        aviso.textContent =
          dados.aviso ??
          "O cadastro completo de equipe será habilitado após a atualização do servidor.";
      }
      if (!itens.length) {
        lista.append(
          h(
            "div",
            { class: "vazio-painel" },
            h("div", { class: "vazio-icone" }, "👥"),
            h("h3", {}, "Nenhum profissional cadastrado"),
            h("p", {}, "Adicione o primeiro profissional para vincular as fichas do estúdio.")
          )
        );
        return;
      }
      for (const profissional of itens) {
        lista.append(
          h(
            "article",
            { class: "equipe-card", "data-profissional": profissional.id },
            h("span", { class: "ficha-avatar" }, iniciais(profissional.nome)),
            h(
              "div",
              { class: "equipe-info" },
              h("strong", {}, profissional.nome),
              h(
                "small",
                {},
                [profissional.especialidade, profissional.email, profissional.telefone]
                  .filter(Boolean)
                  .join(" · ") || "Sem dados de contato"
              )
            ),
            h("span", { class: `badge-status ${profissional.ativo === false ? "neutro" : "sucesso"}` }, profissional.ativo === false ? "Inativo" : "Ativo"),
            profissional.ativo === false
              ? null
              : h(
                  "button",
                  {
                    class: "btn-painel btn-secundario-painel btn-pequeno",
                    type: "button",
                    on: {
                      click: async (e) => {
                        if (!confirm(`Desativar ${profissional.nome}? As fichas antigas permanecem.`)) return;
                        e.target.disabled = true;
                        try {
                          await api(`/api/panel/profissionais/${profissional.id}`, { method: "DELETE" });
                          toast("Profissional desativado.");
                          await carregar();
                        } catch (err) {
                          toast(err.message ?? "Falha ao desativar.", "erro");
                          e.target.disabled = false;
                        }
                      },
                    },
                  },
                  "Desativar"
                )
          )
        );
      }
      if (dados.fonte === "usuarios") {
        // Nada a fazer: fallback somente leitura.
      }
    } catch (err) {
      lista.replaceChildren(
        h(
          "section",
          { class: "painel-card" },
          h("h3", {}, "Equipe indisponível"),
          h("p", { class: "card-desc" }, err.message ?? "Tente novamente."),
          h(
            "button",
            { class: "btn-painel btn-secundario-painel btn-pequeno", on: { click: () => carregar() } },
            "Tentar novamente"
          )
        )
      );
    }
  }

  carregar();
  return container;
}

function grupo(rotulo, input, hint = null) {
  return h(
    "label",
    { class: "campo-painel" },
    h("span", { class: "campo-painel-rotulo" }, rotulo),
    input,
    hint ? h("small", { class: "campo-painel-hint" }, hint) : null
  );
}
