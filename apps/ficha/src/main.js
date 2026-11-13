import "./styles.css";
import { buscarFormulario } from "./api.js";
import { configDemo, nichoDoSlug, NICHOS } from "./demo.js";
import { FichaEngine } from "./engine.js";

const app = document.getElementById("app");

function telaCarregando() {
  app.replaceChildren(
    Object.assign(document.createElement("div"), {
      className: "tela-carregando",
      innerHTML: `
        <div class="loader" aria-hidden="true"></div>
        <p>Carregando sua ficha…</p>
        <small>Preparando o formulário do estúdio</small>
      `,
    })
  );
}

function telaErro(titulo, mensagem) {
  app.replaceChildren();
  const box = document.createElement("div");
  box.className = "tela-erro-box";
  const h1 = document.createElement("h1");
  h1.textContent = titulo;
  const p = document.createElement("p");
  p.textContent = mensagem;
  const acoes = document.createElement("div");
  acoes.className = "tela-erro-acoes";
  const demo = document.createElement("a");
  demo.className = "btn btn-primario";
  demo.href = "/f/demo-tatuagem";
  demo.textContent = "Ver demonstração";
  const recarregar = document.createElement("button");
  recarregar.type = "button";
  recarregar.className = "btn btn-secundario";
  recarregar.textContent = "Tentar novamente";
  recarregar.addEventListener("click", () => window.location.reload());
  acoes.append(demo, recarregar);
  box.append(h1, p, acoes);
  app.append(box);
}

function montarSeletorDemo() {
  const box = document.createElement("div");
  box.className = "seletor-demo";

  const topo = document.createElement("header");
  topo.className = "seletor-topo";
  topo.innerHTML = `
    <span class="seletor-kicker">Demonstração</span>
    <h1>Uma ficha para cada especialidade.</h1>
    <p>Abra a ficha de cada nicho para testar o fluxo completo: preenchimento, termo, revisão e assinatura. Nenhum dado é enviado.</p>
  `;

  const grid = document.createElement("div");
  grid.className = "seletor-grid";

  for (const nicho of NICHOS) {
    const card = document.createElement("a");
    card.className = "seletor-card";
    card.href = `/f/demo-${nicho.slug}`;
    card.style.setProperty("--nicho-cor", nicho.cor);
    card.innerHTML = `
      <span class="seletor-numero">${String(NICHOS.indexOf(nicho) + 1).padStart(2, "0")}</span>
      <h2>${nicho.nome}</h2>
      <p>${nicho.descricao}</p>
      <span class="seletor-cta">Abrir ficha →</span>
    `;
    grid.append(card);
  }

  const rodape = document.createElement("footer");
  rodape.className = "seletor-rodape";
  rodape.textContent =
    "Em produção, cada estúdio recebe um link e um QR code próprios. A ficha carrega o template do nicho e a identidade visual do tenant.";

  box.append(topo, grid, rodape);
  app.replaceChildren(box);
}

function obterSlug() {
  const query = new URLSearchParams(window.location.search);
  const direto = query.get("t") ?? query.get("slug") ?? query.get("tenant");
  if (direto) return direto;

  const partes = window.location.pathname.split("/").filter(Boolean);
  if (partes[0] === "f" && partes[1]) return decodeURIComponent(partes[1]);

  // Entradas estáticas do GitHub Pages: /ficha/<nicho>/write/?demo=1&nicho=<nicho>
  if (query.get("demo") === "1") {
    return `demo-${query.get("nicho") ?? "tatuagem"}`;
  }

  return null;
}

async function iniciar() {
  const slug = obterSlug();

  if (!slug) {
    montarSeletorDemo();
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const demoForcado =
    params.get("demo") === "1" ||
    slug.startsWith("demo-") ||
    Boolean(import.meta.env.VITE_DEMO);

  if (demoForcado) {
    const nicho = nichoDoSlug(slug);
    const config = configDemo(nicho);
    const engine = new FichaEngine({ app, config, demo: true });
    if (import.meta.env.DEV) window.__fichaEngine = engine;
    return;
  }

  telaCarregando();
  try {
    const config = await buscarFormulario(slug);
    if (!config?.template?.secoes) {
      throw new Error("O formulário deste estúdio não está configurado.");
    }
    const engine = new FichaEngine({ app, config, demo: false });
    if (import.meta.env.DEV) window.__fichaEngine = engine;
  } catch (err) {
    console.error(err);
    if (err.status === 404) {
      telaErro(
        "Ficha não encontrada",
        "Confira o link ou o QR code com o estabelecimento. O endereço pode ter mudado."
      );
    } else {
      telaErro(
        "Não foi possível abrir a ficha",
        err.message ??
          "Verifique sua conexão e tente novamente. Se o problema continuar, avise o estabelecimento."
      );
    }
  }
}

iniciar();
