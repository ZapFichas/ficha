import { describe, expect, it } from "vitest";
import type { Env } from "../src/env.js";
import { urlFicha, urlPainel } from "../src/lib/urls.js";

const base = {
  APP_URL: "https://app.test",
  FICHA_URL: "https://app.test",
  PANEL_URL: "https://panel.test",
} as unknown as Env;

describe("URLs de ficha e painel", () => {
  it("usa o template por nicho quando configurado", () => {
    const env = {
      ...base,
      FICHA_URL_TEMPLATE: "https://app.test/{nicho}/write/?t={slug}",
    } as unknown as Env;
    expect(urlFicha(env, "estudio aurora", "tatuagem")).toBe(
      "https://app.test/tatuagem/write/?t=estudio%20aurora"
    );
  });

  it("cai no formato /f/:slug sem template", () => {
    expect(urlFicha(base, "estudio-aurora", "tatuagem")).toBe(
      "https://app.test/f/estudio-aurora"
    );
  });

  it("adiciona barra final no painel", () => {
    expect(urlPainel(base)).toBe("https://panel.test/");
    expect(urlPainel(base, "configuracoes")).toBe(
      "https://panel.test/configuracoes"
    );
  });
});
