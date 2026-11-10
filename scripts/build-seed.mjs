#!/usr/bin/env node
/**
 * Gera supabase/seed.sql a partir de templates/*.json.
 * Fonte única de verdade: os arquivos JSON versionados.
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { validarTemplate } from "../packages/shared/src/template-schema.js";

const dir = resolve(process.argv[2] ?? "templates");
const saida = resolve(process.argv[3] ?? "supabase/seed.sql");
const arquivos = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();

const blocos = [];
const vistos = new Set();

for (const arquivo of arquivos) {
  const bruto = JSON.parse(await readFile(join(dir, arquivo), "utf8"));
  const t = validarTemplate(bruto);
  if (vistos.has(t.nicho_slug)) throw new Error(`nicho_slug duplicado: ${t.nicho_slug}`);
  vistos.add(t.nicho_slug);

  const camposJson = {
    secoes: t.secoes,
    consentimentos_extras: t.consentimentos_extras ?? [],
  };

  const q = (s) => `$txt$${String(s ?? "").replaceAll("$txt$", "")}$txt$`;
  const j = (v) => `$json$${JSON.stringify(v, null, 2).replaceAll("$json$", "")}$json$`;

  blocos.push(`insert into public.templates
  (nicho_slug, nome, nome_comercial, dominio, publico, dor_principal,
   campos_json, termo_texto, consentimento_lgpd, landing_copy, versao, ativo)
values
  (${q(t.nicho_slug)}, ${q(t.nome)}, ${q(t.nome_comercial)}, ${q(t.dominio)},
   ${q(t.publico)}, ${q(t.dor_principal)},
   ${j(camposJson)}::jsonb, ${q(t.termo_texto)}, ${q(t.consentimento_lgpd)},
   ${j(t.landing_copy ?? {})}::jsonb, ${t.versao}, true)
on conflict (nicho_slug) do update set
  nome = excluded.nome,
  nome_comercial = excluded.nome_comercial,
  dominio = excluded.dominio,
  publico = excluded.publico,
  dor_principal = excluded.dor_principal,
  campos_json = excluded.campos_json,
  termo_texto = excluded.termo_texto,
  consentimento_lgpd = excluded.consentimento_lgpd,
  landing_copy = excluded.landing_copy,
  versao = excluded.versao,
  ativo = excluded.ativo,
  atualizado_em = now();`);
}

const sql = `-- GERADO AUTOMATICAMENTE por scripts/build-seed.mjs
-- Não edite à mão. Altere templates/*.json e rode: npm run templates:seed
begin;

${blocos.join("\n\n")}

commit;
`;

await writeFile(saida, sql, "utf8");
console.log(`✓ ${blocos.length} templates gravados em ${saida}`);
