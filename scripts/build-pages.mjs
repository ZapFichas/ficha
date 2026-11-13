#!/usr/bin/env node
/**
 * Gera o site estático para GitHub Pages.
 *
 * Estrutura:
 *   site/index.html                 -> seletor de nichos
 *   site/<nicho>/index.html         -> landing do nicho
 *   site/<nicho>/write/             -> app da ficha (lê ?t=<slug>)
 *   site/dashboard/                 -> painel do tenant
 *
 * Variáveis de build:
 *   VITE_API_BASE, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, PANEL_URL
 */
import { execSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

const RAIZ = resolve(".");
const SITE = resolve("site");

const API_BASE = (
  process.env.VITE_API_BASE ?? "https://fichapro-api.zapfichas.workers.dev"
).replace(/\/$/, "");
const PANEL_URL = (
  process.env.PANEL_URL ?? "https://zapfichas.github.io/ficha/dashboard/"
).replace(/\/?$/, "/");

const NICHOS = [
  {
    slug: "tatuagem",
    nome: "Tatuagem",
    aliases: ["tatuagem", "tattoo"],
    cor: "#4F7963",
    corSecundaria: "#3A5C4A",
    fundo: "#E7EFE9",
  },
  {
    slug: "piercing",
    nome: "Piercing",
    aliases: ["piercing"],
    cor: "#2F6F73",
    corSecundaria: "#234F52",
    fundo: "#E4EFF0",
  },
  {
    slug: "estetica",
    nome: "Estética",
    aliases: ["estetica"],
    cor: "#8A5A6B",
    corSecundaria: "#6D4353",
    fundo: "#F5EAEE",
  },
  {
    slug: "fitness",
    nome: "Fitness",
    aliases: ["fitness"],
    cor: "#2F5D8A",
    corSecundaria: "#234768",
    fundo: "#E8EFF7",
  },
];

function esc(valor) {
  return String(valor ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function copiar(origem, destino) {
  if (!existsSync(origem)) throw new Error(`Build não encontrado: ${origem}`);
  mkdirSync(destino, { recursive: true });
  cpSync(origem, destino, { recursive: true });
}

function moeda(valor) {
  const n = Number(valor);
  return Number.isFinite(n)
    ? n.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 })
    : `R$ ${valor}`;
}

function renderLanding(template, nicho, alias) {
  const landing = template.landing_copy ?? {};
  const preco = template.preco ?? {};
  const faq = landing.faq ?? [];
  const secoes = landing.secoes ?? [];
  const planos = ["solo", "estudio", "pro"]
    .filter((chave) => preco[chave])
    .map((chave, indice) => {
      const plano = preco[chave];
      return {
        id: chave,
        nome: chave === "solo" ? "Solo" : chave === "estudio" ? "Estúdio" : "Pro",
        valor: plano.valor,
        inclui: plano.inclui,
        destaque: chave === "estudio",
        indice,
      };
    });

  const linkPainel = `${PANEL_URL}?nicho=${encodeURIComponent(nicho.slug)}`;
  const linkDemo = `./write/?demo=1&nicho=${encodeURIComponent(nicho.slug)}`;
  const keywords = (landing.seo_keywords ?? []).join(", ");

  const faqHtml = faq
    .map(
      (item) => `<details>
        <summary>${esc(item.pergunta)}</summary>
        <p>${esc(item.resposta)}</p>
      </details>`
    )
    .join("\n");

  const planosHtml = planos
    .map(
      (plano) => `<article class="plano ${plano.destaque ? "destaque" : ""}">
        <div class="plano-topo">
          <h3>${esc(plano.nome)}</h3>
          ${plano.destaque ? '<span class="selo">Mais escolhido</span>' : ""}
        </div>
        <div class="preco">${moeda(plano.valor)}<small>/mês</small></div>
        <p>${esc(plano.inclui)}</p>
        <a class="btn ${plano.destaque ? "btn-claro" : "btn-contorno"}" href="${esc(linkPainel)}">Começar teste</a>
      </article>`
    )
    .join("\n");

  const secoesHtml = secoes
    .map((item) => `<li>${esc(item)}</li>`)
    .join("\n");

  const jsonLd = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: template.nome_comercial ?? "FichaPro",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description: landing.subheadline,
    offers: planos.map((p) => ({
      "@type": "Offer",
      name: p.nome,
      price: String(p.valor),
      priceCurrency: "BRL",
    })),
  });

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(landing.headline ?? template.nome)} · ${esc(template.nome_comercial ?? "FichaPro")}</title>
  <meta name="description" content="${esc(landing.subheadline ?? "")}" />
  <meta name="keywords" content="${esc(keywords)}" />
  <meta name="theme-color" content="${nicho.cor}" />
  <link rel="icon" href="data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${nicho.cor}"/><path d="M20 18h18l8 8v20a4 4 0 0 1-4 4H20a4 4 0 0 1-4-4V22a4 4 0 0 1 4-4Z" fill="none" stroke="#fff" stroke-width="2.5"/><path d="M38 18v8h8M24 34h16M24 41h11" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/></svg>`
  )}" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Jost:wght@300;400;500;600&display=swap" rel="stylesheet" />
  <script type="application/ld+json">${jsonLd}</script>
  <style>
    :root{
      --primaria:${nicho.cor}; --secundaria:${nicho.corSecundaria};
      --fundo:${nicho.fundo}; --texto:#1d2b24; --suave:#5c7166; --claro:#8ba095;
      --borda:#d9e4de; --painel:#fff; --raio:16px;
      --serif:'Cormorant Garamond',Georgia,serif; --sans:'Jost',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    }
    *{box-sizing:border-box} [hidden]{display:none!important}
    body{margin:0;background:var(--fundo);color:var(--texto);font-family:var(--sans);font-weight:300;line-height:1.55;-webkit-font-smoothing:antialiased}
    h1,h2,h3,p{margin:0} a{color:inherit;text-decoration:none}
    .wrap{max-width:1120px;margin:0 auto;padding:0 24px}
    header{background:rgba(255,255,255,.9);border-bottom:1px solid var(--borda);position:sticky;top:0;z-index:20;backdrop-filter:blur(12px)}
    .topo{display:flex;align-items:center;justify-content:space-between;gap:18px;padding:16px 0}
    .marca{display:flex;align-items:center;gap:11px}
    .logo{width:42px;height:42px;border-radius:12px;background:var(--primaria);display:grid;place-items:center}
    .marca strong{font-family:var(--serif);font-size:21px;font-weight:500;display:block;line-height:1.05}
    .marca span{display:block;font-size:9px;letter-spacing:1.8px;text-transform:uppercase;color:var(--claro)}
    nav{display:flex;align-items:center;gap:22px;font-size:11px;letter-spacing:1.2px;text-transform:uppercase;color:var(--suave)}
    nav a:hover{color:var(--primaria)}
    .btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:14px 22px;border-radius:10px;font-size:11px;letter-spacing:1.6px;text-transform:uppercase;font-weight:500;transition:.2s;border:1px solid transparent;cursor:pointer}
    .btn-primario{background:var(--primaria);color:#fff;box-shadow:0 10px 26px rgba(0,0,0,.14)}
    .btn-primario:hover{filter:brightness(.93)}
    .btn-contorno{border-color:var(--borda);color:var(--suave);background:#fff}
    .btn-contorno:hover{border-color:var(--primaria);color:var(--primaria)}
    .btn-claro{background:#fff;color:var(--primaria)}
    .hero{padding:70px 0 58px;display:grid;grid-template-columns:1.1fr .9fr;gap:48px;align-items:center}
    .kicker{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:var(--primaria);font-weight:500;margin-bottom:12px}
    .hero h1{font-family:var(--serif);font-size:58px;font-weight:300;line-height:1.03;letter-spacing:-.8px;margin-bottom:18px}
    .hero h1 em{font-style:italic;color:var(--primaria)}
    .hero p{font-size:15px;line-height:1.75;color:var(--suave);max-width:520px;margin-bottom:26px}
    .hero-ctas{display:flex;gap:10px;flex-wrap:wrap}
    .hero-ctas .btn{min-height:50px}
    .hero-card{background:#fff;border:1px solid var(--borda);border-radius:22px;padding:26px;box-shadow:0 24px 70px rgba(29,43,36,.1);position:relative;overflow:hidden}
    .hero-card::before{content:'';position:absolute;left:0;right:0;top:0;height:4px;background:var(--primaria)}
    .hero-card h3{font-family:var(--serif);font-size:24px;font-weight:400;margin-bottom:4px}
    .hero-card > p{font-size:12.5px;color:var(--claro);margin-bottom:18px}
    .fluxo{display:flex;flex-direction:column;gap:12px}
    .fluxo-item{display:flex;gap:12px;align-items:flex-start;padding:12px;border:1px solid var(--borda);border-radius:10px;background:#fbfdfc}
    .fluxo-num{width:26px;height:26px;border-radius:50%;background:var(--primaria);color:#fff;display:grid;place-items:center;font-size:11px;font-weight:600;flex:0 0 auto}
    .fluxo-item strong{display:block;font-size:13px;font-weight:500}
    .fluxo-item small{display:block;font-size:11px;color:var(--claro);margin-top:1px}
    .faixa{border-top:1px solid var(--borda);border-bottom:1px solid var(--borda);background:rgba(255,255,255,.55)}
    .faixa-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;padding:18px 0;font-size:10.5px;letter-spacing:1.1px;text-transform:uppercase;color:var(--suave);text-align:center}
    .faixa-grid span::before{content:'✓';color:var(--primaria);margin-right:7px}
    section{padding:64px 0}
    .secao-topo{max-width:620px;margin-bottom:32px}
    .secao-topo h2{font-family:var(--serif);font-size:42px;font-weight:300;line-height:1.08;margin-bottom:10px}
    .secao-topo p{font-size:14px;line-height:1.7;color:var(--suave)}
    .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
    .card{background:#fff;border:1px solid var(--borda);border-radius:var(--raio);padding:24px;box-shadow:0 10px 30px rgba(29,43,36,.04)}
    .card .icone{width:38px;height:38px;border-radius:10px;background:rgba(0,0,0,.05);display:grid;place-items:center;font-size:17px;margin-bottom:14px}
    .card h3{font-family:var(--serif);font-size:22px;font-weight:400;margin-bottom:6px}
    .card p{font-size:13px;line-height:1.65;color:var(--suave)}
    .lista{list-style:none;padding:0;margin:20px 0 0;display:grid;grid-template-columns:repeat(2,1fr);gap:8px 20px}
    .lista li{font-size:13px;color:var(--suave);line-height:1.5}
    .lista li::before{content:'—';color:var(--primaria);margin-right:8px}
    .planos-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;align-items:stretch}
    .plano{background:#fff;border:1px solid var(--borda);border-radius:var(--raio);padding:26px;display:flex;flex-direction:column;gap:10px;box-shadow:0 10px 30px rgba(29,43,36,.04)}
    .plano.destaque{background:var(--primaria);color:#fff;border-color:var(--primaria);transform:translateY(-4px);box-shadow:0 20px 50px rgba(0,0,0,.16)}
    .plano-topo{display:flex;align-items:center;justify-content:space-between;gap:8px}
    .plano h3{font-family:var(--serif);font-size:25px;font-weight:400}
    .selo{font-size:8.5px;letter-spacing:1px;text-transform:uppercase;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.3);padding:4px 8px;border-radius:999px}
    .preco{font-family:var(--serif);font-size:38px;font-weight:400;line-height:1}
    .preco small{font-family:var(--sans);font-size:11px;letter-spacing:1px;text-transform:uppercase;opacity:.7;margin-left:4px}
    .plano p{font-size:12.5px;line-height:1.6;color:var(--suave);flex:1}
    .plano.destaque p{color:rgba(255,255,255,.78)}
    .plano .btn{width:100%;margin-top:6px}
    .faq{max-width:840px}
    details{background:#fff;border:1px solid var(--borda);border-radius:10px;padding:0 16px;margin-bottom:8px}
    summary{cursor:pointer;padding:15px 0;font-size:13.5px;font-weight:400;list-style:none;display:flex;align-items:center;justify-content:space-between;gap:14px}
    summary::-webkit-details-marker{display:none}
    summary::after{content:'+';color:var(--primaria);font-size:18px;line-height:1}
    details[open] summary::after{content:'–'}
    details p{padding:0 0 15px;font-size:13px;line-height:1.7;color:var(--suave);max-width:70ch}
    .cta-final{background:linear-gradient(140deg,var(--secundaria),var(--primaria));border-radius:22px;padding:48px;color:#fff;display:flex;align-items:center;justify-content:space-between;gap:28px;flex-wrap:wrap}
    .cta-final h2{font-family:var(--serif);font-size:42px;font-weight:300;line-height:1.05;margin-bottom:8px;max-width:600px}
    .cta-final p{font-size:13.5px;color:rgba(255,255,255,.75);max-width:560px}
    footer{border-top:1px solid var(--borda);padding:28px 0 38px;color:var(--claro);font-size:11px;line-height:1.7}
    .rodape{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;flex-wrap:wrap}
    .rodape strong{color:var(--suave);font-weight:500}
    @media(max-width:900px){
      nav{display:none}
      .hero{grid-template-columns:1fr;padding:48px 0 40px;gap:28px}
      .hero h1{font-size:44px}
      .faixa-grid{grid-template-columns:repeat(2,1fr);text-align:left}
      .cards,.planos-grid{grid-template-columns:1fr}
      .plano.destaque{transform:none}
      .cta-final{padding:32px 24px}
      .cta-final h2{font-size:34px}
    }
    @media(max-width:560px){
      .wrap{padding:0 16px}
      .hero h1{font-size:37px}
      .secao-topo h2{font-size:34px}
      .lista{grid-template-columns:1fr}
      .hero-ctas .btn{width:100%}
      section{padding:48px 0}
    }
  </style>
</head>
<body>
  <header>
    <div class="wrap topo">
      <a class="marca" href="../">
        <span class="logo">${`<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1.6"><path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5M9 12h6M9 16h4"/></svg>`}</span>
        <span><strong>${esc(template.nome_comercial ?? "FichaPro")}</strong><span>${esc(nicho.nome)} · ficha digital</span></span>
      </a>
      <nav>
        <a href="#como">Como funciona</a>
        <a href="#planos">Planos</a>
        <a href="#faq">FAQ</a>
        <a class="btn btn-contorno" href="${esc(linkPainel)}">Entrar</a>
      </nav>
    </div>
  </header>

  <main class="wrap">
    <section class="hero">
      <div>
        <p class="kicker">${esc(nicho.nome)} · ficha digital + assinatura</p>
        <h1>${esc(landing.headline ?? "A ficha digital do seu estúdio")}</h1>
        <p>${esc(landing.subheadline ?? "")}</p>
        <div class="hero-ctas">
          <a class="btn btn-primario" href="${esc(linkPainel)}">${esc(landing.cta_primario ?? "Testar grátis")}</a>
          <a class="btn btn-contorno" href="${esc(linkDemo)}">${esc(landing.cta_secundario ?? "Ver demonstração")}</a>
        </div>
      </div>
      <aside class="hero-card">
        <h3>Como funciona</h3>
        <p>Do QR code ao PDF no seu Drive, sem papel.</p>
        <div class="fluxo">
          <div class="fluxo-item"><span class="fluxo-num">1</span><div><strong>Cliente aponta o QR</strong><small>Abre no navegador, sem instalar app.</small></div></div>
          <div class="fluxo-item"><span class="fluxo-num">2</span><div><strong>Preenche e assina</strong><small>Anamnese, termo, LGPD e autorização de menor.</small></div></div>
          <div class="fluxo-item"><span class="fluxo-num">3</span><div><strong>PDF organizado</strong><small>Salvo automaticamente no seu Google Drive.</small></div></div>
        </div>
      </aside>
    </section>
  </main>

  <div class="faixa">
    <div class="wrap faixa-grid">
      <span>Sem app para o cliente</span>
      <span>PDF no seu Drive</span>
      <span>Assinatura com trilha</span>
      <span>LGPD e menor de idade</span>
    </div>
  </div>

  <main class="wrap">
    <section id="problema">
      <div class="secao-topo">
        <p class="kicker">O problema</p>
        <h2>Ficha em papel custa tempo e segurança.</h2>
        <p>${esc(template.dor_principal ?? "Papel, impressão, fichas perdidas e falta de prova de assinatura.")}</p>
      </div>
      <ul class="lista">${secoesHtml}</ul>
    </section>

    <section id="como">
      <div class="secao-topo">
        <p class="kicker">A solução</p>
        <h2>Uma engine, quatro coisas resolvidas.</h2>
        <p>O cliente faz tudo no celular. O profissional recebe o registro pronto, com prova de assinatura.</p>
      </div>
      <div class="cards">
        <article class="card"><div class="icone">✍️</div><h3>Assinatura digital</h3><p>Canvas com dedo, caneta ou mouse. Hash SHA-256 do conteúdo, data/hora, IP e dispositivo.</p></article>
        <article class="card"><div class="icone">📄</div><h3>PDF automático</h3><p>Documento organizado por profissional e mês. Vai para o Google Drive do estúdio, não para uma caixa de e-mail.</p></article>
        <article class="card"><div class="icone">🔒</div><h3>LGPD e menor</h3><p>Termo, consentimento LGPD e autorização do responsável com assinatura. Retenção configurável.</p></article>
      </div>
    </section>

    <section id="planos">
      <div class="secao-topo">
        <p class="kicker">Planos</p>
        <h2>Preço simples, sem fidelidade.</h2>
        <p>Teste 7 dias sem cartão. Cancele quando quiser. ${esc(preco.anual ?? "No anual, 2 meses grátis.")}</p>
      </div>
      <div class="planos-grid">${planosHtml}</div>
    </section>

    <section id="faq">
      <div class="secao-topo">
        <p class="kicker">Perguntas frequentes</p>
        <h2>O que os estúdios perguntam.</h2>
      </div>
      <div class="faq">${faqHtml}</div>
    </section>

    <section>
      <div class="cta-final">
        <div>
          <h2>Pronto para tirar a ficha do papel?</h2>
          <p>Crie sua conta, conecte o Drive e imprima o QR code. O onboarding leva menos de 10 minutos.</p>
        </div>
        <a class="btn btn-claro" href="${esc(linkPainel)}">${esc(landing.cta_primario ?? "Testar grátis")}</a>
      </div>
    </section>
  </main>

  <footer>
    <div class="wrap rodape">
      <div>
        <strong>${esc(template.nome_comercial ?? "FichaPro")}</strong><br />
        ${esc(template.nome)}<br />
        <span>Ferramenta de registro e assinatura eletrônica. Não substitui avaliação profissional nem prontuário médico.</span>
      </div>
      <div>
        <a href="${esc(linkPainel)}">Acessar o painel</a><br />
        <a href="./write/?demo=1&nicho=${encodeURIComponent(nicho.slug)}">Ver ficha de demonstração</a>
      </div>
    </div>
  </footer>
</body>
</html>`;
}

function renderRaiz() {
  const cards = NICHOS.map(
    (nicho) => `<a class="card-nicho" href="./${nicho.slug}/" style="--cor:${nicho.cor}">
      <span class="num">${String(NICHOS.indexOf(nicho) + 1).padStart(2, "0")}</span>
      <h2>${esc(nicho.nome)}</h2>
      <p>${esc(
        nicho.slug === "tatuagem"
          ? "Anamnese, termo, assinatura e autorização de menor."
          : nicho.slug === "piercing"
            ? "Termo específico, joia, alergia a metal e menor."
            : nicho.slug === "estetica"
              ? "Procedimentos, foto antes e consentimento de imagem."
              : "PAR-Q, liberação médica e termo de responsabilidade."
      )}</p>
      <span class="cta">Abrir landing →</span>
    </a>`
  ).join("\n");

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>FichaPro — ficha digital, termo e assinatura</title>
  <meta name="description" content="Ficha de anamnese digital com termo, assinatura, LGPD e PDF organizado no Google Drive." />
  <meta name="theme-color" content="#4F7963" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Jost:wght@300;400;500;600&display=swap" rel="stylesheet" />
  <style>
    *{box-sizing:border-box} body{margin:0;background:#eef3ef;color:#1d2b24;font-family:'Jost',sans-serif;font-weight:300;line-height:1.55}
    h1,h2,p{margin:0} a{text-decoration:none;color:inherit}
    .wrap{max-width:1000px;margin:0 auto;padding:56px 22px 48px}
    .topo{text-align:center;max-width:640px;margin:0 auto 38px}
    .kicker{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:#4f7963;margin-bottom:12px}
    h1{font-family:'Cormorant Garamond',serif;font-size:48px;font-weight:300;line-height:1.06;margin-bottom:12px}
    .topo p{font-size:14px;color:#5c7166;line-height:1.7}
    .grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px}
    .card-nicho{background:#fff;border:1px solid #d9e4de;border-radius:14px;padding:24px 22px;box-shadow:0 10px 30px rgba(29,43,36,.05);transition:.2s;position:relative;overflow:hidden}
    .card-nicho::before{content:'';position:absolute;left:0;right:0;top:0;height:3px;background:var(--cor)}
    .card-nicho:hover{transform:translateY(-3px);box-shadow:0 18px 44px rgba(29,43,36,.1)}
    .num{font-family:'Cormorant Garamond',serif;font-size:12px;letter-spacing:2px;color:#8ba095}
    h2{font-family:'Cormorant Garamond',serif;font-size:29px;font-weight:400;margin:6px 0}
    .card-nicho p{font-size:13px;color:#5c7166;line-height:1.6;margin-bottom:18px;min-height:42px}
    .cta{font-size:10px;letter-spacing:1.6px;text-transform:uppercase;color:var(--cor);font-weight:500}
    .rodape{margin-top:28px;text-align:center;font-size:11px;color:#8ba095;line-height:1.7}
    .rodape a{color:#4f7963}
    @media(max-width:700px){.grid{grid-template-columns:1fr} h1{font-size:37px}}
  </style>
</head>
<body>
  <div class="wrap">
    <header class="topo">
      <p class="kicker">FichaPro · staging</p>
      <h1>Uma engine, quatro nichos.</h1>
      <p>Landing pages e fichas de demonstração. O painel do estúdio fica em <a href="./dashboard/"><strong>/dashboard/</strong></a>.</p>
    </header>
    <div class="grid">${cards}</div>
    <footer class="rodape">
      <p>Ferramenta de registro e assinatura eletrônica. Não substitui avaliação profissional.</p>
      <p><a href="./dashboard/">Acessar o painel</a> · <a href="./tatuagem/">Landing de tatuagem</a></p>
    </footer>
  </div>
</body>
</html>`;
}

function render404() {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta http-equiv="refresh" content="0; url=/ficha/"><title>Redirecionando…</title></head><body><p>Redirecionando para <a href="/ficha/">/ficha/</a>.</p></body></html>`;
}

function main() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseAnon = process.env.VITE_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnon) {
    throw new Error("Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para buildar o painel.");
  }

  rmSync(SITE, { recursive: true, force: true });
  mkdirSync(SITE, { recursive: true });

  const env = {
    ...process.env,
    VITE_API_BASE: API_BASE,
    VITE_SUPABASE_URL: supabaseUrl,
    VITE_SUPABASE_ANON_KEY: supabaseAnon,
  };

  console.log("→ build da ficha…");
  execSync("npm run build -w @fichapro/ficha", { stdio: "inherit", env });
  console.log("→ build do painel…");
  execSync("npm run build -w @fichapro/painel", { stdio: "inherit", env });

  for (const nicho of NICHOS) {
    const template = JSON.parse(
      readFileSync(resolve(`templates/${nicho.slug}.json`), "utf8")
    );
    for (const alias of nicho.aliases) {
      copiar(resolve("apps/ficha/dist"), resolve(SITE, alias, "write"));
      writeFileSync(
        resolve(SITE, alias, "index.html"),
        renderLanding(template, { ...nicho, slug: nicho.slug }, alias),
        "utf8"
      );
    }
  }

  copiar(resolve("apps/painel/dist"), resolve(SITE, "dashboard"));
  writeFileSync(resolve(SITE, "index.html"), renderRaiz(), "utf8");
  writeFileSync(resolve(SITE, "404.html"), render404(), "utf8");
  writeFileSync(resolve(SITE, ".nojekyll"), "", "utf8");

  console.log("\n✓ site gerado em ./site");
  console.log("  /ficha/                  → seletor");
  for (const nicho of NICHOS) {
    console.log(`  /ficha/${nicho.slug}/          → landing`);
    console.log(`  /ficha/${nicho.slug}/write/   → ficha (?t=slug)`);
  }
  console.log("  /ficha/dashboard/        → painel");
}

main();
