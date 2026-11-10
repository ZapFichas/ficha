import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { validarTemplateSeguro } from "../src/template-schema.js";

const arquivos = ["tatuagem", "piercing", "estetica", "fitness"];

describe("templates", () => {
  for (const nome of arquivos) {
    it(`valida ${nome}.json`, () => {
      const bruto = JSON.parse(
        readFileSync(resolve(`templates/${nome}.json`), "utf8")
      );
      const resultado = validarTemplateSeguro(bruto);
      if (!resultado.success) {
        console.error(resultado.error.issues);
      }
      expect(resultado.success).toBe(true);
      expect(resultado.data.nicho_slug).toBe(nome);
      expect(resultado.data.secoes.length).toBeGreaterThan(0);
    });
  }
});
