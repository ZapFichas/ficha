import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import {
  avaliarCondicao,
  base64ParaBytes,
  formatarDataBR,
  formatarDataHoraBR,
  mascararCPF,
  montarContexto,
  valorVazio,
} from "@fichapro/shared";
import { hashBytes } from "../lib/crypto.js";

const LARGURA = 595.28;
const ALTURA = 841.89;
const MARGEM = 46;
const CONTEUDO = LARGURA - MARGEM * 2;
const RODAPE = 34;

type Cor = ReturnType<typeof rgb>;

export interface EntradaPdf {
  tenant: {
    nome_negocio: string;
    branding?: Record<string, unknown> | null;
    email_contato?: string | null;
    retencao_anos?: number;
  };
  template: {
    nome: string;
    nicho_slug: string;
    versao: number;
    termo_texto: string;
    consentimento_lgpd: string;
    secoes: Array<Record<string, any>>;
    consentimentos_extras?: Array<{ id: string; label: string; obrigatorio?: boolean }>;
  };
  ficha: {
    protocolo: string;
    cliente_nome: string;
    cliente_cpf_ultimos4: string | null;
    timestamp_assinatura: string | null;
    ip_assinatura: string | null;
    user_agent_assinatura: string | null;
    hash_conteudo: string | null;
  };
  dados: Record<string, any>;
  consentimentos: Array<{
    tipo: string;
    aceito: boolean;
    texto_aceito?: string;
    timestamp?: string;
    ip?: string | null;
  }>;
  assinaturas: Array<{
    papel: "cliente" | "responsavel";
    imagem_base64: string;
    timestamp: string;
    ip?: string | null;
    user_agent?: string | null;
    hash_conteudo?: string | null;
  }>;
  anexos: Array<{ tipo: string; nome_arquivo: string | null; status: string }>;
  geradoEm?: Date;
}

export interface ResultadoPdf {
  bytes: Uint8Array;
  hash: string;
  paginas: number;
}

function hexParaRgb(hex: unknown, fallback: Cor = rgb(0.31, 0.47, 0.39)): Cor {
  const limpo = String(hex ?? "").replace("#", "").trim();
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(limpo)) return fallback;
  const full =
    limpo.length === 3
      ? limpo
          .split("")
          .map((c) => c + c)
          .join("")
      : limpo;
  return rgb(
    parseInt(full.slice(0, 2), 16) / 255,
    parseInt(full.slice(2, 4), 16) / 255,
    parseInt(full.slice(4, 6), 16) / 255
  );
}

function clarear(cor: Cor, fator = 0.88): Cor {
  return rgb(
    cor.red + (1 - cor.red) * fator,
    cor.green + (1 - cor.green) * fator,
    cor.blue + (1 - cor.blue) * fator
  );
}

function escurecer(cor: Cor, fator = 0.25): Cor {
  return rgb(cor.red * (1 - fator), cor.green * (1 - fator), cor.blue * (1 - fator));
}

/** pdf-lib usa WinAnsi; normaliza tipografia e remove caracteres fora do encoding. */
function limparTexto(valor: unknown): string {
  return String(valor ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\t/g, "    ")
    .replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u00FF]/g, "?");
}

function quebrarLinhas(
  texto: string,
  fonte: PDFFont,
  tamanho: number,
  larguraMax: number
): string[] {
  const linhas: string[] = [];
  const paragrafos = limparTexto(texto).split(/\r?\n/);

  for (const paragrafo of paragrafos) {
    if (!paragrafo.trim()) {
      linhas.push("");
      continue;
    }
    const palavras = paragrafo.split(/\s+/);
    let atual = "";
    for (const palavra of palavras) {
      const tentativa = atual ? `${atual} ${palavra}` : palavra;
      if (fonte.widthOfTextAtSize(tentativa, tamanho) <= larguraMax) {
        atual = tentativa;
        continue;
      }
      if (atual) linhas.push(atual);
      if (fonte.widthOfTextAtSize(palavra, tamanho) <= larguraMax) {
        atual = palavra;
      } else {
        // Palavra maior que a linha: quebra por caractere.
        let pedaco = "";
        for (const char of palavra) {
          if (fonte.widthOfTextAtSize(pedaco + char, tamanho) > larguraMax) {
            linhas.push(pedaco);
            pedaco = char;
          } else {
            pedaco += char;
          }
        }
        atual = pedaco;
      }
    }
    if (atual) linhas.push(atual);
  }
  return linhas;
}

function formatarValor(campo: Record<string, any>, valor: any): {
  texto: string;
  longo: boolean;
  destaque: boolean;
} {
  if (valorVazio(valor)) return { texto: "Não informado", longo: false, destaque: false };

  if (campo.tipo === "upload") {
    return {
      texto: `Arquivo anexado: ${valor?.nome ?? "documento"}`,
      longo: false,
      destaque: false,
    };
  }
  if (Array.isArray(valor)) {
    const texto = valor.join(", ");
    return { texto, longo: texto.length > 58, destaque: false };
  }
  if (campo.tipo === "date") {
    return { texto: formatarDataBR(valor), longo: false, destaque: false };
  }
  if (campo.tipo === "cpf") {
    return { texto: mascararCPF(valor), longo: false, destaque: false };
  }
  if (campo.tipo === "number" && /valor/i.test(campo.id)) {
    const n = Number(valor);
    if (Number.isFinite(n)) {
      return {
        texto: n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
        longo: false,
        destaque: false,
      };
    }
  }
  const texto = String(valor);
  return {
    texto,
    longo: campo.tipo === "textarea" || texto.length > 58 || texto.includes("\n"),
    destaque: campo.tipo === "sim_nao" && valor === "Sim" && Boolean(campo.alerta_sim),
  };
}

export async function gerarPdfFicha(entrada: EntradaPdf): Promise<ResultadoPdf> {
  const { tenant, template, ficha, dados, consentimentos, assinaturas, anexos } = entrada;
  const geradoEm = entrada.geradoEm ?? new Date();

  const doc = await PDFDocument.create();
  doc.setTitle(`${template.nome} — ${ficha.protocolo}`);
  doc.setAuthor(tenant.nome_negocio);
  doc.setSubject("Ficha de anamnese e termo de consentimento");
  doc.setCreator("FichaPro");
  doc.setProducer("FichaPro");
  doc.setCreationDate(geradoEm);

  const fonte = await doc.embedFont(StandardFonts.Helvetica);
  const negrito = await doc.embedFont(StandardFonts.HelveticaBold);
  const italico = await doc.embedFont(StandardFonts.HelveticaOblique);

  const branding = tenant.branding ?? {};
  const primaria = hexParaRgb(branding.cor_primaria);
  const primariaClara = clarear(primaria, 0.9);
  const primariaEscura = escurecer(primaria, 0.28);
  const cinza = rgb(0.42, 0.48, 0.45);
  const cinzaClaro = rgb(0.62, 0.67, 0.64);
  const texto = rgb(0.11, 0.16, 0.13);
  const vermelho = rgb(0.65, 0.2, 0.2);
  const linhaCor = rgb(0.82, 0.87, 0.84);

  let pagina: PDFPage = doc.addPage([LARGURA, ALTURA]);
  let y = ALTURA - MARGEM;

  const novoPagina = () => {
    pagina = doc.addPage([LARGURA, ALTURA]);
    pagina.drawText(limparTexto(tenant.nome_negocio), {
      x: MARGEM,
      y: ALTURA - 28,
      size: 7,
      font: negrito,
      color: cinzaClaro,
    });
    pagina.drawText(limparTexto(`Protocolo ${ficha.protocolo}`), {
      x: LARGURA - MARGEM - 120,
      y: ALTURA - 28,
      size: 7,
      font: fonte,
      color: cinzaClaro,
    });
    pagina.drawLine({
      start: { x: MARGEM, y: ALTURA - 34 },
      end: { x: LARGURA - MARGEM, y: ALTURA - 34 },
      thickness: 0.5,
      color: linhaCor,
    });
    y = ALTURA - 50;
  };

  const garantir = (altura: number) => {
    if (y - altura < MARGEM + RODAPE) novoPagina();
  };

  const desenharLinhas = (
    linhas: string[],
    {
      x = MARGEM,
      tamanho = 9.5,
      entrelinha = 12,
      font = fonte,
      color = texto,
      larguraMax = CONTEUDO,
    }: {
      x?: number;
      tamanho?: number;
      entrelinha?: number;
      font?: PDFFont;
      color?: Cor;
      larguraMax?: number;
    } = {}
  ) => {
    for (const linha of linhas) {
      garantir(entrelinha);
      pagina.drawText(linha, {
        x,
        y: y - tamanho,
        size: tamanho,
        font,
        color,
        maxWidth: larguraMax,
      });
      y -= entrelinha;
    }
  };

  const paragrafo = (
    conteudo: string,
    opts: {
      tamanho?: number;
      entrelinha?: number;
      font?: PDFFont;
      color?: Cor;
      x?: number;
      larguraMax?: number;
      espacoDepois?: number;
    } = {}
  ) => {
    const tamanho = opts.tamanho ?? 9.5;
    const x = opts.x ?? MARGEM;
    const larguraMax = opts.larguraMax ?? CONTEUDO;
    const linhas = quebrarLinhas(conteudo, opts.font ?? fonte, tamanho, larguraMax);
    desenharLinhas(linhas, {
      x,
      tamanho,
      entrelinha: opts.entrelinha ?? tamanho * 1.38,
      font: opts.font,
      color: opts.color,
      larguraMax,
    });
    y -= opts.espacoDepois ?? 4;
  };

  const tituloSecao = (titulo: string) => {
    garantir(34);
    pagina.drawRectangle({
      x: MARGEM,
      y: y - 18,
      width: CONTEUDO,
      height: 18,
      color: primariaClara,
    });
    pagina.drawRectangle({
      x: MARGEM,
      y: y - 18,
      width: 3,
      height: 18,
      color: primaria,
    });
    pagina.drawText(limparTexto(titulo).toUpperCase(), {
      x: MARGEM + 9,
      y: y - 13,
      size: 8.5,
      font: negrito,
      color: primariaEscura,
    });
    y -= 27;
  };

  const desenharCampo = (campo: Record<string, any>) => {
    const valor = dados[campo.id];
    const fmt = formatarValor(campo, valor);

    if (fmt.longo) {
      garantir(30);
      pagina.drawText(limparTexto(campo.label), {
        x: MARGEM,
        y: y - 8,
        size: 7.5,
        font: negrito,
        color: cinza,
      });
      y -= 13;
      paragrafo(fmt.texto, {
        tamanho: 9.2,
        entrelinha: 12.4,
        color: fmt.destaque ? vermelho : texto,
        espacoDepois: 7,
      });
      return;
    }

    const linhasValor = quebrarLinhas(fmt.texto, fonte, 9.4, CONTEUDO - 152);
    const altura = Math.max(14, linhasValor.length * 12 + 5);
    garantir(altura + 4);

    pagina.drawText(limparTexto(campo.label), {
      x: MARGEM,
      y: y - 8,
      size: 7.5,
      font: negrito,
      color: cinza,
      maxWidth: 140,
    });

    let linhaY = y - 8;
    for (const linha of linhasValor) {
      pagina.drawText(linha, {
        x: MARGEM + 152,
        y: linhaY,
        size: 9.4,
        font: fonte,
        color: fmt.destaque ? vermelho : texto,
      });
      linhaY -= 12;
    }
    y -= altura;
    pagina.drawLine({
      start: { x: MARGEM, y: y + 2 },
      end: { x: LARGURA - MARGEM, y: y + 2 },
      thickness: 0.4,
      color: rgb(0.92, 0.95, 0.93),
    });
  };

  // ----------------------------------------------------------
  // Cabeçalho
  // ----------------------------------------------------------
  pagina.drawText(limparTexto(tenant.nome_negocio).toUpperCase(), {
    x: MARGEM,
    y: y - 10,
    size: 8,
    font: negrito,
    color: primaria,
  });
  pagina.drawText("FICHA DE ANAMNESE E TERMO DE CONSENTIMENTO", {
    x: MARGEM,
    y: y - 36,
    size: 17,
    font: fonte,
    color: texto,
  });
  pagina.drawText(limparTexto(template.nome), {
    x: MARGEM,
    y: y - 52,
    size: 9,
    font: italico,
    color: cinza,
    maxWidth: CONTEUDO,
  });
  pagina.drawText(limparTexto(`Protocolo: ${ficha.protocolo}`), {
    x: MARGEM,
    y: y - 72,
    size: 8.5,
    font: negrito,
    color: primariaEscura,
  });
  pagina.drawText(limparTexto(`Gerado em: ${formatarDataHoraBR(geradoEm)}`), {
    x: MARGEM,
    y: y - 84,
    size: 8,
    font: fonte,
    color: cinza,
  });
  const statusDrive = anexos.length ? `${anexos.length} anexo(s)` : "sem anexos";
  pagina.drawText(limparTexto(`Documento eletrônico · ${statusDrive}`), {
    x: LARGURA - MARGEM - 150,
    y: y - 84,
    size: 8,
    font: fonte,
    color: cinzaClaro,
    maxWidth: 150,
  });
  y -= 98;
  pagina.drawLine({
    start: { x: MARGEM, y },
    end: { x: LARGURA - MARGEM, y },
    thickness: 1.4,
    color: primaria,
  });
  y -= 12;

  // ----------------------------------------------------------
  // Corpo
  // ----------------------------------------------------------
  const ctx = montarContexto({ secoes: template.secoes }, dados, geradoEm);

  for (const secao of template.secoes) {
    if (!avaliarCondicao(secao.condicional, ctx)) continue;
    const campos = (secao.campos ?? []).filter((campo: any) =>
      avaliarCondicao(campo.condicional, ctx)
    );
    if (!campos.length) continue;

    tituloSecao(secao.titulo);
    for (const campo of campos) desenharCampo(campo);
    y -= 8;
  }

  // ----------------------------------------------------------
  // Termo e consentimentos
  // ----------------------------------------------------------
  const porTipo = new Map(consentimentos.map((c) => [c.tipo, c]));

  tituloSecao("Termo de consentimento");
  paragrafo(template.termo_texto, {
    tamanho: 8.8,
    entrelinha: 11.8,
    color: texto,
    espacoDepois: 8,
  });

  const aceiteTermo = porTipo.get("termo");
  garantir(20);
  pagina.drawText(
    limparTexto(
      `Aceite do cliente: ${aceiteTermo?.aceito ? "Sim" : "Não informado"}${
        aceiteTermo?.timestamp
          ? ` · ${formatarDataHoraBR(aceiteTermo.timestamp)}`
          : ""
      }${aceiteTermo?.ip ? ` · IP ${aceiteTermo.ip}` : ""}`
    ),
    { x: MARGEM, y: y - 9, size: 8, font: negrito, color: aceiteTermo?.aceito ? primariaEscura : vermelho }
  );
  y -= 22;

  tituloSecao("Privacidade e LGPD");
  paragrafo(template.consentimento_lgpd, {
    tamanho: 8.6,
    entrelinha: 11.5,
    color: texto,
    espacoDepois: 8,
  });

  const aceiteLgpd = porTipo.get("lgpd");
  garantir(20);
  pagina.drawText(
    limparTexto(
      `Autorização LGPD: ${aceiteLgpd?.aceito ? "Sim" : "Não informado"}${
        aceiteLgpd?.timestamp ? ` · ${formatarDataHoraBR(aceiteLgpd.timestamp)}` : ""
      }${aceiteLgpd?.ip ? ` · IP ${aceiteLgpd.ip}` : ""}`
    ),
    { x: MARGEM, y: y - 9, size: 8, font: negrito, color: aceiteLgpd?.aceito ? primariaEscura : vermelho }
  );
  y -= 22;

  const extras = (template.consentimentos_extras ?? []).filter((extra) => {
    const c = porTipo.get(`extra:${extra.id}`);
    return c ? c.aceito : false;
  });
  if (extras.length) {
    tituloSecao("Outras autorizações");
    for (const extra of extras) {
      garantir(18);
      paragrafo(`Sim — ${extra.label}`, {
        tamanho: 8.6,
        entrelinha: 11,
        color: texto,
        espacoDepois: 4,
      });
    }
    y -= 4;
  }

  // ----------------------------------------------------------
  // Assinaturas
  // ----------------------------------------------------------
  tituloSecao("Assinaturas");

  for (const assinatura of assinaturas) {
    garantir(120);
    const titulo =
      assinatura.papel === "cliente"
        ? "Assinatura do cliente"
        : "Assinatura do responsável legal";

    pagina.drawText(limparTexto(titulo), {
      x: MARGEM,
      y: y - 9,
      size: 8,
      font: negrito,
      color: cinza,
    });
    y -= 15;

    try {
      const bytes = base64ParaBytes(assinatura.imagem_base64);
      const ehPng = bytes[0] === 0x89 && bytes[1] === 0x50;
      const imagem = ehPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      const escala = Math.min(220 / imagem.width, 80 / imagem.height, 1);
      const largura = imagem.width * escala;
      const altura = imagem.height * escala;

      pagina.drawRectangle({
        x: MARGEM,
        y: y - 92,
        width: 260,
        height: 96,
        borderColor: linhaCor,
        borderWidth: 0.6,
        color: rgb(1, 1, 1),
      });
      pagina.drawImage(imagem, {
        x: MARGEM + 16,
        y: y - 86,
        width: largura,
        height: altura,
      });
    } catch {
      pagina.drawRectangle({
        x: MARGEM,
        y: y - 92,
        width: 260,
        height: 96,
        borderColor: linhaCor,
        borderWidth: 0.6,
      });
      pagina.drawText("(assinatura não pôde ser renderizada)", {
        x: MARGEM + 14,
        y: y - 45,
        size: 8,
        font: italico,
        color: vermelho,
      });
    }

    const nome =
      assinatura.papel === "cliente"
        ? ficha.cliente_nome
        : dados.responsavel_nome ?? "Responsável legal";
    const cpf =
      assinatura.papel === "cliente" && ficha.cliente_cpf_ultimos4
        ? ` · CPF ***.***.***-${ficha.cliente_cpf_ultimos4}`
        : "";

    pagina.drawText(limparTexto(`${nome}${cpf}`), {
      x: MARGEM + 280,
      y: y - 24,
      size: 8.6,
      font: negrito,
      color: texto,
      maxWidth: CONTEUDO - 280,
    });
    pagina.drawText(
      limparTexto(`Assinado em: ${formatarDataHoraBR(assinatura.timestamp)}`),
      {
        x: MARGEM + 280,
        y: y - 38,
        size: 7.4,
        font: fonte,
        color: cinza,
        maxWidth: CONTEUDO - 280,
      }
    );
    pagina.drawText(limparTexto(`IP: ${assinatura.ip ?? ficha.ip_assinatura ?? "não registrado"}`), {
      x: MARGEM + 280,
      y: y - 50,
      size: 7.4,
      font: fonte,
      color: cinza,
      maxWidth: CONTEUDO - 280,
    });
    const ua = assinatura.user_agent ?? ficha.user_agent_assinatura ?? "não registrado";
    const uaLinhas = quebrarLinhas(ua, fonte, 6.8, CONTEUDO - 280);
    let uaY = y - 62;
    for (const linha of uaLinhas.slice(0, 3)) {
      pagina.drawText(limparTexto(linha), {
        x: MARGEM + 280,
        y: uaY,
        size: 6.8,
        font: fonte,
        color: cinzaClaro,
      });
      uaY -= 8;
    }
    y -= 106;
  }

  // ----------------------------------------------------------
  // Trilha de auditoria
  // ----------------------------------------------------------
  y -= 8;
  tituloSecao("Trilha de auditoria");
  const hashConteudo = ficha.hash_conteudo ?? "não registrado";

  const linhasAuditoria = [
    `Protocolo: ${ficha.protocolo}`,
    `Hash SHA-256 do conteúdo assinado: ${hashConteudo}`,
    `Assinado em: ${formatarDataHoraBR(ficha.timestamp_assinatura ?? geradoEm)}`,
    `IP da assinatura: ${ficha.ip_assinatura ?? "não registrado"}`,
    `Dispositivo: ${ficha.user_agent_assinatura ?? "não registrado"}`,
    `Template: ${template.nicho_slug} v${template.versao}`,
    `Gerado em: ${formatarDataHoraBR(geradoEm)}`,
  ];
  for (const linha of linhasAuditoria) {
    const partes = quebrarLinhas(linha, fonte, 7.6, CONTEUDO);
    for (const parte of partes) {
      garantir(11);
      pagina.drawText(limparTexto(parte), {
        x: MARGEM,
        y: y - 7,
        size: 7.6,
        font: fonte,
        color: cinza,
      });
      y -= 10;
    }
  }

  y -= 10;
  garantir(34);
  paragrafo(
    "Documento gerado eletronicamente com trilha de auditoria. A assinatura eletrônica registrada neste documento representa manifestação de vontade do signatário, nos termos do art. 10 da MP 2.200-2/2001 e da Lei 13.709/2018 (LGPD). O hash SHA-256 acima permite verificar a integridade do conteúdo assinado.",
    { tamanho: 7.2, entrelinha: 9.6, color: cinzaClaro, espacoDepois: 0 }
  );

  // ----------------------------------------------------------
  // Rodapé em todas as páginas
  // ----------------------------------------------------------
  const paginas = doc.getPages();
  const total = paginas.length;
  paginas.forEach((p, indice) => {
    p.drawLine({
      start: { x: MARGEM, y: 40 },
      end: { x: LARGURA - MARGEM, y: 40 },
      thickness: 0.5,
      color: linhaCor,
    });
    p.drawText(limparTexto(tenant.nome_negocio), {
      x: MARGEM,
      y: 29,
      size: 6.8,
      font: negrito,
      color: cinzaClaro,
    });
    p.drawText(limparTexto(`Protocolo ${ficha.protocolo}`), {
      x: LARGURA / 2 - 45,
      y: 29,
      size: 6.8,
      font: fonte,
      color: cinzaClaro,
    });
    p.drawText(`Página ${indice + 1} de ${total}`, {
      x: LARGURA - MARGEM - 58,
      y: 29,
      size: 6.8,
      font: fonte,
      color: cinzaClaro,
    });
  });

  const bytes = await doc.save();
  const hash = await hashBytes(bytes);
  return { bytes, hash, paginas: total };
}
