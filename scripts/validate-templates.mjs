#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { validarTemplateSeguro } from "../packages/shared/src/template-schema.js";

const dir = resolve(process.argv[2] ?? process.env.TEMPLATES_DIR ?? "templates");
const arquivos = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();

if (arquivos.length === 0) {
  console.error(`Nenhum template encontrado em ${dir}`);
  process.exit(1);
}

let falhas = 0;
const slugs = new Map();

for (const arquivo of arquivos) {
  const caminho = join(dir, arquivo);
  let json;
  try {
    json = JSON.parse(await readFile(caminho, "utf8"));
  } catch (err) {
    console.error(`✗ ${arquivo}: JSON inválido — ${err.message}`);
    falhas++;
    continue;
  }

  const resultado = validarTemplateSeguro(json);
  if (!resultado.success) {
    console.error(`✗ ${arquivo}`);
    for (const issue of resultado.error.issues) {
      console.error(`   - ${issue.path.join(".") || "(raiz)"}: ${issue.message}`);
    }
    falhas++;
    continue;
  }

  const t = resultado.data;
  if (slugs.has(t.nicho_slug)) {
    console.error(`✗ ${arquivo}: nicho_slug duplicado (${t.nicho_slug})`);
    falhas++;
    continue;
  }
  slugs.set(t.nicho_slug, arquivo);

  const totalCampos = t.secoes.reduce((n, s) => n + s.campos.length, 0);
  const obrigatorios = t.secoes.reduce(
    (n, s) => n + s.campos.filter((c) => c.obrigatorio).length,
    0
  );
  console.log(
    `✓ ${arquivo} — ${t.nicho_slug}: ${t.secoes.length} seções, ${totalCampos} campos (${obrigatorios} obrigatórios)`
  );
}

if (falhas) {
  console.error(`\n${falhas} template(s) com erro.`);
  process.exit(1);
}
console.log(`\n${arquivos.length} templates válidos.`);
