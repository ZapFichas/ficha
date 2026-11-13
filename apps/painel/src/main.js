import QRCode from "qrcode";
import { mascararCPF } from "@fichapro/shared";
import { api, baixarPdf, ApiError } from "./api.js";
import { CONFIG, configurado, NICHOS, STATUS } from "./config.js";
import { sessaoAtual, supabase } from "./supabase.js";
import {
  copiar,
  formatarData,
  formatarDataHora,
  formatarMoeda,
  h,
  hexParaRgb,
  iniciais,
  slugify,
  toast,
} from "./ui.js";
import "./styles.css";

const app = document.getElementById("app");

const state = {
  session: null,
  usuario: null,
  tenant: null,
  template: null,
  formulario: null,
  stats: null,
  fichas: [],
  proximoCursor: null,
  filtros: { q: "", status: "" },
  view: "fichas",
  linkFicha: "",
  drive: null,
  carregandoApp: false,
  onboardingSlugOk: null,
  authTab: "login",
};

function limparEstado() {
  Object.assign(state, {
    session: null,
    usuario: null,
    tenant: null,
    template: null,
    formulario: null,
    stats: null,
    fichas: [],
    proximoCursor: null,
    filtros: { q: "", status: "" },
    view: "fichas",
    linkFicha: "",
    drive: null,
    carregandoApp: false,
  });
}

// ------------------------------------------------------------
// Bootstrap
// ------------------------------------------------------------
async function init() {
  if (!configurado) {
    renderConfiguracaoFaltando();
    return;
  }

  const sessao = await sessaoAtual();
  state.session = sessao;

  supabase.auth.onAuthStateChange((evento, session) => {
    state.session = session;
    if (evento === "SIGNED_OUT") {
      limparEstado();
      renderAuth();
      return;
    }
    if ((evento === "SIGNED_IN" || evento === "INITIAL_SESSION") && session) {
      // Deferir evita o deadlock do Supabase ao chamar auth.* dentro do callback.
      setTimeout(() => {
        iniciarPainel();
      }, 0);
    }
  });

  if (sessao) await iniciarPainel();
  else renderAuth();
}

function renderConfiguracaoFaltando() {
  app.replaceChildren(
    h(
      "div",
      { class: "tela-config" },
      h(
        "div",
        { class: "tela-config-card" },
        h("p", { class: "kicker" }, "Configuração necessária"),
        h("h1", {}, "Conecte o painel ao Supabase"),
        h(
          "p",
          {},
          "Defina as variáveis de ambiente no build (Cloudflare Pages) ou o objeto de runtime antes do bundle."
        ),
        h(
          "pre",
          {},
          `VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_BASE=https://seu-worker.workers.dev`
        ),
        h(
          "p",
          { class: "muted" },
          "Em runtime: window.__PAINEL_CONFIG__ = { supabaseUrl, supabaseAnonKey, apiBase }."
        ),
        h("p", { class: "muted" }, "Veja docs/runbook.md para o passo a passo.")
      )
    )
  );
}

// ------------------------------------------------------------
// Autenticação
// ------------------------------------------------------------
function renderAuth(tab = state.authTab, mensagem = "") {
  state.authTab = tab;
  app.replaceChildren();

  const erro = h("div", { class: "auth-erro", role: "alert", hidden: !mensagem }, mensagem);

  const email = h("input", {
    class: "entrada-painel",
    type: "email",
    id: "auth-email",
    autocomplete: "email",
    placeholder: "voce@estudio.com",
    required: true,
  });
  const senha = h("input", {
    class: "entrada-painel",
    type: "password",
    id: "auth-senha",
    autocomplete: tab === "login" ? "current-password" : "new-password",
    placeholder: "Mínimo 8 caracteres",
    required: true,
    minlength: "8",
  });
  const nome = h("input", {
    class: "entrada-painel",
    type: "text",
    id: "auth-nome",
    autocomplete: "name",
    placeholder: "Seu nome",
  });

  const botao = h(
    "button",
    { class: "btn-painel btn-primario-painel", type: "submit" },
    tab === "login" ? "Entrar" : "Criar conta"
  );

  const form = h(
    "form",
    { class: "auth-form" },
    tab === "signup" ? grupo("Seu nome", nome) : null,
    grupo("E-mail", email),
    grupo("Senha", senha),
    erro,
    botao,
    h(
      "button",
      {
        type: "button",
        class: "btn-painel btn-secundario-painel",
        on: { click: () => loginGoogle() },
      },
      "Continuar com Google"
    ),
    tab === "login"
      ? h(
          "button",
          {
            type: "button",
            class: "link-painel",
            on: { click: () => recuperarSenha(email.value) },
          },
          "Esqueci minha senha"
        )
      : h(
          "p",
          { class: "auth-nota" },
          "Ao criar a conta você concorda com os termos de uso e a política de privacidade."
        )
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    erro.hidden = true;
    botao.disabled = true;
    botao.textContent = tab === "login" ? "Entrando…" : "Criando…";
    try {
      if (tab === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.value.trim(),
          password: senha.value,
        });
        if (error) throw error;
        await iniciarPainel();
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.value.trim(),
          password: senha.value,
          options: { data: { nome: nome.value.trim() } },
        });
        if (error) throw error;
        if (!data.session) {
          renderAuth(
            "login",
            "Conta criada. Confirme o e-mail enviado pelo Supabase e depois entre."
          );
          return;
        }
        await iniciarPainel();
      }
    } catch (err) {
      erro.textContent = traduzirErroAuth(err);
      erro.hidden = false;
    } finally {
      botao.disabled = false;
      botao.textContent = tab === "login" ? "Entrar" : "Criar conta";
    }
  });

  const card = h(
    "div",
    { class: "auth-card" },
    h("p", { class: "kicker" }, "FichaPro"),
    h("h1", {}, tab === "login" ? "Entrar no painel" : "Criar sua conta"),
    h(
      "p",
      { class: "auth-sub" },
      tab === "login"
        ? "Gerencie fichas, PDFs e a configuração do seu estúdio."
        : "Leva menos de 2 minutos. O restante do onboarding é guiado."
    ),
    h(
      "div",
      { class: "auth-tabs" },
      h(
        "button",
        {
          type: "button",
          class: `auth-tab ${tab === "login" ? "ativa" : ""}`,
          on: { click: () => renderAuth("login") },
        },
        "Entrar"
      ),
      h(
        "button",
        {
          type: "button",
          class: `auth-tab ${tab === "signup" ? "ativa" : ""}`,
          on: { click: () => renderAuth("signup") },
        },
        "Criar conta"
      )
    ),
    form
  );

  const esquerda = h(
    "aside",
    { class: "auth-hero" },
    h("p", { class: "kicker claro" }, "Ficha digital · assinatura · Drive"),
    h("h2", {}, "Menos papel. Mais controle."),
    h(
      "p",
      {},
      "O cliente preenche e assina no celular. O PDF chega organizado no seu Google Drive, com trilha de auditoria."
    ),
    h(
      "ul",
      { class: "auth-lista" },
      h("li", {}, "QR code para o cliente"),
      h("li", {}, "Anamnese + termo + LGPD"),
      h("li", {}, "Autorização de menor"),
      h("li", {}, "PDF com hash, IP e data/hora")
    )
  );

  app.append(h("div", { class: "auth-tela" }, esquerda, card));
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

function traduzirErroAuth(err) {
  const msg = err?.message ?? "Não foi possível autenticar.";
  if (/invalid login credentials/i.test(msg)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(msg)) return "Confirme seu e-mail antes de entrar.";
  if (/password should be at least/i.test(msg)) return "A senha precisa de pelo menos 8 caracteres.";
  if (/user already registered/i.test(msg)) return "Este e-mail já tem conta. Tente entrar.";
  return msg;
}

async function loginGoogle() {
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
    if (error) throw error;
  } catch (err) {
    renderAuth(state.authTab, "Login com Google indisponível. Use e-mail e senha.");
  }
}

async function recuperarSenha(email) {
  if (!email || !email.includes("@")) {
    toast("Digite seu e-mail primeiro.", "erro");
    return;
  }
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: window.location.origin + window.location.pathname,
  });
  toast(
    error ? error.message : "Enviamos um link de recuperação para seu e-mail.",
    error ? "erro" : "ok"
  );
}

// ------------------------------------------------------------
// Painel
// ------------------------------------------------------------
async function iniciarPainel() {
  if (state.carregandoApp) return;
  state.carregandoApp = true;

  try {
    const sessao = await sessaoAtual();
    if (!sessao) {
      renderAuth();
      return;
    }
    state.session = sessao;

    telaCarregando("Carregando seu painel…");

    const status = await api("/api/onboarding/status");
    if (!status.vinculado) {
      renderOnboarding(status);
      return;
    }

    const [me, form, stats, fichas] = await Promise.all([
      api("/api/panel/me"),
      api("/api/panel/formulario"),
      api("/api/panel/stats"),
      api("/api/panel/fichas?limite=25"),
    ]);

    state.usuario = me.usuario;
    state.tenant = me.tenant;
    state.linkFicha = me.link_ficha;
    state.template = form.template;
    state.formulario = form.formulario;
    state.stats = stats;
    state.fichas = fichas.itens ?? [];
    state.proximoCursor = fichas.proximo_cursor ?? null;

    const rota = window.location.hash.replace(/^#\/?/, "");
    state.view = rota === "configuracoes" ? "configuracoes" : "fichas";

    renderShell();

    const params = new URLSearchParams(window.location.search);
    if (params.get("drive") === "conectado") {
      toast("Google Drive conectado.");
      window.history.replaceState({}, "", window.location.pathname + window.location.hash);
    } else if (params.get("drive") === "erro") {
      toast(`Falha ao conectar o Drive: ${params.get("motivo") ?? "erro"}`, "erro");
      window.history.replaceState({}, "", window.location.pathname + window.location.hash);
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) {
      renderAuth("login", "Sua sessão expirou. Entre novamente.");
      return;
    }
    if (err instanceof ApiError && err.status === 403) {
      renderOnboarding({ vinculado: false });
      return;
    }
    console.error(err);
    telaErroApp(err.message ?? "Não foi possível carregar o painel.");
  } finally {
    state.carregandoApp = false;
  }
}

function telaCarregando(texto = "Carregando…") {
  app.replaceChildren(
    h(
      "div",
      { class: "painel-loading" },
      h("div", { class: "loader" }),
      h("p", {}, texto)
    )
  );
}

function telaErroApp(msg) {
  app.replaceChildren(
    h(
      "div",
      { class: "tela-config" },
      h(
        "div",
        { class: "tela-config-card" },
        h("h1", {}, "Algo deu errado"),
        h("p", {}, msg),
        h(
          "div",
          { class: "acoes-painel" },
          h(
            "button",
            {
              class: "btn-painel btn-primario-painel",
              on: { click: () => iniciarPainel() },
            },
            "Tentar novamente"
          ),
          h(
            "button",
            {
              class: "btn-painel btn-secundario-painel",
              on: { click: () => sair() },
            },
            "Sair"
          )
        )
      )
    )
  );
}

async function sair() {
  await supabase.auth.signOut();
  limparEstado();
  renderAuth();
}

function renderShell() {
  app.replaceChildren();
  const tenant = state.tenant;
  const marcaCor = tenant?.branding?.cor_primaria ?? "#4F7963";
  document.documentElement.style.setProperty("--primaria", marcaCor);
  document.documentElement.style.setProperty(
    "--secundaria",
    tenant?.branding?.cor_secundaria ?? marcaCor
  );
  const rgb = hexParaRgb(marcaCor);
  if (rgb) {
    document.documentElement.style.setProperty(
      "--primaria-rgb",
      `${rgb.r}, ${rgb.g}, ${rgb.b}`
    );
  }

  const logo = tenant?.branding?.logo_url
    ? h("img", { src: tenant.branding.logo_url, alt: "" })
    : h("span", {}, iniciais(tenant?.nome_negocio));

  const statusPlano =
    tenant?.status === "trial"
      ? "Trial"
      : tenant?.status === "ativo"
        ? tenant?.plano ?? "Ativo"
        : tenant?.status ?? "";

  const topo = h(
    "header",
    { class: "painel-topo" },
    h(
      "div",
      { class: "painel-topo-interno" },
      h(
        "div",
        { class: "painel-marca" },
        h("div", { class: "painel-logo", style: `background:${marcaCor}` }, logo),
        h(
          "div",
          {},
          h("strong", {}, "FichaPro"),
          h("span", {}, tenant?.nome_negocio ?? "")
        )
      ),
      h(
        "div",
        { class: "painel-topo-acoes" },
        h("span", { class: `badge-plano ${tenant?.status ?? ""}` }, statusPlano),
        h("a", { class: "btn-painel btn-secundario-painel btn-pequeno", href: state.linkFicha, target: "_blank", rel: "noopener" }, "Abrir ficha"),
        h(
          "div",
          { class: "painel-usuario" },
          h("span", { title: state.usuario?.email }, iniciais(state.usuario?.nome ?? state.usuario?.email)),
          h(
            "button",
            { class: "link-painel", on: { click: () => sair() } },
            "Sair"
          )
        )
      )
    ),
    h(
      "nav",
      { class: "painel-nav", "aria-label": "Navegação principal" },
      h(
        "button",
        {
          class: `painel-nav-item ${state.view === "fichas" ? "ativa" : ""}`,
          on: { click: () => navegar("fichas") },
        },
        "Fichas"
      ),
      h(
        "button",
        {
          class: `painel-nav-item ${state.view === "configuracoes" ? "ativa" : ""}`,
          on: { click: () => navegar("configuracoes") },
        },
        "Configurações"
      )
    )
  );

  const conteudo = h("main", { class: "painel-conteudo", id: "conteudo-painel" });
  const rodape = h(
    "footer",
    { class: "painel-rodape" },
    h("span", {}, "FichaPro · ficha digital com trilha de auditoria"),
    h("span", {}, state.usuario?.email ?? "")
  );

  app.append(topo, conteudo, rodape);
  renderView();
}

function navegar(view) {
  state.view = view;
  window.location.hash = view === "configuracoes" ? "#/configuracoes" : "#/fichas";
  renderShell();
}

function renderView() {
  const container = document.getElementById("conteudo-painel");
  if (!container) return;
  container.replaceChildren();
  if (state.view === "configuracoes") renderConfiguracoes(container);
  else renderFichas(container);
}

// ------------------------------------------------------------
// Fichas
// ------------------------------------------------------------
function renderFichas(container) {
  const stats = state.stats ?? {};

  const cabecalho = h(
    "div",
    { class: "pagina-topo" },
    h(
      "div",
      {},
      h("p", { class: "kicker" }, "Operação"),
      h("h1", {}, "Fichas"),
      h("p", { class: "pagina-sub" }, "Acompanhe o preenchimento, o PDF e a trilha de assinatura.")
    ),
    h(
      "div",
      { class: "acoes-painel" },
      h(
        "button",
        {
          class: "btn-painel btn-secundario-painel",
          on: { click: () => atualizarTudo() },
        },
        "Atualizar"
      ),
      h(
        "a",
        {
          class: "btn-painel btn-secundario-painel",
          href: state.linkFicha,
          target: "_blank",
          rel: "noopener",
        },
        "Abrir ficha"
      )
    )
  );

  const cards = h(
    "div",
    { class: "stats-grid" },
    statCard("Total", stats.total ?? 0),
    statCard("Concluídas", stats.salvas ?? 0, "sucesso"),
    statCard("Processando", stats.processando ?? 0, "processando"),
    statCard("Últimos 30 dias", stats.ultimos_30_dias ?? 0)
  );

  const qrCanvas = h("canvas", { class: "qr-canvas", width: "200", height: "200" });
  const linkCurto = state.linkFicha.replace(/^https?:\/\//, "");
  const qrCard = h(
    "div",
    { class: "painel-card qr-card" },
    h("div", { class: "qr-wrap" }, qrCanvas),
    h(
      "div",
      { class: "qr-info" },
      h("h3", {}, "QR code do estúdio"),
      h("p", {}, "Imprima e deixe na recepção. O cliente aponta a câmera e preenche no navegador."),
      h("code", { class: "link-ficha" }, linkCurto),
      h(
        "div",
        { class: "acoes-painel" },
        h(
          "button",
          {
            class: "btn-painel btn-primario-painel btn-pequeno",
            on: { click: () => copiar(state.linkFicha) },
          },
          "Copiar link"
        ),
        h(
          "button",
          {
            class: "btn-painel btn-secundario-painel btn-pequeno",
            on: { click: () => baixarQR() },
          },
          "Baixar QR"
        )
      )
    )
  );

  const busca = h("input", {
    class: "entrada-painel",
    type: "search",
    placeholder: "Buscar por nome do cliente…",
    value: state.filtros.q,
    "aria-label": "Buscar ficha",
  });
  const statusSelect = h(
    "select",
    { class: "entrada-painel", "aria-label": "Filtrar por status" },
    h("option", { value: "" }, "Todos os status"),
    ...Object.entries(STATUS).map(([valor, cfg]) =>
      h("option", { value: valor, selected: state.filtros.status === valor }, cfg.rotulo)
    )
  );

  let timerBusca = null;
  busca.addEventListener("input", () => {
    state.filtros.q = busca.value;
    clearTimeout(timerBusca);
    timerBusca = setTimeout(() => carregarFichas(), 350);
  });
  statusSelect.addEventListener("change", () => {
    state.filtros.status = statusSelect.value;
    carregarFichas();
  });

  const filtros = h(
    "div",
    { class: "painel-card filtros-card" },
    h("div", { class: "filtros-linha" }, busca, statusSelect)
  );

  const lista = h("div", { class: "lista-fichas", id: "lista-fichas" });
  const listaCard = h(
    "div",
    { class: "painel-card" },
    h(
      "div",
      { class: "card-topo" },
      h("h3", {}, "Fichas recebidas"),
      h("span", { class: "muted", id: "contador-fichas" }, `${state.fichas.length} ficha(s)`)
    ),
    lista
  );

  container.append(cabecalho, cards, h("div", { class: "grid-fichas" }, qrCard, filtros), listaCard);

  desenharQR(qrCanvas, state.linkFicha);
  renderListaFichas(lista);
}

function statCard(titulo, valor, tom = "") {
  return h(
    "div",
    { class: `stat-card ${tom}` },
    h("span", { class: "stat-valor" }, String(valor)),
    h("span", { class: "stat-titulo" }, titulo)
  );
}

function renderListaFichas(container) {
  container.replaceChildren();
  const fichas = state.fichas;

  if (!fichas.length) {
    container.append(
      h(
        "div",
        { class: "vazio-painel" },
        h("div", { class: "vazio-icone" }, "📄"),
        h("h3", {}, "Nenhuma ficha por aqui ainda"),
        h("p", {}, "Compartilhe o link ou o QR code com o próximo cliente. A ficha aparece aqui assim que for enviada."),
        h(
          "button",
          {
            class: "btn-painel btn-primario-painel btn-pequeno",
            on: { click: () => copiar(state.linkFicha) },
          },
          "Copiar link da ficha"
        )
      )
    );
  } else {
    for (const ficha of fichas) {
      const cfg = STATUS[ficha.status] ?? { rotulo: ficha.status, classe: "neutro" };
      const detalhe = ficha.dados_json ?? {};
      container.append(
        h(
          "button",
          {
            class: "ficha-linha",
            type: "button",
            on: { click: () => abrirFicha(ficha.id) },
          },
          h("span", { class: "ficha-avatar" }, iniciais(ficha.cliente_nome)),
          h(
            "span",
            { class: "ficha-principal" },
            h("strong", {}, ficha.cliente_nome),
            h(
              "small",
              {},
              `${ficha.protocolo} · ${detalhe.profissional ?? "sem profissional"} · ${
                detalhe.data_procedimento ? formatarData(detalhe.data_procedimento) : formatarDataHora(ficha.criado_em)
              }`
            )
          ),
          h("span", { class: `badge-status ${cfg.classe}` }, cfg.rotulo),
          h("span", { class: "ficha-seta", "aria-hidden": "true" }, "→")
        )
      );
    }
  }

  const contador = document.getElementById("contador-fichas");
  if (contador) contador.textContent = `${fichas.length} ficha(s)`;

  if (state.proximoCursor) {
    container.append(
      h(
        "button",
        {
          class: "btn-painel btn-secundario-painel carregar-mais",
          on: { click: () => carregarFichas(true) },
        },
        "Carregar mais"
      )
    );
  }
}

async function carregarFichas(acumular = false) {
  const lista = document.getElementById("lista-fichas");
  if (!lista) return;
  lista.classList.add("carregando");

  try {
    const params = new URLSearchParams({ limite: "25" });
    if (state.filtros.q) params.set("q", state.filtros.q);
    if (state.filtros.status) params.set("status", state.filtros.status);
    if (acumular && state.proximoCursor) params.set("cursor", state.proximoCursor);

    const dados = await api(`/api/panel/fichas?${params.toString()}`);
    state.fichas = acumular ? [...state.fichas, ...(dados.itens ?? [])] : dados.itens ?? [];
    state.proximoCursor = dados.proximo_cursor ?? null;
    renderListaFichas(lista);
  } catch (err) {
    toast(err.message ?? "Não foi possível carregar as fichas.", "erro");
  } finally {
    lista.classList.remove("carregando");
  }
}

async function atualizarTudo() {
  try {
    const [stats, fichas] = await Promise.all([
      api("/api/panel/stats"),
      api("/api/panel/fichas?limite=25"),
    ]);
    state.stats = stats;
    state.fichas = fichas.itens ?? [];
    state.proximoCursor = fichas.proximo_cursor ?? null;
    renderFichas(document.getElementById("conteudo-painel"));
    toast("Painel atualizado.");
  } catch (err) {
    toast(err.message ?? "Falha ao atualizar.", "erro");
  }
}

async function desenharQR(canvas, link) {
  if (!canvas || !link) return;
  try {
    await QRCode.toCanvas(canvas, link, {
      width: 200,
      margin: 1,
      color: {
        dark: "#1d2b24",
        light: "#ffffff",
      },
    });
  } catch (err) {
    console.error("QR code:", err);
  }
}

async function baixarQR() {
  try {
    const dataUrl = await QRCode.toDataURL(state.linkFicha, {
      width: 800,
      margin: 2,
      color: {
        dark: "#1d2b24",
        light: "#ffffff",
      },
    });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `fichapro-qr-${state.tenant?.slug ?? "estudio"}.png`;
    a.click();
  } catch {
    toast("Não foi possível gerar o QR.", "erro");
  }
}

// ------------------------------------------------------------
// Modal de ficha
// ------------------------------------------------------------
async function abrirFicha(id) {
  const overlay = h("div", { class: "modal-overlay", role: "dialog", "aria-modal": "true" });
  const caixa = h("div", { class: "modal-ficha" });
  overlay.append(caixa);
  document.body.append(overlay);
  document.body.classList.add("sem-scroll");

  const fechar = () => {
    overlay.remove();
    document.body.classList.remove("sem-scroll");
  };

  const aoTecla = (e) => {
    if (e.key === "Escape") {
      fechar();
      document.removeEventListener("keydown", aoTecla);
    }
  };
  document.addEventListener("keydown", aoTecla);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) fechar();
  });

  caixa.append(
    h(
      "div",
      { class: "modal-loading" },
      h("div", { class: "loader" }),
      h("p", {}, "Abrindo ficha…")
    )
  );

  try {
    const dados = await api(`/api/panel/fichas/${id}`);
    caixa.replaceChildren(renderDetalheFicha(dados, fechar));
  } catch (err) {
    caixa.replaceChildren(
      h(
        "div",
        { class: "modal-erro" },
        h("h3", {}, "Não foi possível abrir"),
        h("p", {}, err.message ?? "Erro desconhecido."),
        h("button", { class: "btn-painel btn-secundario-painel", on: { click: fechar } }, "Fechar")
      )
    );
  }
}

function renderDetalheFicha({ ficha: registro, dados, assinaturas, consentimentos, anexos }, fechar) {
  const cfg = STATUS[registro.status] ?? { rotulo: registro.status, classe: "neutro" };
  const secoes = state.template?.campos_json?.secoes ?? [];
  const mapaCampos = new Map();
  for (const secao of secoes) {
    for (const campo of secao.campos ?? []) mapaCampos.set(campo.id, { ...campo, secao: secao.titulo });
  }

  const acoes = h(
    "div",
    { class: "acoes-painel" },
    registro.status === "salva"
      ? h(
          "button",
          {
            class: "btn-painel btn-primario-painel btn-pequeno",
            on: {
              click: async (e) => {
                e.target.disabled = true;
                try {
                  await baixarPdf(registro.id, registro.protocolo);
                } catch (err) {
                  toast(err.message ?? "Falha ao baixar o PDF.", "erro");
                } finally {
                  e.target.disabled = false;
                }
              },
            },
          },
          "Baixar PDF"
        )
      : null,
    registro.status === "erro" || registro.status === "preenchida"
      ? h(
          "button",
          {
            class: "btn-painel btn-secundario-painel btn-pequeno",
            on: {
              click: async () => {
                try {
                  await api(`/api/panel/fichas/${registro.id}/reprocessar`, { method: "POST" });
                  toast("Reprocessamento enfileirado.");
                  fechar();
                  atualizarTudo();
                } catch (err) {
                  toast(err.message ?? "Falha ao reprocessar.", "erro");
                }
              },
            },
          },
          "Reprocessar PDF"
        )
      : null,
    h(
      "button",
      { class: "btn-painel btn-secundario-painel btn-pequeno", on: { click: fechar } },
      "Fechar"
    )
  );

  const topo = h(
    "div",
    { class: "modal-topo" },
    h(
      "div",
      {},
      h("p", { class: "kicker" }, registro.protocolo),
      h("h2", {}, registro.cliente_nome),
      h(
        "p",
        { class: "muted" },
        `Recebida em ${formatarDataHora(registro.criado_em)} · ${registro.menor_idade ? "cliente menor de idade" : "cliente adulto"}`
      )
    ),
    h("span", { class: `badge-status ${cfg.classe}` }, cfg.rotulo)
  );

  const corpo = h("div", { class: "modal-corpo" });

  const resumo = h("div", { class: "detalhe-grid" });
  const resumoItens = [
    ["Profissional", dados.profissional ?? registro.dados_json?.profissional],
    ["Procedimento", registro.dados_json?.data_procedimento ? formatarData(registro.dados_json.data_procedimento) : null],
    ["Valor", registro.dados_json?.valor ? formatarMoeda(registro.dados_json.valor) : null],
    ["PDF gerado", registro.pdf_gerado_em ? formatarDataHora(registro.pdf_gerado_em) : "Pendente"],
  ];
  for (const [rotulo, valor] of resumoItens) {
    resumo.append(h("span", { class: "detalhe-rotulo" }, rotulo), h("span", {}, valor ?? "—"));
  }
  corpo.append(h("h3", { class: "detalhe-titulo" }, "Resumo"), resumo);

  if (secoes.length) {
    for (const secao of secoes) {
      const linhas = [];
      for (const campo of secao.campos ?? []) {
        const valor = dados[campo.id];
        if (valor === undefined || valor === null || valor === "") continue;
        if (typeof valor === "object" && !Array.isArray(valor) && !valor.nome) continue;
        linhas.push([campo.label, formatarValor(campo, valor)]);
      }
      if (!linhas.length) continue;
      const grid = h("div", { class: "detalhe-grid" });
      for (const [rotulo, valor] of linhas) {
        grid.append(h("span", { class: "detalhe-rotulo" }, rotulo), h("span", {}, valor));
      }
      corpo.append(h("h3", { class: "detalhe-titulo" }, secao.titulo), grid);
    }
  } else {
    const grid = h("div", { class: "detalhe-grid" });
    for (const [chave, valor] of Object.entries(dados)) {
      if (valor === null || valor === "" || typeof valor === "object") continue;
      grid.append(h("span", { class: "detalhe-rotulo" }, chave), h("span", {}, String(valor)));
    }
    corpo.append(h("h3", { class: "detalhe-titulo" }, "Dados"), grid);
  }

  const consent = h("div", { class: "detalhe-lista" });
  for (const c of consentimentos ?? []) {
    consent.append(
      h(
        "div",
        { class: "detalhe-item" },
        h("strong", {}, rotuloConsentimento(c.tipo)),
        h("span", {}, `${c.aceito ? "Aceito" : "Não aceito"} · ${formatarDataHora(c.timestamp)}`)
      )
    );
  }
  corpo.append(h("h3", { class: "detalhe-titulo" }, "Consentimentos"), consent);

  const assin = h("div", { class: "detalhe-lista" });
  for (const a of assinaturas ?? []) {
    assin.append(
      h(
        "div",
        { class: "detalhe-item" },
        h("strong", {}, a.papel === "cliente" ? "Assinatura do cliente" : "Assinatura do responsável"),
        h("span", {}, `${formatarDataHora(a.timestamp)} · IP ${a.ip ?? "—"}`),
        h("code", {}, a.hash_conteudo ?? "")
      )
    );
  }
  corpo.append(h("h3", { class: "detalhe-titulo" }, "Assinaturas"), assin);

  if (anexos?.length) {
    const anexosEl = h("div", { class: "detalhe-lista" });
    for (const a of anexos) {
      anexosEl.append(
        h(
          "div",
          { class: "detalhe-item" },
          h("strong", {}, a.tipo),
          h("span", {}, `${a.nome_arquivo ?? "arquivo"} · ${a.status}`)
        )
      );
    }
    corpo.append(h("h3", { class: "detalhe-titulo" }, "Anexos"), anexosEl);
  }

  const auditoria = h(
    "div",
    { class: "auditoria" },
    h("h3", { class: "detalhe-titulo" }, "Trilha de auditoria"),
    h("code", {}, `hash_pdf: ${registro.hash_pdf ?? "—"}`),
    h("code", {}, `IP: ${registro.ip_assinatura ?? "—"}`),
    h("code", {}, `user-agent: ${registro.user_agent_assinatura ?? "—"}`),
    h("code", {}, `retenção até: ${registro.retencao_ate ?? "—"}`)
  );
  corpo.append(auditoria);

  return h("div", { class: "modal-conteudo" }, topo, acoes, corpo);
}

function formatarValor(campo, valor) {
  if (valor === null || valor === undefined || valor === "") return "—";
  if (campo.tipo === "upload") return valor.nome ?? "arquivo anexado";
  if (Array.isArray(valor)) return valor.join(", ");
  if (campo.tipo === "date") return formatarData(valor);
  if (campo.tipo === "cpf") return mascararCPF(valor);
  if (campo.tipo === "number" && /valor/i.test(campo.id)) return formatarMoeda(valor);
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  return String(valor);
}

function rotuloConsentimento(tipo) {
  if (tipo === "lgpd") return "Autorização LGPD";
  if (tipo === "termo") return "Termo de consentimento";
  if (tipo.startsWith("extra:")) {
    return `Autorização: ${tipo.slice(6).replace(/_/g, " ")}`;
  }
  return tipo;
}

// ------------------------------------------------------------
// Configurações
// ------------------------------------------------------------
function renderConfiguracoes(container) {
  container.append(
    h(
      "div",
      { class: "pagina-topo" },
      h(
        "div",
        {},
        h("p", { class: "kicker" }, "Configuração"),
        h("h1", {}, "Seu estabelecimento"),
        h("p", { class: "pagina-sub" }, "Marca, retenção, Drive e campos da ficha.")
      )
    )
  );

  container.append(cardTenant(), cardDrive(), cardCampos(), cardPlano());
  carregarDrive();
}

function cardTenant() {
  const t = state.tenant;
  const b = t.branding ?? {};
  const nome = inputPainel({ value: t.nome_negocio, id: "cfg-nome" });
  const email = inputPainel({ value: t.email_contato ?? "", id: "cfg-email", type: "email" });
  const whatsapp = inputPainel({ value: t.whatsapp ?? "", id: "cfg-whatsapp" });
  const retencao = inputPainel({
    value: t.retencao_anos ?? 5,
    id: "cfg-retencao",
    type: "number",
    min: 1,
    max: 30,
  });
  const corPrimaria = inputPainel({ value: b.cor_primaria ?? "#4F7963", id: "cfg-cor", type: "color" });
  const corSecundaria = inputPainel({ value: b.cor_secundaria ?? "#3a5c4a", id: "cfg-cor2", type: "color" });
  const corFundo = inputPainel({ value: b.cor_fundo ?? "#e7efe9", id: "cfg-fundo", type: "color" });
  const logo = inputPainel({ value: b.logo_url ?? "", id: "cfg-logo", type: "url", placeholder: "https://..." });

  const form = h(
    "form",
    { class: "form-painel" },
    h(
      "div",
      { class: "form-grid" },
      grupo("Nome do negócio", nome),
      grupo("E-mail de contato", email),
      grupo("WhatsApp", whatsapp),
      grupo("Retenção (anos)", retencao, "1 a 30 anos. Padrão 5."),
      grupo("Cor primária", corPrimaria),
      grupo("Cor secundária", corSecundaria),
      grupo("Cor de fundo", corFundo),
      grupo("URL da logo", logo, "Opcional. Use uma imagem quadrada.")
    ),
    h(
      "button",
      { class: "btn-painel btn-primario-painel", type: "submit" },
      "Salvar estabelecimento"
    )
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      const { tenant } = await api("/api/panel/tenant", {
        method: "PATCH",
        body: {
          nome_negocio: nome.value.trim(),
          email_contato: email.value.trim() || null,
          whatsapp: whatsapp.value.trim() || null,
          retencao_anos: Number(retencao.value),
          branding: {
            ...state.tenant.branding,
            cor_primaria: corPrimaria.value,
            cor_secundaria: corSecundaria.value,
            cor_fundo: corFundo.value,
            logo_url: logo.value.trim() || null,
          },
        },
      });
      state.tenant = { ...state.tenant, ...tenant };
      toast("Estabelecimento atualizado.");
      renderShell();
    } catch (err) {
      toast(err.message ?? "Falha ao salvar.", "erro");
    }
  });

  return h(
    "section",
    { class: "painel-card" },
    h("h3", { class: "card-titulo-painel" }, "Identidade e retenção"),
    h("p", { class: "card-desc" }, "Aplicado à ficha do cliente, ao PDF e ao painel."),
    form
  );
}

function inputPainel({ value = "", id, type = "text", placeholder = "", min, max, step }) {
  return h("input", {
    class: "entrada-painel",
    id,
    type,
    value: value ?? "",
    placeholder,
    min,
    max,
    step,
  });
}

function cardDrive() {
  const box = h("div", { id: "drive-status" }, h("p", { class: "muted" }, "Carregando status do Drive…"));

  return h(
    "section",
    { class: "painel-card" },
    h("h3", { class: "card-titulo-painel" }, "Google Drive"),
    h(
      "p",
      { class: "card-desc" },
      "Os PDFs ficam na sua conta. O app só acessa a pasta que ele mesmo cria (escopo drive.file)."
    ),
    box
  );
}

async function carregarDrive() {
  const box = document.getElementById("drive-status");
  if (!box) return;
  try {
    const drive = await api("/api/drive/status");
    state.drive = drive;
    box.replaceChildren();

    box.append(
      h(
        "div",
        { class: `drive-status ${drive.conectado ? "conectado" : "desconectado"}` },
        h("span", { class: "drive-ponto" }),
        h("strong", {}, drive.conectado ? "Drive conectado" : "Drive não conectado"),
        h(
          "span",
          { class: "muted" },
          drive.conectado
            ? `Pasta: ${drive.folder_id ?? "—"}`
            : drive.storage_mode === "r2"
              ? "Armazenamento atual: Cloudflare R2."
              : "Drive não conectado. Os PDFs usam o R2 como fallback até você conectar."
        )
      )
    );

    const acoes = h("div", { class: "acoes-painel" });
    if (drive.conectado) {
      acoes.append(
        h(
          "button",
          {
            class: "btn-painel btn-secundario-painel btn-pequeno",
            on: {
              click: async () => {
                if (!confirm("Desconectar o Drive? Os PDFs novos passam a usar o armazenamento R2.")) return;
                try {
                  await api("/api/drive/desconectar", { method: "POST" });
                  toast("Drive desconectado.");
                  carregarDrive();
                } catch (err) {
                  toast(err.message ?? "Falha ao desconectar.", "erro");
                }
              },
            },
          },
          "Desconectar"
        )
      );
    } else {
      acoes.append(
        h(
          "button",
          {
            class: "btn-painel btn-primario-painel btn-pequeno",
            on: {
              click: async () => {
                try {
                  const { url } = await api("/api/drive/oauth/start");
                  window.location.href = url;
                } catch (err) {
                  toast(err.message ?? "Drive indisponível.", "erro");
                }
              },
            },
          },
          "Conectar Google Drive"
        )
      );
    }
    box.append(acoes);
  } catch (err) {
    box.replaceChildren(h("p", { class: "muted" }, err.message ?? "Não foi possível verificar o Drive."));
  }
}

function cardCampos() {
  const secoes = state.template?.campos_json?.secoes ?? [];
  const mapa = mapaCamposAtivos(secoes, state.formulario?.campos_ativos);

  const form = h("form", { class: "form-painel" });

  for (const secao of secoes) {
    const ativos = mapa.get(secao.id) ?? new Set();
    const checkSecao = h("input", { type: "checkbox", checked: ativos.size === secao.campos.length });
    const lista = h("div", { class: "campos-lista" });

    for (const campo of secao.campos) {
      const cb = h("input", { type: "checkbox", value: campo.id, checked: ativos.has(campo.id) });
      const linha = h(
        "label",
        { class: "campo-check" },
        cb,
        h(
          "span",
          {},
          h("strong", {}, campo.label),
          h("small", {}, `${campo.tipo}${campo.obrigatorio ? " · obrigatório" : ""}`)
        )
      );
      lista.append(linha);
    }

    checkSecao.addEventListener("change", () => {
      for (const cb of lista.querySelectorAll("input[type=checkbox]")) {
        cb.checked = checkSecao.checked;
      }
    });

    form.append(
      h(
        "div",
        { class: "secao-editor" },
        h("label", { class: "secao-check" }, checkSecao, h("strong", {}, secao.titulo)),
        lista
      )
    );
  }

  const salvar = h(
    "button",
    { class: "btn-painel btn-primario-painel", type: "submit" },
    "Salvar campos ativos"
  );

  form.append(
    h(
      "p",
      { class: "muted" },
      "Desmarque o que não usa. Fichas já enviadas não são alteradas; a mudança vale para novas fichas."
    ),
    salvar
  );

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const secoesAtivas = [];
    let totalCampos = 0;
    let totalAtivos = 0;

    for (const secaoEl of form.querySelectorAll(".secao-editor")) {
      const titulo = secaoEl.querySelector(".secao-check strong")?.textContent;
      const secao = secoes.find((s) => s.titulo === titulo);
      if (!secao) continue;
      const marcados = [...secaoEl.querySelectorAll(".campos-lista input:checked")].map((i) => i.value);
      totalCampos += secao.campos.length;
      totalAtivos += marcados.length;
      if (marcados.length) secoesAtivas.push({ id: secao.id, campos: marcados });
    }

    if (!totalAtivos) {
      toast("Ative pelo menos um campo.", "erro");
      return;
    }

    const camposAtivos = totalAtivos === totalCampos ? null : { secoes: secoesAtivas };
    try {
      const { formulario } = await api("/api/panel/formulario", {
        method: "PATCH",
        body: { campos_ativos: camposAtivos },
      });
      state.formulario = { ...state.formulario, ...formulario };
      toast("Campos atualizados.");
    } catch (err) {
      toast(err.message ?? "Falha ao salvar campos.", "erro");
    }
  });

  return h(
    "section",
    { class: "painel-card" },
    h("h3", { class: "card-titulo-painel" }, "Campos da ficha"),
    h(
      "p",
      { class: "card-desc" },
      "Ative ou desative seções e campos do template. Customização por cliente não entra no produto."
    ),
    form
  );
}

function mapaCamposAtivos(secoes, camposAtivos) {
  const mapa = new Map();
  if (!camposAtivos) {
    for (const secao of secoes) mapa.set(secao.id, new Set(secao.campos.map((c) => c.id)));
    return mapa;
  }
  if (Array.isArray(camposAtivos)) {
    const permitidos = new Set(camposAtivos);
    for (const secao of secoes) {
      mapa.set(secao.id, new Set(secao.campos.filter((c) => permitidos.has(c.id)).map((c) => c.id)));
    }
    return mapa;
  }
  for (const entrada of camposAtivos.secoes ?? []) {
    mapa.set(entrada.id, new Set(entrada.campos ?? []));
  }
  return mapa;
}

function cardPlano() {
  const t = state.tenant;
  const qrCanvas = h("canvas", { class: "qr-canvas qr-pequeno", width: "150", height: "150" });
  const card = h(
    "section",
    { class: "painel-card" },
    h("h3", { class: "card-titulo-painel" }, "Plano e link"),
    h(
      "div",
      { class: "plano-grid" },
      h("span", { class: "detalhe-rotulo" }, "Plano"),
      h("span", {}, `${t.plano} · ${t.status}`),
      h("span", { class: "detalhe-rotulo" }, "Nicho"),
      h("span", {}, t.nicho_slug),
      h("span", { class: "detalhe-rotulo" }, "Trial até"),
      h("span", {}, t.trial_expira_em ? formatarData(t.trial_expira_em) : "—"),
      h("span", { class: "detalhe-rotulo" }, "Link"),
      h("code", { class: "link-ficha" }, state.linkFicha)
    ),
    h(
      "div",
      { class: "qr-lateral" },
      qrCanvas,
      h(
        "div",
        { class: "acoes-painel" },
        h(
          "button",
          { class: "btn-painel btn-secundario-painel btn-pequeno", on: { click: () => copiar(state.linkFicha) } },
          "Copiar link"
        ),
        h(
          "a",
          { class: "btn-painel btn-secundario-painel btn-pequeno", href: state.linkFicha, target: "_blank", rel: "noopener" },
          "Abrir"
        )
      )
    )
  );
  setTimeout(() => desenharQR(qrCanvas, state.linkFicha), 0);
  return card;
}

// ------------------------------------------------------------
// Onboarding
// ------------------------------------------------------------
function renderOnboarding(status) {
  app.replaceChildren();
  const email = state.session?.user?.email ?? "";
  const nomeInicial = state.session?.user?.user_metadata?.nome ?? email.split("@")[0] ?? "";

  const nomeNegocio = inputPainel({ id: "onb-nome", placeholder: "Ex.: Estúdio Aurora" });
  const slug = inputPainel({ id: "onb-slug", placeholder: "estudio-aurora" });
  const nomeUsuario = inputPainel({ id: "onb-usuario", value: nomeInicial });
  const nicho = h(
    "select",
    { class: "entrada-painel", id: "onb-nicho" },
    ...NICHOS.map((n) => h("option", { value: n.slug }, n.nome))
  );
  const nichoParam = new URLSearchParams(window.location.search).get("nicho");
  if (nichoParam && NICHOS.some((n) => n.slug === nichoParam)) {
    nicho.value = nichoParam;
  }
  const cor = h("input", { class: "entrada-painel entrada-cor", type: "color", value: "#4F7963", id: "onb-cor" });
  const slugStatus = h("small", { class: "campo-painel-hint", id: "onb-slug-status" }, "O link da ficha será /f/{slug}.");
  const erro = h("div", { class: "auth-erro", role: "alert", hidden: true });

  let slugEditado = false;

  nomeNegocio.addEventListener("input", () => {
    if (!slugEditado) slug.value = slugify(nomeNegocio.value);
    verificarSlug();
  });
  slug.addEventListener("input", () => {
    slugEditado = true;
    slug.value = slugify(slug.value);
    verificarSlug();
  });

  let timerSlug = null;
  function verificarSlug() {
    clearTimeout(timerSlug);
    const valor = slug.value.trim();
    if (!valor) {
      slugStatus.textContent = "O link da ficha será /f/{slug}.";
      state.onboardingSlugOk = null;
      return;
    }
    slugStatus.textContent = "Verificando disponibilidade…";
    timerSlug = setTimeout(async () => {
      try {
        const resp = await api("/api/onboarding/check-slug", {
          method: "POST",
          body: { slug: valor },
        });
        state.onboardingSlugOk = resp.disponivel;
        slugStatus.textContent = resp.disponivel
          ? `Disponível: ${window.location.origin}/f/${valor}`
          : "Este link já está em uso. Escolha outro.";
        slugStatus.style.color = resp.disponivel ? "" : "var(--erro)";
      } catch {
        slugStatus.textContent = "Não foi possível verificar o link agora.";
      }
    }, 400);
  }

  const form = h(
    "form",
    { class: "form-painel" },
    h("div", { class: "form-grid" }, grupo("Nome do estabelecimento", nomeNegocio), grupo("Nome do responsável", nomeUsuario)),
    h(
      "div",
      { class: "form-grid" },
      grupo("Nicho", nicho),
      grupo("Cor principal", cor)
    ),
    h(
      "div",
      { class: "form-grid" },
      grupo("Link da ficha", slug, null),
      h("div", { class: "campo-painel" }, h("span", { class: "campo-painel-rotulo" }, "Prévia"), h("div", { class: "slug-preview" }, `/f/${slug.value || "seu-estudio"}`))
    ),
    slugStatus,
    erro,
    h(
      "div",
      { class: "acoes-painel" },
      h("button", { class: "btn-painel btn-primario-painel", type: "submit" }, "Criar estabelecimento"),
      h("button", { class: "btn-painel btn-secundario-painel", type: "button", on: { click: () => sair() } }, "Sair")
    )
  );

  slug.addEventListener("input", () => {
    const previa = form.querySelector(".slug-preview");
    if (previa) previa.textContent = `/f/${slug.value || "seu-estudio"}`;
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    erro.hidden = true;
    const botao = form.querySelector("button[type=submit]");
    botao.disabled = true;
    botao.textContent = "Criando…";
    try {
      if (!slug.value.trim()) {
        throw new Error("Escolha o link da ficha.");
      }
      const resultado = await api("/api/onboarding/criar", {
        method: "POST",
        body: {
          slug: slug.value.trim(),
          nome_negocio: nomeNegocio.value.trim(),
          nicho_slug: nicho.value,
          nome_usuario: nomeUsuario.value.trim() || undefined,
          branding: { cor_primaria: cor.value },
        },
      });
      renderOnboardingSucesso(resultado);
    } catch (err) {
      erro.textContent = err.message ?? "Não foi possível criar o estabelecimento.";
      erro.hidden = false;
      botao.disabled = false;
      botao.textContent = "Criar estabelecimento";
    }
  });

  const card = h(
    "div",
    { class: "onboarding-card" },
    h("p", { class: "kicker" }, "Passo 1 de 3"),
    h("h1", {}, "Vamos criar seu espaço"),
    h(
      "p",
      { class: "auth-sub" },
      "Escolha o nome, o link e o nicho. Depois você conecta o Drive e gera o QR code."
    ),
    form,
    h(
      "p",
      { class: "auth-nota" },
      `Conta: ${email}. Você poderá convidar profissionais depois.`
    )
  );

  app.append(
    h(
      "div",
      { class: "onboarding-tela" },
      h(
        "aside",
        { class: "auth-hero" },
        h("p", { class: "kicker claro" }, "Onboarding"),
        h("h2", {}, "Em 3 passos, sua ficha está no ar."),
        h(
          "ol",
          { class: "onboarding-passos" },
          h("li", {}, "Criar estabelecimento"),
          h("li", {}, "Conectar Google Drive"),
          h("li", {}, "Imprimir o QR code")
        ),
        h("p", { class: "muted claro" }, "Tempo estimado: 8 minutos.")
      ),
      card
    )
  );

  verificarSlug();
}

function renderOnboardingSucesso(resultado) {
  app.replaceChildren();
  const link = resultado.link_ficha;
  const canvas = h("canvas", { class: "qr-canvas", width: "220", height: "220" });

  const card = h(
    "div",
    { class: "onboarding-card" },
    h("p", { class: "kicker" }, "Tudo pronto"),
    h("h1", {}, "Sua ficha está no ar"),
    h(
      "p",
      { class: "auth-sub" },
      "Imprima o QR code, cole na recepção e faça uma ficha de teste agora."
    ),
    h("div", { class: "qr-centro" }, canvas),
    h("code", { class: "link-ficha link-centro" }, link.replace(/^https?:\/\//, "")),
    h(
      "div",
      { class: "acoes-painel centro" },
      h("button", { class: "btn-painel btn-primario-painel", on: { click: () => copiar(link) } }, "Copiar link"),
      h(
        "button",
        {
          class: "btn-painel btn-secundario-painel",
          on: {
            click: async () => {
              const dataUrl = await QRCode.toDataURL(link, { width: 800, margin: 2 });
              const a = document.createElement("a");
              a.href = dataUrl;
              a.download = `fichapro-qr-${resultado.slug}.png`;
              a.click();
            },
          },
        },
        "Baixar QR"
      )
    ),
    h(
      "button",
      {
        class: "btn-painel btn-secundario-painel",
        on: { click: () => iniciarPainel() },
      },
      "Ir para o painel →"
    ),
    h(
      "p",
      { class: "auth-nota" },
      "Próximo passo recomendado: conectar o Google Drive em Configurações para os PDFs irem para a sua conta."
    )
  );

  app.append(h("div", { class: "onboarding-tela" }, card));
  desenharQR(canvas, link);
}

// ------------------------------------------------------------
// Roteamento / início
// ------------------------------------------------------------
window.addEventListener("hashchange", () => {
  if (!state.tenant) return;
  const rota = window.location.hash.replace(/^#\/?/, "");
  state.view = rota === "configuracoes" ? "configuracoes" : "fichas";
  renderShell();
});

if (import.meta.env.DEV) {
  window.__painel = {
    state,
    iniciarPainel,
    renderAuth,
    renderOnboarding,
    renderShell,
    renderView,
  };
}

init();
