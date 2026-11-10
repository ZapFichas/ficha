#!/usr/bin/env node
/**
 * Sincroniza templates/*.json com um projeto Supabase remoto via REST.
 * Requer SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente ou .env.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { validarTemplate } from "../packages/shared/src/template-schema.js";

function carregarEnv() {
  try {
    if (typeof process.loadEnvFile === "function") {
      process.loadEnvFile(".env");
    }
  } catch {
    // .env é opcional
  }
}

carregarEnv();

const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ambiente ou .env).");
  process.exit(1);
}

const dir = resolve(process.argv[2] ?? "templates");
const arquivos = (await readdir(dir)).filter((f) => f.endsWith(".json")).sort();

const registros = [];
for (const arquivo of arquivos) {
  const bruto = JSON.parse(await readFile(join(dir, arquivo), "utf8"));
  const t = validarTemplate(bruto);
  registros.push({
    nicho_slug: t.nicho_slug,
    nome: t.nome,
    nome_comercial: t.nome_comercial,
    dominio: t.dominio ?? null,
    publico: t.publico ?? null,
    dor_principal: t.dor_principal ?? null,
    campos_json: {
      secoes: t.secoes,
      consentimentos_extras: t.consentimentos_extras ?? [],
    },
    termo_texto: t.termo_texto,
    consentimento_lgpd: t.consentimento_lgpd,
    landing_copy: t.landing_copy ?? {},
    versao: t.versao,
    ativo: true,
  });
}

const resp = await fetch(`${url}/rest/v1/templates?on_conflict=nicho_slug`, {
  method: "POST",
  headers: {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates,return=representation",
  },
  body: JSON.stringify(registros),
});

if (!resp.ok) {
  console.error(`✗ Supabase respondeu ${resp.status}: ${await resp.text()}`);
  process.exit(1);
}

const data = await resp.json();
console.log(`✓ ${data.length} templates sincronizados com ${url}`);
