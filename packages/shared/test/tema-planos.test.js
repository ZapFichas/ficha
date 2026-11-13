import { describe, expect, it } from "vitest";
import {
  aplicarTema,
  aplicarCamposAtivos,
  aplicarCamposCustomizados,
  chaveMes,
  contraste,
  derivarPaletaTema,
  listarCamposCustomizados,
  mensagemUpgrade,
  normalizarCamposCustomizados,
  serieMensal,
  taxa,
  topValores,
  verificarLimite,
} from "../src/index.js";

describe("tema com contraste automático", () => {
  it("mantém texto legível em fundo escuro", () => {
    const p = derivarPaletaTema({
      cor_primaria: "#f6f3a1",
      cor_fundo: "#101a16",
    });
    expect(contraste(p.texto, p.painel)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(p.textoSuave, p.painel)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(p.primaria, p.painel)).toBeGreaterThanOrEqual(4.5);
    expect(p.escuro).toBe(true);
  });

  it("mantém texto legível em fundo claro customizado", () => {
    const p = derivarPaletaTema({
      cor_primaria: "#d6c28a",
      cor_fundo: "#fffdf5",
    });
    expect(contraste(p.texto, p.painel)).toBeGreaterThanOrEqual(7);
    expect(contraste(p.textoClaro, p.painel)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(p.sobrePrimaria, p.primaria)).toBeGreaterThanOrEqual(4.5);
  });

  it("aplica variáveis nos dois vocabulários", () => {
    const mapa = new Map();
    const raiz = { style: { setProperty: (k, v) => mapa.set(k, v) } };
    aplicarTema(raiz, { cor_primaria: "#123456", cor_fundo: "#ffffff" });
    expect(mapa.get("--primaria")).toBeTruthy();
    expect(mapa.get("--cor-primaria")).toBe(mapa.get("--primaria"));
    expect(mapa.get("--texto")).toBeTruthy();
  });
});

describe("campos customizados", () => {
  const template = {
    secoes: [
      {
        id: "identificacao",
        titulo: "Identificação",
        campos: [{ id: "nome", label: "Nome", tipo: "text", obrigatorio: true }],
      },
    ],
  };

  it("normaliza ids, opções e cria seção de extras", () => {
    const campos = normalizarCamposCustomizados([
      { label: "Profissão", tipo: "text" },
      { label: "Como nos conheceu?", tipo: "select", opcoes: ["Instagram", "Indicação"] },
    ]);
    expect(campos.map((c) => c.id)).toEqual(["custom_profissao", "custom_como_nos_conheceu"]);

    const t = aplicarCamposCustomizados(template, campos);
    const extras = t.secoes.find((s) => s.id === "informacoes_adicionais");
    expect(extras.campos).toHaveLength(2);
    expect(extras.campos[1].opcoes).toContain("Instagram");
    expect(template.secoes).toHaveLength(1);
  });

  it("anexa campo customizado a uma seção existente", () => {
    const t = aplicarCamposCustomizados(template, [
      { label: "Apelido", tipo: "text", secao_id: "identificacao" },
    ]);
    expect(t.secoes[0].campos.map((c) => c.id)).toContain("custom_apelido");
    expect(listarCamposCustomizados(t)).toHaveLength(1);
  });

  it("não duplica ids em reaplicações", () => {
    const campos = normalizarCamposCustomizados([{ label: "CPF do responsável", tipo: "text" }]);
    const t = aplicarCamposCustomizados(template, campos);
    expect(new Set(t.secoes[0].campos.map((c) => c.id)).size).toBe(t.secoes[0].campos.length);
  });

  it("mantém campos personalizados visíveis mesmo com campos_ativos", () => {
    const ativo = aplicarCamposAtivos(template, {
      secoes: [{ id: "identificacao", campos: ["nome"] }],
    });
    const t = aplicarCamposCustomizados(ativo, [
      { label: "Como nos conheceu?", tipo: "text" },
    ]);
    expect(t.secoes.find((s) => s.id === "informacoes_adicionais")?.campos).toHaveLength(1);
  });
});

describe("planos", () => {
  it("bloqueia profissionais acima do limite e indica upgrade", () => {
    const r = verificarLimite("solo", "profissionais", 1);
    expect(r.ok).toBe(false);
    expect(r.upgrade).toBe("estudio");
    expect(mensagemUpgrade("solo", "profissionais")).toMatch(/Estúdio/);
  });

  it("libera recursos ilimitados no Pro", () => {
    const r = verificarLimite("pro", "profissionais", 999);
    expect(r.ok).toBe(true);
    expect(r.limite).toBeNull();
  });

  it("bloqueia analytics no Solo", () => {
    expect(verificarLimite("solo", "analytics").ok).toBe(false);
    expect(verificarLimite("estudio", "analytics").ok).toBe(true);
  });
});

describe("analytics", () => {
  it("calcula taxa e série mensal contínua", () => {
    expect(taxa(3, 10)).toBe(30);
    expect(taxa(1, 0)).toBe(0);
    const hoje = new Date(2026, 10, 15);
    const serie = serieMensal(
      [
        { criado_em: "2026-09-02T10:00:00Z" },
        { criado_em: "2026-09-20T10:00:00Z" },
        { criado_em: "2026-11-01T10:00:00Z" },
      ],
      { meses: 3, hoje }
    );
    expect(serie.map((s) => s.mes)).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(serie.map((s) => s.total)).toEqual([2, 0, 1]);
    expect(chaveMes(new Date(2026, 0, 3))).toBe("2026-01");
  });

  it("agrupa os valores mais frequentes", () => {
    const top = topValores(
      [
        { dados_json: { profissional: "Ana" } },
        { dados_json: { profissional: "Ana" } },
        { dados_json: { profissional: "Bia" } },
      ],
      "profissional"
    );
    expect(top[0]).toMatchObject({ valor: "Ana", quantidade: 2, percentual: 66.7 });
  });
});
