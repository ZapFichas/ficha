import {
  aplicarCamposAtivos,
  aplicarCamposCustomizados,
  aplicarTema,
  calcularIdade,
  campoVisivel,
  camposDoTemplate,
  dataISOHoje,
  formatarDataBR,
  formatarDataHoraBR,
  linkProduto,
  montarContexto,
  passosDaFicha,
  produtosPara,
  renderizarTexto,
  sanitizarRespostas,
  SUPORTE_WHATSAPP,
  validarCampo,
  validarRespostas,
  valorVazio,
} from "@fichapro/shared";
import { enviarFicha } from "./api.js";
import { mascararCPF, mascararTelefone } from "./masks.js";
import { SignaturePad } from "./signature.js";
import { criarCampoUpload } from "./upload.js";

const ICONE_CADEADO = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/></svg>`;
const ICONE_CHECK = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><polyline points="4,13 9,18 20,7"/></svg>`;
const ICONE_SETA = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`;
const ICONE_VOLTAR = `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>`;
const ICONE_CANETA = `<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`;

function h(tag, attrs = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [chave, valor] of Object.entries(attrs ?? {})) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (chave === "class") el.className = valor;
    else if (chave === "text") el.textContent = valor;
    else if (chave === "html") el.innerHTML = valor;
    else if (chave === "dataset") Object.assign(el.dataset, valor);
    else if (chave === "on") {
      for (const [evento, fn] of Object.entries(valor)) el.addEventListener(evento, fn);
    } else if (valor === true) el.setAttribute(chave, "");
    else el.setAttribute(chave, String(valor));
  }
  for (const filho of filhos.flat()) {
    if (filho === null || filho === undefined || filho === false) continue;
    el.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
  }
  return el;
}

export class FichaEngine {
  constructor({ app, config, demo = false }) {
    this.app = app;
    this.config = config;
    this.demo = demo;
    this.tenant = config.tenant;
    const templateAtivo = aplicarCamposAtivos(
      config.template,
      config.formulario?.campos_ativos ?? null
    );
    const templateComExtras = aplicarCamposCustomizados(
      templateAtivo,
      config.formulario?.campos_customizados ?? config.campos_customizados ?? []
    );
    this.template = {
      ...templateComExtras,
      secoes: templateComExtras.secoes,
      consentimentos_extras: templateComExtras.consentimentos_extras ?? [],
    };
    this.profissionais = config.profissionais ?? [];
    this.permissoes = config.permissoes ?? config.tenant?.permissoes ?? {};
    this.produtos = config.produtos ?? null;
    this.dados = {};
    this.consent = { termo: false, lgpd: false, extras: {} };
    this.erros = {};
    this.passos = passosDaFicha(this.template, { menorIdade: false });
    this.passoIdx = 0;
    this.menorIdade = false;
    this.pendenciaResponsavel = false;
    this.permitePendencia = this.permissoes.permite_pendencia_responsavel === true;
    this.iniciadoEm = new Date().toISOString();
    this.retornoRevisao = false;
    this.pads = {};
    this.assinaturaImagens = {};
    this.enviando = false;
    this.mapaCampos = new Map(camposDoTemplate(this.template).map((c) => [c.id, c]));

    this.aplicarBranding();
    this.montarShell();
    this.render();
  }

  // ----------------------------------------------------------
  // Shell / branding
  // ----------------------------------------------------------
  aplicarBranding() {
    const b = this.tenant.branding ?? {};
    const paleta = aplicarTema(document.documentElement, b);
    document.body.classList.toggle("tema-escuro", Boolean(paleta?.escuro));
    document.title = `${this.tenant.nome_negocio} · ${this.template.nome}`;
  }

  montarShell() {
    const b = this.tenant.branding ?? {};
    const logo = b.logo_url
      ? h("img", { src: b.logo_url, alt: "", class: "marca-img" })
      : h("span", { class: "marca-inicial", "aria-hidden": "true" }, (this.tenant.nome_negocio ?? "F").trim().charAt(0).toUpperCase());

    const topo = h(
      "header",
      { class: "topo" },
      h(
        "div",
        { class: "topo-interno" },
        h(
          "div",
          { class: "marca" },
          h("div", { class: "marca-logo" }, logo),
          h(
            "div",
            { class: "marca-texto" },
            h("span", { class: "marca-nome" }, this.tenant.nome_negocio ?? "Estabelecimento"),
            h("span", { class: "marca-sub" }, "Ficha de anamnese e termo")
          )
        ),
        h("div", { class: "selo-seguro", title: "Ambiente seguro" }, h("span", { html: ICONE_CADEADO }), "Seguro")
      )
    );

    this.barra = h("span", { class: "barra-preenchida" });
    const progresso = h("div", { class: "barra-progresso", role: "progressbar", "aria-label": "Progresso da ficha" }, this.barra);
    this.etapas = h("nav", { class: "etapas", "aria-label": "Etapas da ficha" });
    this.conteudo = h("main", { class: "conteudo", id: "conteudo", tabindex: "-1" });

    const rodape = h(
      "footer",
      { class: "rodape" },
      h("span", {}, "Seus dados são usados apenas para este atendimento."),
      h("span", { class: "rodape-sub" }, "Tratamento conforme a LGPD · assinatura com registro de segurança"),
      h(
        "a",
        {
          class: "rodape-suporte",
          href: SUPORTE_WHATSAPP.url(
            `Olá! Preciso de ajuda com a ficha de ${this.tenant.nome_negocio ?? "um estabelecimento"}.`
          ),
          target: "_blank",
          rel: "noopener noreferrer",
        },
        `Suporte: ${SUPORTE_WHATSAPP.exibicao}`
      )
    );

    this.app.replaceChildren(topo, progresso, this.etapas, this.conteudo, rodape);
    this.overlay = h(
      "div",
      { class: "overlay", hidden: true, role: "status", "aria-live": "polite" },
      h("div", { class: "loader", "aria-hidden": "true" }),
      h("p", { class: "overlay-titulo" }, "Processando sua ficha…"),
      h("p", { class: "overlay-sub" }, "Não feche esta página")
    );
    this.app.append(this.overlay);
    this.comprovante = h("section", { id: "comprovante", class: "comprovante", hidden: true });
    document.body.append(this.comprovante);
  }

  render() {
    this.renderEtapas();
    this.renderPasso();
  }

  renderEtapas() {
    const total = this.passos.length;
    this.barra.style.width = `${((this.passoIdx + 1) / total) * 100}%`;
    this.etapas.replaceChildren();

    this.passos.forEach((passo, idx) => {
      const estado = idx < this.passoIdx ? "feita" : idx === this.passoIdx ? "ativa" : "futura";
      const botao = h(
        "button",
        {
          type: "button",
          class: `etapa ${estado}`,
          "aria-current": idx === this.passoIdx ? "step" : null,
          "aria-label": `${passo.titulo}${idx < this.passoIdx ? " (concluída)" : ""}`,
          disabled: idx > this.passoIdx,
          on: {
            click: () => {
              if (idx < this.passoIdx) this.irPara(idx);
            },
          },
        },
        h(
          "span",
          { class: "etapa-circulo", "aria-hidden": "true" },
          idx < this.passoIdx ? h("span", { html: ICONE_CHECK }) : String(idx + 1)
        ),
        h("span", { class: "etapa-rotulo" }, passo.rotulo ?? passo.titulo)
      );
      this.etapas.append(botao);
      if (idx < total - 1) this.etapas.append(h("span", { class: "etapa-linha", "aria-hidden": "true" }));
    });
  }

  renderPasso() {
    Object.values(this.pads ?? {}).forEach((p) => p?.destroyed?.());
    this.pads = {};

    const passo = this.passos[this.passoIdx];
    this.conteudo.replaceChildren();
    this.rolarTopo();

    if (!passo) return;
    if (passo.tipo === "secao") this.renderSecao(passo);
    else if (passo.tipo === "termo") this.renderTermo();
    else if (passo.tipo === "revisao") this.renderRevisao();
    else if (passo.tipo === "assinatura") this.renderAssinatura();

    this.aplicarErrosSalvos();
    const titulo = this.conteudo.querySelector(".passo-titulo");
    if (titulo) {
      titulo.setAttribute("tabindex", "-1");
      titulo.focus({ preventScroll: true });
    }
  }

  rolarTopo() {
    const suave = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: suave ? "smooth" : "auto" });
  }

  cabecalhoPasso(titulo, descricao = "", rotulo = null) {
    const numero = this.passoIdx + 1;
    return h(
      "div",
      { class: "passo-cabecalho" },
      h("p", { class: "passo-num" }, rotulo ?? `Etapa ${numero} de ${this.passos.length}`),
      h("h2", { class: "passo-titulo" }, titulo),
      descricao ? h("p", { class: "passo-desc" }, descricao) : null,
      h("div", { class: "divisor", "aria-hidden": "true" })
    );
  }

  // ----------------------------------------------------------
  // Contexto / condicionais
  // ----------------------------------------------------------
  contexto() {
    return {
      ...montarContexto(this.template, this.dados),
      hoje: new Date(),
      menorIdade: this.menorIdade,
      profissionais: this.profissionais,
    };
  }

  atualizarCondicionais() {
    const ctx = this.contexto();
    for (const wrap of this.conteudo.querySelectorAll("[data-campo]")) {
      const campo = this.mapaCampos.get(wrap.dataset.campo);
      if (!campo) continue;
      const visivel = campoVisivel(campo, ctx);
      wrap.hidden = !visivel;
      wrap.classList.toggle("oculto", !visivel);
      if (!visivel) this.limparErro(campo.id);
    }
  }

  recalcularPassos() {
    const atualId = this.passos[this.passoIdx]?.id;
    this.passos = passosDaFicha(this.template, { menorIdade: this.menorIdade });
    const novoIdx = this.passos.findIndex((p) => p.id === atualId);
    if (novoIdx >= 0) {
      this.passoIdx = novoIdx;
      this.render();
    } else {
      this.passoIdx = Math.max(0, this.passos.findIndex((p) => p.tipo === "termo"));
      this.render();
    }
  }

  // ----------------------------------------------------------
  // Seções e campos
  // ----------------------------------------------------------
  renderSecao(passo) {
    const secao = passo.secao;
    const numero = this.passos.filter((p) => p.tipo === "secao").findIndex((p) => p.id === secao.id) + 1;
    const totalSecoes = this.passos.filter((p) => p.tipo === "secao").length;

    const cabecalho = h(
      "div",
      { class: "passo-cabecalho" },
      h("p", { class: "passo-num" }, `Seção ${numero} de ${totalSecoes}`),
      h("h2", { class: "passo-titulo" }, secao.titulo),
      secao.descricao ? h("p", { class: "passo-desc" }, secao.descricao) : null,
      h("div", { class: "divisor", "aria-hidden": "true" })
    );

    const card = h("div", { class: `card ${secao.layout === "grade" ? "card-grade" : ""}` });

    if (secao.condicional?.tipo === "menor_idade") {
      card.append(
        h(
          "div",
          { class: "aviso aviso-menor" },
          h("strong", {}, "Cliente menor de 18 anos"),
          h("span", {}, "O responsável legal deve preencher os dados abaixo e assinar ao final.")
        )
      );
    }

    for (const campo of secao.campos) card.append(this.criarCampo(campo));
    this.conteudo.append(cabecalho, card);

    const voltar = this.passoIdx > 0;
    this.conteudo.append(
      this.acoes({
        voltar,
        rotulo: this.passoIdx === this.passos.length - 2 ? "Revisar termo" : "Continuar",
        aoAvancar: () => this.proximo(),
      })
    );
  }

  criarCampo(campo) {
    const ctx = this.contexto();
    const visivel = campoVisivel(campo, ctx);
    const grupo = campo.tipo === "sim_nao" || campo.tipo === "checkbox";
    const wrap = document.createElement(grupo ? "fieldset" : "div");
    wrap.className = `campo${campo.compacto ? " campo-compacto" : ""}${visivel ? "" : " oculto"}`;
    wrap.dataset.campo = campo.id;
    wrap.hidden = !visivel;

    const idInput = `campo_${campo.id}`;
    const idErro = `erro_${campo.id}`;
    const idHint = campo.hint ? `hint_${campo.id}` : null;

    const rotulo = h(
      grupo ? "legend" : "label",
      grupo ? { class: "campo-rotulo" } : { class: "campo-rotulo", for: idInput },
      campo.label,
      campo.obrigatorio ? h("span", { class: "obrigatorio", "aria-hidden": "true" }, " *") : null
    );
    wrap.append(rotulo);

    const controles = h("div", { class: "campo-controle" });

    switch (campo.tipo) {
      case "sim_nao": {
        controles.className = "opcoes-radio";
        for (const opcao of ["Não", "Sim"]) {
          const id = `${idInput}_${opcao === "Sim" ? "sim" : "nao"}`;
          const label = h(
            "label",
            { class: "opcao-radio", for: id },
            h("input", {
              type: "radio",
              id,
              name: idInput,
              value: opcao,
              checked: this.dados[campo.id] === opcao,
              on: {
                change: () => this.definirValor(campo, opcao),
              },
            }),
            h("span", {}, opcao)
          );
          controles.append(label);
        }
        break;
      }

      case "checkbox": {
        controles.className = "opcoes-check";
        const atuais = Array.isArray(this.dados[campo.id]) ? this.dados[campo.id] : [];
        for (const opcao of campo.opcoes ?? []) {
          const id = `${idInput}_${opcao.toLowerCase().replace(/[^a-z0-9]+/gi, "_")}`;
          controles.append(
            h(
              "label",
              { class: "opcao-check", for: id },
              h("input", {
                type: "checkbox",
                id,
                name: idInput,
                value: opcao,
                checked: atuais.includes(opcao),
                on: {
                  change: (e) => this.aoMarcarCheckbox(campo, opcao, e.target.checked),
                },
              }),
              h("span", {}, opcao)
            )
          );
        }
        break;
      }

      case "select": {
        const select = h("select", {
          id: idInput,
          name: campo.id,
          class: "entrada",
          "aria-describedby": [idHint, idErro].filter(Boolean).join(" ") || null,
          on: {
            change: (e) => this.definirValor(campo, e.target.value),
          },
        });
        select.append(h("option", { value: "" }, "Selecione…"));

        let opcoes = campo.opcoes ?? [];
        if (campo.opcoes_fonte === "profissionais") {
          opcoes = this.profissionais.map((p) => p.nome);
          if (opcoes.length === 0) {
            select.append(h("option", { value: "", disabled: true }, "Nenhum profissional cadastrado"));
          }
        }
        for (const opcao of opcoes) {
          select.append(
            h(
              "option",
              { value: opcao, selected: this.dados[campo.id] === opcao },
              opcao
            )
          );
        }

        if (opcoes.length === 1 && !this.dados[campo.id]) {
          this.dados[campo.id] = opcoes[0];
          select.value = opcoes[0];
        }
        controles.append(select);
        break;
      }

      case "upload": {
        const upload = criarCampoUpload({
          campo,
          valorInicial: this.dados[campo.id] ?? null,
          onChange: (valor) => {
            this.dados[campo.id] = valor ?? undefined;
            if (!valor) delete this.dados[campo.id];
            this.limparErro(campo.id);
            this.atualizarCondicionais();
          },
          onError: (msg) => this.mostrarErro(campo.id, msg),
        });
        controles.append(upload.elemento);
        break;
      }

      default: {
        const tag = campo.tipo === "textarea" ? "textarea" : "input";
        const entrada = document.createElement(tag);
        entrada.id = idInput;
        entrada.name = campo.id;
        entrada.className = "entrada";
        entrada.setAttribute(
          "aria-describedby",
          [idHint, idErro].filter(Boolean).join(" ") || ""
        );

        if (tag === "textarea") {
          entrada.rows = 4;
          if (campo.max) entrada.maxLength = campo.max;
          entrada.value = this.dados[campo.id] ?? "";
        } else {
          entrada.type =
            campo.tipo === "cpf" || campo.tipo === "tel"
              ? "text"
              : campo.tipo === "number"
                ? "number"
                : campo.tipo;
          if (campo.tipo === "cpf") {
            entrada.inputMode = "numeric";
            entrada.autocomplete = "off";
            entrada.maxLength = 14;
            entrada.value = this.dados[campo.id] ?? "";
          } else if (campo.tipo === "tel") {
            entrada.inputMode = "tel";
            entrada.autocomplete = campo.autocomplete ?? "tel";
            entrada.maxLength = 16;
            entrada.value = this.dados[campo.id] ?? "";
          } else {
            if (campo.max && tag === "input") entrada.maxLength = campo.max;
            if (campo.autocomplete) entrada.autocomplete = campo.autocomplete;
            if (campo.placeholder) entrada.placeholder = campo.placeholder;
            if (campo.tipo === "date") {
              entrada.value = this.dados[campo.id] ?? "";
              if (campo.regra === "data_passada") entrada.max = dataISOHoje();
            } else if (campo.tipo === "number") {
              entrada.step = "0.01";
              if (campo.min !== undefined) entrada.min = campo.min;
              if (campo.max !== undefined) entrada.max = campo.max;
              entrada.inputMode = "decimal";
              entrada.value = this.dados[campo.id] ?? "";
            } else {
              entrada.value = this.dados[campo.id] ?? "";
            }
          }
        }

        if (campo.placeholder && tag === "textarea") entrada.placeholder = campo.placeholder;

        entrada.addEventListener("input", (e) => {
          let valor = e.target.value;
          if (campo.tipo === "cpf") {
            valor = mascararCPF(valor);
            e.target.value = valor;
          } else if (campo.tipo === "tel") {
            valor = mascararTelefone(valor);
            e.target.value = valor;
          }
          this.definirValor(campo, valor, { silencioso: true });

          // Corrigir o valor deve limpar o erro imediatamente.
          if (this.erros[campo.id]) {
            const msg = validarCampo(campo, valor, this.contexto());
            if (msg) this.mostrarErro(campo.id, msg);
            else this.limparErro(campo.id);
          }
        });
        entrada.addEventListener("blur", () => {
          if (!entrada.value) {
            this.limparErro(campo.id);
            return;
          }
          const msg = validarCampo(campo, entrada.value, this.contexto());
          if (msg) this.mostrarErro(campo.id, msg);
          else this.limparErro(campo.id);
        });

        controles.append(entrada);
        break;
      }
    }

    wrap.append(controles);

    if (campo.hint) {
      wrap.append(h("p", { class: "campo-hint", id: idHint }, campo.hint));
    }
    wrap.append(h("p", { class: "campo-erro", id: idErro, role: "alert", hidden: true }));

    if (this.erros[campo.id]) this.mostrarErro(campo.id, this.erros[campo.id]);
    return wrap;
  }

  aoMarcarCheckbox(campo, opcao, marcado) {
    let atuais = Array.isArray(this.dados[campo.id]) ? [...this.dados[campo.id]] : [];

    if (marcado) {
      if (campo.exclusivo && opcao === campo.exclusivo) {
        atuais = [opcao];
      } else {
        atuais = atuais.filter((v) => v !== campo.exclusivo);
        if (!atuais.includes(opcao)) atuais.push(opcao);
      }
    } else {
      atuais = atuais.filter((v) => v !== opcao);
    }

    this.dados[campo.id] = atuais;
    if (atuais.length === 0) delete this.dados[campo.id];

    for (const input of this.conteudo.querySelectorAll(`input[name="${campo.id}"]`)) {
      input.checked = atuais.includes(input.value);
    }

    this.limparErro(campo.id);
    this.atualizarCondicionais();
  }

  definirValor(campo, valor, { silencioso = false } = {}) {
    if (valor === "" || valor === undefined || valor === null) delete this.dados[campo.id];
    else this.dados[campo.id] = valor;

    if (!silencioso) this.limparErro(campo.id);

    if (campo.id === "data_nascimento") {
      const idade = calcularIdade(valor, new Date());
      const menor = idade !== null && idade < 18;
      if (menor !== this.menorIdade) {
        this.menorIdade = menor;
        this.recalcularPassos();
        return;
      }
    }

    this.atualizarCondicionais();
  }

  // ----------------------------------------------------------
  // Erros
  // ----------------------------------------------------------
  mostrarErro(id, msg) {
    this.erros[id] = msg;
    const erro = document.getElementById(`erro_${id}`);
    if (erro) {
      erro.textContent = msg;
      erro.hidden = false;
    }
    const wrap =
      this.conteudo.querySelector(`[data-campo="${id}"]`) ??
      erro?.closest(".aceite, .card-assinatura");
    wrap?.classList.add("invalido");
    wrap?.querySelectorAll("input, select, textarea").forEach((el) =>
      el.setAttribute("aria-invalid", "true")
    );
  }

  limparErro(id) {
    if (this.erros[id]) delete this.erros[id];
    const erro = document.getElementById(`erro_${id}`);
    if (erro) {
      erro.hidden = true;
      erro.textContent = "";
    }
    const wrap =
      this.conteudo.querySelector(`[data-campo="${id}"]`) ??
      erro?.closest(".aceite, .card-assinatura");
    wrap?.classList.remove("invalido");
    wrap?.querySelectorAll("input, select, textarea").forEach((el) =>
      el.removeAttribute("aria-invalid")
    );
  }

  aplicarErrosSalvos() {
    for (const [id, msg] of Object.entries(this.erros)) this.mostrarErro(id, msg);
  }

  focarPrimeiroErro() {
    const invalido = this.conteudo.querySelector(
      ".campo.invalido, .aceite.invalido, .card-assinatura.invalido"
    );
    invalido?.scrollIntoView({ behavior: "smooth", block: "center" });
    const foco = invalido?.querySelector("input, select, textarea, button, canvas");
    foco?.focus({ preventScroll: true });
  }

  mostrarAlerta(msg) {
    const antigo = this.conteudo.querySelector(".alerta-global");
    antigo?.remove();
    const alerta = h("div", { class: "alerta-global", role: "alert" }, msg);
    this.conteudo.prepend(alerta);
    alerta.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // ----------------------------------------------------------
  // Validação / navegação
  // ----------------------------------------------------------
  validarSecao(secao) {
    const ctx = this.contexto();
    let ok = true;
    for (const campo of secao.campos) {
      if (!campoVisivel(campo, ctx)) continue;
      const msg = validarCampo(campo, this.dados[campo.id], ctx);
      if (msg) {
        this.mostrarErro(campo.id, msg);
        ok = false;
      } else {
        this.limparErro(campo.id);
      }
    }
    if (!ok) this.focarPrimeiroErro();
    return ok;
  }

  validarTermo() {
    let ok = true;
    if (!this.consent.termo) {
      this.mostrarErro("__termo", "É necessário aceitar o termo de consentimento.");
      ok = false;
    } else this.limparErro("__termo");

    if (!this.consent.lgpd) {
      this.mostrarErro("__lgpd", "É necessário autorizar o tratamento dos dados (LGPD).");
      ok = false;
    } else this.limparErro("__lgpd");

    for (const extra of this.template.consentimentos_extras ?? []) {
      if (extra.obrigatorio && !this.consent.extras[extra.id]) {
        this.mostrarErro(`__extra_${extra.id}`, "É necessário aceitar para continuar.");
        ok = false;
      } else {
        this.limparErro(`__extra_${extra.id}`);
      }
    }

    if (!ok) this.focarPrimeiroErro();
    return ok;
  }

  validarAssinatura() {
    let ok = true;
    if (!this.pads.cliente?.temTraco()) {
      this.mostrarErro("__assinatura_cliente", "Assine no campo acima para finalizar.");
      ok = false;
    } else this.limparErro("__assinatura_cliente");

    if (this.menorIdade) {
      if (!this.pads.responsavel?.temTraco() && !this.pendenciaResponsavel) {
        this.mostrarErro(
          "__assinatura_responsavel",
          this.permitePendencia
            ? "Assine ou marque que a documentação será enviada depois."
            : "O responsável legal precisa assinar."
        );
        ok = false;
      } else this.limparErro("__assinatura_responsavel");
    }

    if (!ok) this.focarPrimeiroErro();
    return ok;
  }

  validarTudo() {
    const ctx = this.contexto();
    const { erros } = validarRespostas(this.template, this.dados, {
      hoje: new Date(),
      contextoExtra: { menorIdade: this.menorIdade },
    });

    this.erros = {};
    for (const [id, msg] of Object.entries(erros)) this.erros[id] = msg;

    const termoOk = this.consent.termo && this.consent.lgpd;
    const extrasOk = (this.template.consentimentos_extras ?? []).every(
      (extra) => !extra.obrigatorio || this.consent.extras[extra.id]
    );

    return {
      ok: Object.keys(erros).length === 0 && termoOk && extrasOk,
      erros,
      ctx,
    };
  }

  proximo() {
    const passo = this.passos[this.passoIdx];

    if (passo.tipo === "secao" && !this.validarSecao(passo.secao)) return;
    if (passo.tipo === "termo" && !this.validarTermo()) return;
    if (passo.tipo === "assinatura") {
      this.enviar();
      return;
    }

    if (passo.tipo === "secao" && this.retornoRevisao) {
      this.passoIdx = this.passos.findIndex((p) => p.tipo === "revisao");
      this.retornoRevisao = false;
      this.erros = {};
      this.render();
      return;
    }

    this.retornoRevisao = false;
    this.passoIdx = Math.min(this.passoIdx + 1, this.passos.length - 1);
    this.erros = {};
    this.render();
  }

  voltar() {
    this.retornoRevisao = false;
    this.passoIdx = Math.max(0, this.passoIdx - 1);
    this.erros = {};
    this.render();
  }

  irPara(idx) {
    this.retornoRevisao = false;
    this.passoIdx = Math.max(0, Math.min(idx, this.passos.length - 1));
    this.erros = {};
    this.render();
  }

  irParaSecao(id) {
    const idx = this.passos.findIndex((p) => p.id === id);
    if (idx < 0) return;
    this.passoIdx = idx;
    this.retornoRevisao = true;
    this.erros = {};
    this.render();
  }

  acoes({ voltar = true, rotulo = "Continuar", aoAvancar, extra = null }) {
    const botoes = h("div", { class: "acoes" });
    if (voltar) {
      botoes.append(
        h(
          "button",
          { type: "button", class: "btn btn-secundario", on: { click: () => this.voltar() } },
          h("span", { html: ICONE_VOLTAR }),
          "Voltar"
        )
      );
    }
    botoes.append(
      h(
        "button",
        { type: "button", class: "btn btn-primario", on: { click: aoAvancar } },
        rotulo,
        h("span", { html: ICONE_SETA })
      )
    );
    if (extra) botoes.append(extra);
    return botoes;
  }

  // ----------------------------------------------------------
  // Termo / LGPD
  // ----------------------------------------------------------
  renderTermo() {
    const nome = this.tenant.nome_negocio ?? "";
    const retencao = this.tenant.retencao_anos ?? 5;
    const email = this.tenant.email_contato ?? "contato do estabelecimento";
    const termo = renderizarTexto(this.template.termo_texto, {
      nome_negocio: nome,
      retencao_anos: retencao,
      email_contato: email,
      nicho: this.template.nicho_slug,
    });
    const lgpd = renderizarTexto(this.template.consentimento_lgpd, {
      nome_negocio: nome,
      retencao_anos: retencao,
      email_contato: email,
      nicho: this.template.nicho_slug,
    });

    this.conteudo.append(
      this.cabecalhoPasso(
        "Termo de consentimento",
        "Leia com atenção. O aceite e a assinatura ficam registrados com data, hora e registro seguro."
      )
    );

    const cardTermo = h("div", { class: "card" }, h("div", { class: "texto-termo" }, termo));
    const cardLgpd = h(
      "div",
      { class: "card" },
      h("h3", { class: "card-titulo" }, "Privacidade e LGPD"),
      h("div", { class: "texto-termo texto-lgpd" }, lgpd)
    );
    this.conteudo.append(cardTermo, cardLgpd);

    const aceites = h("div", { class: "card card-aceites" });

    aceites.append(
      this.linhaAceite({
        id: "__termo",
        titulo: "Li e concordo com o termo de consentimento.",
        descricao: "Confirmo que as informações fornecidas são verdadeiras.",
        marcado: this.consent.termo,
        aoMudar: (v) => {
          this.consent.termo = v;
          this.limparErro("__termo");
        },
      })
    );

    aceites.append(
      this.linhaAceite({
        id: "__lgpd",
        titulo: "Autorizo o tratamento dos meus dados pessoais e de saúde.",
        descricao: `Dados mantidos por até ${retencao} anos, conforme a LGPD.`,
        marcado: this.consent.lgpd,
        aoMudar: (v) => {
          this.consent.lgpd = v;
          this.limparErro("__lgpd");
        },
      })
    );

    for (const extra of this.template.consentimentos_extras ?? []) {
      aceites.append(
        this.linhaAceite({
          id: `__extra_${extra.id}`,
          titulo: extra.label,
          descricao: extra.obrigatorio ? "Aceite obrigatório." : "Opcional.",
          marcado: Boolean(this.consent.extras[extra.id]),
          aoMudar: (v) => {
            this.consent.extras[extra.id] = v;
            this.limparErro(`__extra_${extra.id}`);
          },
        })
      );
    }

    this.conteudo.append(aceites);

    this.conteudo.append(
      h(
        "p",
        { class: "nota-assinatura" },
        "A assinatura digital fica registrada com data, hora, endereço de acesso e dispositivo, formando um histórico seguro. "
      )
    );

    this.conteudo.append(this.acoes({ voltar: true, rotulo: "Revisar dados", aoAvancar: () => this.proximo() }));
  }

  linhaAceite({ id, titulo, descricao, marcado, aoMudar }) {
    const inputId = `aceite_${id.replace(/__/g, "")}`;
    const wrap = h(
      "div",
      { class: "aceite", "data-aceite": id },
      h(
        "label",
        { class: "aceite-label", for: inputId },
        h("input", {
          type: "checkbox",
          id: inputId,
          checked: marcado,
          on: {
            change: (e) => {
              aoMudar(e.target.checked);
              wrap.classList.toggle("marcado", e.target.checked);
            },
          },
        }),
        h(
          "span",
          { class: "aceite-texto" },
          h("strong", {}, titulo),
          descricao ? h("small", {}, descricao) : null
        )
      ),
      h("p", { class: "campo-erro", id: `erro_${id}`, role: "alert", hidden: true })
    );
    wrap.classList.toggle("marcado", marcado);
    return wrap;
  }

  // ----------------------------------------------------------
  // Revisão
  // ----------------------------------------------------------
  renderRevisao() {
    this.conteudo.append(
      this.cabecalhoPasso(
        "Revise seus dados",
        "Confira as informações antes de assinar. Toque em “Editar” para corrigir qualquer campo."
      )
    );

    const ctx = this.contexto();
    for (const secao of this.template.secoes) {
      if (secao.condicional?.tipo === "menor_idade" && !this.menorIdade) continue;
      if (secao.condicional?.tipo === "maior_idade" && this.menorIdade) continue;

      const camposVisiveis = secao.campos.filter((c) => campoVisivel(c, ctx));
      if (camposVisiveis.length === 0) continue;

      const card = h(
        "div",
        { class: "card card-revisao" },
        h(
          "div",
          { class: "revisao-topo" },
          h("h3", { class: "card-titulo" }, secao.titulo),
          h(
            "button",
            {
              type: "button",
              class: "link-editar",
              on: { click: () => this.irParaSecao(secao.id) },
            },
            "Editar"
          )
        )
      );

      const lista = h("dl", { class: "revisao-lista" });
      for (const campo of camposVisiveis) {
        lista.append(
          h("dt", {}, campo.label),
          h("dd", {}, this.formatarValor(campo, this.dados[campo.id]))
        );
      }
      card.append(lista);
      this.conteudo.append(card);
    }

    const aceites = h(
      "div",
      { class: "card card-revisao" },
      h("h3", { class: "card-titulo" }, "Consentimentos"),
      h(
        "ul",
        { class: "lista-consent" },
        h("li", {}, this.consent.termo ? "✓ Termo de consentimento aceito" : "— Termo pendente"),
        h("li", {}, this.consent.lgpd ? "✓ Tratamento de dados autorizado (LGPD)" : "— LGPD pendente"),
        ...(this.template.consentimentos_extras ?? []).map((extra) =>
          h(
            "li",
            {},
            this.consent.extras[extra.id]
              ? `✓ ${extra.label}`
              : `${extra.obrigatorio ? "—" : "○"} ${extra.label}`
          )
        )
      )
    );
    this.conteudo.append(aceites);

    this.conteudo.append(
      this.acoes({ voltar: true, rotulo: "Ir para assinatura", aoAvancar: () => this.proximo() })
    );
  }

  formatarValor(campo, valor) {
    if (valorVazio(valor)) return h("span", { class: "vazio" }, "Não informado");

    if (campo.tipo === "upload") {
      return h("span", { class: "valor-arquivo" }, valor.nome ?? "Arquivo anexado");
    }
    if (valor === "Sim" && campo.alerta_sim) {
      return h("span", { class: "badge-sim" }, "Sim · atenção");
    }
    if (Array.isArray(valor)) return valor.join(", ");
    if (campo.tipo === "date") return formatarDataBR(valor);
    if (campo.tipo === "cpf") return mascararCPF(valor);
    if (campo.tipo === "number" && /valor/i.test(campo.id)) {
      const n = Number(valor);
      if (Number.isFinite(n)) {
        return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      }
    }
    return String(valor);
  }

  // ----------------------------------------------------------
  // Assinatura
  // ----------------------------------------------------------
  renderAssinatura() {
    this.pendingPads = [];
    this.conteudo.append(
      this.cabecalhoPasso(
        "Assinatura",
        "Assine com o dedo, a caneta ou o mouse. A assinatura será vinculada ao conteúdo revisado."
      )
    );

    const nome = this.dados.nome ?? "";
    const cpf = this.dados.cpf ? mascararCPF(this.dados.cpf) : "";
    const declaracao = h(
      "div",
      { class: "declaracao" },
      h("p", {}, "Ao assinar, declaro que li e concordo com o termo de consentimento e com a política de privacidade, e que as informações fornecidas são verdadeiras."),
      h(
        "p",
        { class: "declaracao-nome" },
        h("strong", {}, nome || "Cliente"),
        cpf ? ` · CPF ${cpf}` : ""
      )
    );

    const cardCliente = this.criarCardAssinatura({
      papel: "cliente",
      titulo: this.menorIdade ? "Assinatura do cliente (menor)" : "Assinatura do cliente",
      nome,
    });

    this.conteudo.append(declaracao, cardCliente);

    if (this.menorIdade) {
      const nomeResp = this.dados.responsavel_nome ?? "";
      this.conteudo.append(
        h(
          "div",
          { class: "aviso aviso-menor" },
          h("strong", {}, "Autorização do responsável legal"),
          h(
            "span",
            {},
            this.permitePendencia
              ? "O responsável pode assinar agora ou enviar a documentação depois, sem travar o atendimento."
              : "O responsável deve assinar abaixo para validar o procedimento."
          )
        )
      );
      this.conteudo.append(
        this.criarCardAssinatura({
          papel: "responsavel",
          titulo: "Assinatura do responsável legal",
          nome: nomeResp,
        })
      );

      if (this.permitePendencia) {
        const inputPend = h("input", {
          type: "checkbox",
          id: "aceite_pendencia_responsavel",
          checked: this.pendenciaResponsavel,
          on: {
            change: (e) => {
              this.pendenciaResponsavel = e.target.checked;
              this.limparErro("__assinatura_responsavel");
              this.limparErro("__pendencia_responsavel");
            },
          },
        });
        const bloco = h(
          "div",
          { class: "aceite aceite-pendencia" },
          h(
            "label",
            { class: "aceite-label", for: "aceite_pendencia_responsavel" },
            inputPend,
            h(
              "span",
              { class: "aceite-texto" },
              h("strong", {}, "Vou enviar a documentação do responsável depois"),
              h(
                "small",
                {},
                "A ficha fica registrada como pendente. O estabelecimento recebe um alerta para cobrar a documentação."
              )
            )
          ),
          h("p", { class: "campo-erro", id: "erro___pendencia_responsavel", role: "alert", hidden: true })
        );
        bloco.classList.toggle("marcado", this.pendenciaResponsavel);
        inputPend.addEventListener("change", () => bloco.classList.toggle("marcado", inputPend.checked));
        this.conteudo.append(bloco);
      }
    }

    this.conteudo.append(
      h(
        "p",
        { class: "nota-assinatura" },
        "Registro de segurança: identificação do conteúdo assinado, data, hora e dispositivo. "
      )
    );

    const acoes = h("div", { class: "acoes" });
    acoes.append(
      h(
        "button",
        { type: "button", class: "btn btn-secundario", on: { click: () => this.voltar() } },
        h("span", { html: ICONE_VOLTAR }),
        "Voltar"
      )
    );
    this.botaoFinalizar = h(
      "button",
      {
        type: "button",
        class: "btn btn-primario",
        on: { click: () => this.enviar() },
      },
      "Finalizar e assinar",
      h("span", { html: ICONE_CHECK })
    );
    acoes.append(this.botaoFinalizar);
    this.conteudo.append(acoes);
    this.inicializarPads();
  }

  inicializarPads() {
    for (const { papel, canvas, placeholder, limpar } of this.pendingPads ?? []) {
      if (!canvas.isConnected) continue;
      const pad = new SignaturePad(canvas, { placeholder });
      this.pads[papel] = pad;
      limpar.addEventListener("click", () => {
        pad.limpar();
        this.limparErro(`__assinatura_${papel}`);
      });
    }
    this.pendingPads = [];
  }

  criarCardAssinatura({ papel, titulo, nome }) {
    const wrap = h("div", { class: "card card-assinatura" });
    wrap.append(h("h3", { class: "card-titulo" }, titulo));

    const area = h("div", { class: "assinatura-area" });
    const canvas = h("canvas", {
      class: "assinatura-canvas",
      tabindex: "0",
      "aria-label": `Área de assinatura — ${titulo}`,
    });
    const placeholder = h(
      "div",
      { class: "assinatura-placeholder", "aria-hidden": "true" },
      h("span", { html: ICONE_CANETA }),
      h("span", {}, "Assine aqui")
    );
    area.append(canvas, placeholder);

    const limpar = h(
      "button",
      { type: "button", class: "btn-limpar" },
      "Limpar assinatura"
    );

    const erro = h("p", {
      class: "campo-erro",
      id: `erro___assinatura_${papel}`,
      role: "alert",
      hidden: true,
    });

    wrap.append(area, h("div", { class: "assinatura-rodape" }, h("span", { class: "assinatura-nome" }, nome || " "), limpar), erro);

    this.pendingPads.push({ papel, canvas, placeholder, limpar });
    return wrap;
  }

  // ----------------------------------------------------------
  // Envio
  // ----------------------------------------------------------
  coletarPayload() {
    const hoje = new Date();
    const dados = sanitizarRespostas(this.template, this.dados, {
      hoje,
      contextoExtra: { menorIdade: this.menorIdade },
    });

    const termo = renderizarTexto(this.template.termo_texto, {
      nome_negocio: this.tenant.nome_negocio,
      retencao_anos: this.tenant.retencao_anos,
      email_contato: this.tenant.email_contato,
    });
    const lgpd = renderizarTexto(this.template.consentimento_lgpd, {
      nome_negocio: this.tenant.nome_negocio,
      retencao_anos: this.tenant.retencao_anos,
      email_contato: this.tenant.email_contato,
    });

    const assinaturas = [
      {
        papel: "cliente",
        imagem_base64: this.pads.cliente?.paraDataURL(),
        timestamp: new Date().toISOString(),
      },
    ];
    if (this.menorIdade && this.pads.responsavel?.paraDataURL()) {
      assinaturas.push({
        papel: "responsavel",
        imagem_base64: this.pads.responsavel.paraDataURL(),
        timestamp: new Date().toISOString(),
      });
    }

    const consentimentos = [
      { tipo: "termo", aceito: true, texto_aceito: termo, versao: String(this.template.versao ?? 1) },
      { tipo: "lgpd", aceito: true, texto_aceito: lgpd, versao: String(this.template.versao ?? 1) },
    ];

    for (const extra of this.template.consentimentos_extras ?? []) {
      consentimentos.push({
        tipo: `extra:${extra.id}`,
        aceito: Boolean(this.consent.extras[extra.id]),
        texto_aceito: extra.label,
        versao: String(this.template.versao ?? 1),
      });
    }

    return {
      tenant_slug: this.tenant.slug,
      template_slug: this.template.nicho_slug,
      formulario_id: this.config.formulario?.id,
      dados,
      assinaturas,
      consentimentos,
      meta: {
        iniciado_em: this.iniciadoEm,
        concluido_em: new Date().toISOString(),
        user_agent: navigator.userAgent,
        idioma: navigator.language,
        menor_idade: this.menorIdade,
        pendencia_documentacao: this.menorIdade && this.pendenciaResponsavel,
        modo_demo: this.demo,
      },
    };
  }

  async enviar() {
    if (this.enviando) return;
    if (!this.validarAssinatura()) return;

    const auditoria = this.validarTudo();
    if (!auditoria.ok) {
      const primeiro = Object.keys(auditoria.erros)[0];
      const campo = primeiro ? this.mapaCampos.get(primeiro) : null;
      const passo = campo
        ? this.passos.findIndex((p) => p.secao?.campos?.some((c) => c.id === campo.id))
        : -1;
      if (passo >= 0) {
        this.passoIdx = passo;
        this.render();
        this.mostrarAlerta("Há campos pendentes. Confira os destaques em vermelho.");
      } else {
        this.mostrarAlerta("Confira os consentimentos obrigatórios antes de finalizar.");
        this.passoIdx = this.passos.findIndex((p) => p.tipo === "termo");
        this.render();
      }
      return;
    }

    this.enviando = true;
    this.mostrarOverlay(true);
    if (this.botaoFinalizar) this.botaoFinalizar.disabled = true;

    const payload = this.coletarPayload();

    try {
      if (this.demo) {
        await new Promise((resolve) => setTimeout(resolve, 900));
        this.mostrarSucesso({
          protocolo: `DEMO-${Date.now().toString(36).toUpperCase()}`,
          demo: true,
        });
      } else {
        const resposta = await enviarFicha(payload);
        this.mostrarSucesso({
          protocolo: resposta.protocolo,
          status: resposta.status,
          linkComplemento: resposta.link_complemento,
          demo: false,
        });
      }
    } catch (err) {
      this.mostrarOverlay(false);
      this.enviando = false;
      if (this.botaoFinalizar) this.botaoFinalizar.disabled = false;

      if (err.detalhes && typeof err.detalhes === "object") {
        this.erros = { ...this.erros, ...err.detalhes };
        this.mostrarAlerta(err.message ?? "Confira os campos destacados.");
      } else {
        this.mostrarAlerta(
          err.message ??
            "Não foi possível enviar sua ficha. Verifique a conexão e tente novamente."
        );
      }
    }
  }

  mostrarOverlay(mostrar) {
    this.overlay.hidden = !mostrar;
    document.body.classList.toggle("sem-scroll", mostrar);
  }

  mostrarSucesso({ protocolo, demo, status, linkComplemento }) {
    this.mostrarOverlay(false);
    document.body.classList.remove("sem-scroll");
    this.etapas.hidden = true;
    this.barra.parentElement.hidden = true;

    this.assinaturaImagens = {
      cliente: this.pads.cliente?.paraDataURL(),
      responsavel: this.pads.responsavel?.paraDataURL(),
    };

    const pendente = status === "pendente_documentacao" || this.pendenciaResponsavel;
    const mensagem = demo
      ? "Esta foi uma demonstração. Nenhum dado foi enviado ou armazenado."
      : pendente
        ? "Ficha registrada provisoriamente. Falta apenas a documentação do responsável legal."
        : "O estabelecimento já recebeu sua ficha. O PDF será organizado automaticamente.";

    this.conteudo.replaceChildren(
      h(
        "div",
        { class: "sucesso" },
        h("div", { class: "sucesso-anel", "aria-hidden": "true" }, h("span", { html: ICONE_CHECK })),
        h("h2", { class: "sucesso-titulo" }, pendente ? "Ficha registrada!" : "Ficha concluída!"),
        h("p", { class: "sucesso-desc" }, mensagem),
        h(
          "div",
          { class: "sucesso-protocolo" },
          h("span", {}, "Protocolo"),
          h("strong", {}, protocolo ?? "—")
        ),
        pendente && !demo
          ? h(
              "div",
              { class: "aviso aviso-menor" },
              h("strong", {}, "Próximo passo: documentação do responsável"),
              h(
                "span",
                {},
                "Você pode enviar a autorização depois pelo link de complemento ou diretamente ao estabelecimento. Nada trava o atendimento."
              ),
              linkComplemento
                ? h(
                    "a",
                    { class: "btn btn-secundario", href: linkComplemento },
                    "Enviar documentação depois"
                  )
                : null
            )
          : null,
        h(
          "p",
          { class: "sucesso-nota" },
          pendente
            ? "Guarde o protocolo. O estabelecimento consegue acompanhar a pendência pelo painel."
            : "Agora é só avisar o profissional que você concluiu o preenchimento."
        ),
        h(
          "div",
          { class: "sucesso-acoes" },
          h(
            "button",
            {
              type: "button",
              class: "btn btn-primario",
              on: { click: () => this.imprimirComprovante(protocolo, demo) },
            },
            "Imprimir comprovante"
          ),
          h(
            "button",
            {
              type: "button",
              class: "btn btn-secundario",
              on: { click: () => window.location.reload() },
            },
            "Nova ficha"
          ),
          h(
            "a",
            {
              class: "btn btn-secundario",
              href: SUPORTE_WHATSAPP.url(
                `Olá! Preciso de ajuda com a ficha ${protocolo ?? ""} de ${this.tenant.nome_negocio ?? "um estabelecimento"}.`
              ),
              target: "_blank",
              rel: "noopener noreferrer",
            },
            "Falar com o suporte"
          )
        ),
        this.montarVitrine()
      )
    );

    this.montarComprovante(protocolo, demo);
  }

  montarVitrine() {
    const nicho = this.template.nicho_slug;
    const produtos = this.produtos ?? produtosPara(nicho, 3);
    if (!produtos?.length) return null;
    const base = this.config.ficha_base ?? "https://zapfichas.github.io/ficha";
    const grid = h("div", { class: "vitrine-grid" });
    for (const produto of produtos) {
      const link = produto.em_breve ? null : linkProduto(produto, { fichaBase: base });
      const card = h(
        link ? "a" : "div",
        {
          class: `vitrine-card${produto.em_breve ? " em-breve" : ""}`,
          href: link,
          target: link ? "_blank" : null,
          rel: link ? "noopener noreferrer" : null,
        },
        h("strong", {}, produto.nome),
        h("span", {}, produto.descricao),
        h("small", {}, produto.em_breve ? "Em breve" : "Conhecer →")
      );
      grid.append(card);
    }
    return h(
      "section",
      { class: "vitrine" },
      h("p", { class: "vitrine-kicker" }, "Também pode ser útil"),
      h("h3", {}, "Uma ficha feita para o seu tipo de atendimento"),
      h(
        "p",
        { class: "vitrine-desc" },
        "Conheça as outras soluções FichaPro. Indique para um colega e ajude a espalhar menos papel."
      ),
      grid
    );
  }

  montarComprovante(protocolo, demo) {
    const agora = new Date();
    this.comprovante.replaceChildren();
    this.comprovante.append(
      h(
        "div",
        { class: "comprovante-topo" },
        h("p", { class: "comprovante-marca" }, this.tenant.nome_negocio ?? ""),
        h("h1", {}, this.template.nome),
        h("p", { class: "comprovante-protocolo" }, `Protocolo ${protocolo ?? "—"} · ${formatarDataHoraBR(agora)}`)
      )
    );

    const ctx = this.contexto();
    for (const secao of this.template.secoes) {
      if (secao.condicional?.tipo === "menor_idade" && !this.menorIdade) continue;
      const campos = secao.campos.filter((c) => campoVisivel(c, ctx));
      if (!campos.length) continue;
      this.comprovante.append(h("h2", {}, secao.titulo));
      const dl = h("dl", { class: "comprovante-lista" });
      for (const campo of campos) {
        const valor = this.dados[campo.id];
        const texto = valorVazio(valor)
          ? "Não informado"
          : campo.tipo === "upload"
            ? valor.nome
            : Array.isArray(valor)
              ? valor.join(", ")
              : campo.tipo === "date"
                ? formatarDataBR(valor)
                : campo.tipo === "cpf"
                  ? mascararCPF(valor)
                  : String(valor);
        dl.append(h("dt", {}, campo.label), h("dd", {}, texto));
      }
      this.comprovante.append(dl);
    }

    this.comprovante.append(h("h2", {}, "Assinaturas"));
    const assinaturas = h("div", { class: "comprovante-assinaturas" });
    for (const [papel, imagem] of Object.entries(this.assinaturaImagens)) {
      if (!imagem) continue;
      assinaturas.append(
        h(
          "figure",
          {},
          h("img", { src: imagem, alt: papel === "cliente" ? "Assinatura do cliente" : "Assinatura do responsável" }),
          h("figcaption", {}, papel === "cliente" ? this.dados.nome : this.dados.responsavel_nome)
        )
      );
    }
    this.comprovante.append(assinaturas);
    this.comprovante.append(
      h(
        "p",
        { class: "comprovante-rodape" },
        demo
          ? "Demonstração — nenhum dado foi enviado ou armazenado."
          : `Documento gerado eletronicamente por ${this.tenant.nome_negocio}. O PDF final é gerado pelo sistema com registro de segurança (identificação do conteúdo, data/hora, IP e dispositivo).`
      )
    );
  }

  imprimirComprovante() {
    this.comprovante.hidden = false;
    const aoDepois = () => {
      this.comprovante.hidden = true;
      window.removeEventListener("afterprint", aoDepois);
    };
    window.addEventListener("afterprint", aoDepois);
    window.print();
    // Fallback para navegadores que não disparam afterprint.
    setTimeout(() => {
      if (!this.comprovante.hidden) this.comprovante.hidden = true;
    }, 60000);
  }
}
