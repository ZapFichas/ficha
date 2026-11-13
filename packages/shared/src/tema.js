/**
 * Tema e contraste automático.
 *
 * Regra do produto: a marca pode mudar de cor, mas o texto nunca perde
 * legibilidade. Toda cor de texto é derivada do fundo real (WCAG AA).
 */

export function hexParaRgb(hex) {
  const limpo = String(hex ?? "")
    .replace("#", "")
    .trim()
    .toLowerCase();
  if (!/^([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(limpo)) return null;
  const full =
    limpo.length === 3
      ? limpo
          .split("")
          .map((c) => c + c)
          .join("")
      : limpo.slice(0, 6);
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function rgbParaHex({ r, g, b }) {
  const canal = (v) =>
    Math.max(0, Math.min(255, Math.round(Number(v) || 0)))
      .toString(16)
      .padStart(2, "0");
  return `#${canal(r)}${canal(g)}${canal(b)}`;
}

export function luminancia(hex) {
  const rgb = hexParaRgb(hex);
  if (!rgb) return 0;
  const canal = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * canal(rgb.r) + 0.7152 * canal(rgb.g) + 0.0722 * canal(rgb.b);
}

export function contraste(a, b) {
  const la = luminancia(a);
  const lb = luminancia(b);
  const claro = Math.max(la, lb);
  const escuro = Math.min(la, lb);
  return (claro + 0.05) / (escuro + 0.05);
}

export function misturar(a, b, peso = 0.5) {
  const ca = hexParaRgb(a);
  const cb = hexParaRgb(b);
  if (!ca || !cb) return a;
  const p = Math.max(0, Math.min(1, Number(peso)));
  return rgbParaHex({
    r: ca.r * (1 - p) + cb.r * p,
    g: ca.g * (1 - p) + cb.g * p,
    b: ca.b * (1 - p) + cb.b * p,
  });
}

/**
 * Ajusta uma cor até atingir o contraste desejado contra o fundo.
 * Primeiro tenta escurecer (fundo claro) e depois clarear (fundo escuro).
 */
export function ajustarParaContraste(cor, fundo, alvo = 4.5) {
  if (!hexParaRgb(cor)) return fundoEscuro(fundo) ? "#f5f8f6" : "#14201a";
  if (contraste(cor, fundo) >= alvo) return cor;

  const fundoEscuroA = luminancia(fundo) < 0.4;
  const extremo = fundoEscuroA ? "#ffffff" : "#000000";
  let melhor = cor;
  for (let passo = 1; passo <= 20; passo++) {
    const tentativa = misturar(cor, extremo, passo / 20);
    melhor = tentativa;
    if (contraste(tentativa, fundo) >= alvo) return tentativa;
  }
  return melhor;
}

export function fundoEscuro(fundo) {
  return luminancia(fundo) < 0.4;
}

/** Cor de texto com maior contraste sobre um fundo. */
export function corTextoSobre(fundo, opcoes = {}) {
  const claro = opcoes.claro ?? "#ffffff";
  const escuro = opcoes.escuro ?? "#14201a";
  return contraste(fundo, claro) >= contraste(fundo, escuro) ? claro : escuro;
}

/**
 * Gera as variáveis de tema a partir do branding do tenant.
 * Funciona tanto para a ficha (--cor-*) quanto para o painel (--primaria etc.).
 */
export function derivarPaletaTema(branding = {}) {
  const primariaOriginal = hexParaRgb(branding.cor_primaria)
    ? branding.cor_primaria
    : "#4f7963";
  const fundo = hexParaRgb(branding.cor_fundo) ? branding.cor_fundo : "#e7efe9";
  const escuro = fundoEscuro(fundo);

  // Superfície dos cards: clareia levemente no tema claro e escurece no escuro.
  const painel = escuro ? misturar(fundo, "#ffffff", 0.07) : "#ffffff";
  const painelSuave = escuro ? misturar(fundo, "#ffffff", 0.12) : misturar(fundo, "#ffffff", 0.72);

  const textoBase = escuro ? "#f3f7f4" : "#14201a";
  const texto = ajustarParaContraste(textoBase, painel, 7);
  const textoSuave = ajustarParaContraste(
    escuro ? misturar(texto, painel, 0.28) : "#4b5f54",
    painel,
    4.5
  );
  const textoClaro = ajustarParaContraste(
    escuro ? misturar(texto, painel, 0.45) : "#6d8175",
    painel,
    4.5
  );

  // A cor da marca é usada como fundo de botão e também como texto.
  // Ajustamos apenas o suficiente para virar texto legível sobre a superfície.
  const primaria = ajustarParaContraste(primariaOriginal, painel, 4.5);
  const secundariaOriginal = hexParaRgb(branding.cor_secundaria)
    ? branding.cor_secundaria
    : primariaOriginal;
  const secundaria = ajustarParaContraste(secundariaOriginal, painel, 4.5);

  const sobrePrimaria = corTextoSobre(primaria);
  const sobreSecundaria = corTextoSobre(secundaria);

  const borda = escuro
    ? misturar(painel, "#ffffff", 0.22)
    : ajustarParaContraste(misturar(primariaOriginal, "#ffffff", 0.62), painel, 1.6);
  const bordaSuave = escuro ? misturar(painel, "#ffffff", 0.14) : misturar(borda, painel, 0.55);

  const rgb = hexParaRgb(primaria) ?? { r: 79, g: 121, b: 99 };
  const erro = escuro ? "#ff9b9b" : "#a92f2f";
  const alerta = escuro ? "#ffd08a" : "#8a5209";

  // Faixa superior: mantém a marca, mas garante que o texto tenha contraste.
  const topoFundo =
    contraste(primariaOriginal, "#ffffff") >= 4.5
      ? primariaOriginal
      : misturar(primariaOriginal, "#000000", 0.68);
  const topoFundo2 = misturar(topoFundo, "#000000", 0.18);
  const sobreTopo = corTextoSobre(topoFundo);

  return {
    primaria,
    primariaOriginal,
    secundaria,
    fundo,
    painel,
    painelSuave,
    texto,
    textoSuave,
    textoClaro,
    sobrePrimaria,
    sobreSecundaria,
    topoFundo,
    topoFundo2,
    sobreTopo,
    borda,
    bordaSuave,
    erro,
    alerta,
    rgb,
    escuro,
  };
}

/** Aplica o tema no elemento raiz, nos dois vocabulários usados no projeto. */
export function aplicarTema(raiz, branding = {}) {
  if (!raiz?.style) return derivarPaletaTema(branding);
  const p = derivarPaletaTema(branding);
  const vars = {
    "--cor-primaria": p.primaria,
    "--cor-secundaria": p.secundaria,
    "--cor-fundo": p.fundo,
    "--cor-painel": p.painel,
    "--cor-painel-suave": p.painelSuave,
    "--cor-topo-fundo": p.topoFundo,
    "--cor-topo-fundo-2": p.topoFundo2,
    "--cor-sobre-topo": p.sobreTopo,
    "--cor-texto": p.texto,
    "--cor-texto-suave": p.textoSuave,
    "--cor-texto-claro": p.textoClaro,
    "--cor-sobre-primaria": p.sobrePrimaria,
    "--cor-sobre-secundaria": p.sobreSecundaria,
    "--cor-borda": p.borda,
    "--cor-borda-suave": p.bordaSuave,
    "--cor-erro": p.erro,
    "--cor-alerta": p.alerta,
    "--cor-primaria-rgb": `${p.rgb.r}, ${p.rgb.g}, ${p.rgb.b}`,
    "--primaria": p.primaria,
    "--secundaria": p.secundaria,
    "--fundo": p.fundo,
    "--painel": p.painel,
    "--texto": p.texto,
    "--texto-suave": p.textoSuave,
    "--texto-claro": p.textoClaro,
    "--primaria-rgb": `${p.rgb.r}, ${p.rgb.g}, ${p.rgb.b}`,
    "--sobre-primaria": p.sobrePrimaria,
    "--borda": p.borda,
    "--borda-suave": p.bordaSuave,
    "--erro": p.erro,
    "--aviso": p.alerta,
    "--sucesso": p.escuro ? "#8fe0b4" : "#2f7a52",
    "--superficie": p.painel,
  };
  for (const [chave, valor] of Object.entries(vars)) {
    raiz.style.setProperty(chave, valor);
  }
  return p;
}
