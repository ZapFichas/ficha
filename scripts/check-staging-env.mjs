#!/usr/bin/env node
/**
 * Valida .env.staging sem imprimir segredos.
 * Uso: node scripts/check-staging-env.mjs
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const path = resolve(process.argv[2] ?? ".env.staging");
let bruto;
try {
  bruto = readFileSync(path, "utf8");
} catch {
  console.error(`✗ Arquivo não encontrado: ${path}`);
  process.exit(1);
}

const env = {};
for (const linha of bruto.split(/\r?\n/)) {
  const limpa = linha.trim();
  if (!limpa || limpa.startsWith("#")) continue;
  const idx = limpa.indexOf("=");
  if (idx < 0) continue;
  const chave = limpa.slice(0, idx).trim();
  let valor = limpa.slice(idx + 1).trim();
  if (
    (valor.startsWith('"') && valor.endsWith('"')) ||
    (valor.startsWith("'") && valor.endsWith("'"))
  ) {
    valor = valor.slice(1, -1);
  }
  env[chave] = valor;
}

const erros = [];
const avisos = [];
const ok = [];

function exigir(chave, { placeholder = true } = {}) {
  const valor = env[chave];
  if (!valor) {
    erros.push(`${chave}: ausente`);
    return null;
  }
  if (placeholder && (/^<.*>$/.test(valor) || valor.includes("<...>") || valor.includes("__GERAR_"))) {
    erros.push(`${chave}: ainda está com placeholder`);
    return null;
  }
  return valor;
}

function urlValida(chave, { https = true } = {}) {
  const valor = exigir(chave);
  if (!valor) return null;
  try {
    const url = new URL(valor);
    if (https && url.protocol !== "https:") {
      erros.push(`${chave}: deve usar https`);
      return null;
    }
    ok.push(`${chave}: ${url.origin}${url.pathname === "/" ? "" : url.pathname}`);
    return url;
  } catch {
    erros.push(`${chave}: URL inválida`);
    return null;
  }
}

// 1. Supabase
const supabaseUrl = urlValida("SUPABASE_URL");
const anon = exigir("SUPABASE_ANON_KEY");
const service = exigir("SUPABASE_SERVICE_ROLE_KEY");
const access = exigir("SUPABASE_ACCESS_TOKEN");
const ref = exigir("SUPABASE_PROJECT_REF");
const dbPass = exigir("SUPABASE_DB_PASSWORD");

if (supabaseUrl && !supabaseUrl.hostname.endsWith(".supabase.co")) {
  erros.push("SUPABASE_URL: host não termina em .supabase.co");
}
if (ref && !/^[a-z0-9]{10,30}$/.test(ref)) {
  avisos.push("SUPABASE_PROJECT_REF: formato inesperado (verifique)");
}
if (access && !access.startsWith("sbp_")) {
  avisos.push("SUPABASE_ACCESS_TOKEN: normalmente começa com sbp_");
}
if (dbPass && dbPass.length < 8) {
  erros.push("SUPABASE_DB_PASSWORD: muito curta");
}

function lerJwt(valor, chave) {
  if (!valor) return null;
  const partes = valor.split(".");
  if (partes.length !== 3) {
    erros.push(`${chave}: não parece um JWT`);
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(partes[1], "base64url").toString("utf8"));
    return payload;
  } catch {
    erros.push(`${chave}: payload JWT ilegível`);
    return null;
  }
}

const payloadAnon = lerJwt(anon, "SUPABASE_ANON_KEY");
const payloadService = lerJwt(service, "SUPABASE_SERVICE_ROLE_KEY");
if (payloadAnon && payloadAnon.role !== "anon") {
  avisos.push(`SUPABASE_ANON_KEY: role=${payloadAnon.role ?? "?"} (esperado anon)`);
} else if (payloadAnon) {
  ok.push("SUPABASE_ANON_KEY: JWT role=anon");
}
if (payloadService && payloadService.role !== "service_role") {
  erros.push(`SUPABASE_SERVICE_ROLE_KEY: role=${payloadService.role ?? "?"} (esperado service_role)`);
} else if (payloadService) {
  ok.push("SUPABASE_SERVICE_ROLE_KEY: JWT role=service_role");
}
if (payloadAnon?.ref && ref && payloadAnon.ref !== ref) {
  avisos.push(`SUPABASE_PROJECT_REF difere do ref do JWT (${payloadAnon.ref})`);
}

// 2. Cloudflare
const cfToken = exigir("CLOUDFLARE_API_TOKEN");
const cfConta = exigir("CLOUDFLARE_ACCOUNT_ID");
const cfZona = env.CLOUDFLARE_ZONE_ID?.trim();
if (cfToken && cfToken.length < 20) erros.push("CLOUDFLARE_API_TOKEN: muito curto");
if (cfToken) ok.push("CLOUDFLARE_API_TOKEN: preenchido");
if (cfConta && !/^[a-f0-9]{32}$/i.test(cfConta)) {
  avisos.push("CLOUDFLARE_ACCOUNT_ID: formato inesperado (esperado 32 hex)");
} else if (cfConta) {
  ok.push("CLOUDFLARE_ACCOUNT_ID: formato ok");
}
if (cfZona) {
  if (!/^[a-f0-9]{32}$/i.test(cfZona)) avisos.push("CLOUDFLARE_ZONE_ID: formato inesperado");
  else ok.push("CLOUDFLARE_ZONE_ID: formato ok");
}

// 3. URLs
const fichaUrl = urlValida("FICHA_URL");
const painelUrl = urlValida("PANEL_URL");
const appUrl = urlValida("APP_URL");
if (env.ENVIRONMENT !== "staging") avisos.push("ENVIRONMENT: esperado staging");
if (fichaUrl?.hostname === "localhost") avisos.push("FICHA_URL: localhost em staging");
if (painelUrl?.hostname === "localhost") avisos.push("PANEL_URL: localhost em staging");

// 4. Segredos
const dataKey = exigir("DATA_ENCRYPTION_KEY");
const pepper = exigir("CPF_HASH_PEPPER");
const oauth = exigir("OAUTH_STATE_SECRET");
if (dataKey) {
  try {
    const bytes = Buffer.from(dataKey, "base64");
    if (bytes.length !== 32) erros.push(`DATA_ENCRYPTION_KEY: ${bytes.length} bytes (esperado 32)`);
    else ok.push("DATA_ENCRYPTION_KEY: 32 bytes");
  } catch {
    erros.push("DATA_ENCRYPTION_KEY: base64 inválido");
  }
}
if (pepper && !/^[a-f0-9]{64}$/i.test(pepper)) {
  erros.push("CPF_HASH_PEPPER: esperado 64 caracteres hex");
} else if (pepper) ok.push("CPF_HASH_PEPPER: 64 hex");
if (oauth && !/^[a-f0-9]{64}$/i.test(oauth)) {
  avisos.push("OAUTH_STATE_SECRET: não é 64 hex (funciona, mas gere 32 bytes)");
} else if (oauth) ok.push("OAUTH_STATE_SECRET: 64 hex");

// 5. Google
const googleId = exigir("GOOGLE_CLIENT_ID");
const googleSecret = exigir("GOOGLE_CLIENT_SECRET");
const redirect = urlValida("GOOGLE_OAUTH_REDIRECT_URI");
if (googleId && !googleId.endsWith(".apps.googleusercontent.com")) {
  erros.push("GOOGLE_CLIENT_ID: não termina em .apps.googleusercontent.com");
} else if (googleId) ok.push("GOOGLE_CLIENT_ID: formato ok");
if (googleSecret && !googleSecret.startsWith("GOCSPX-")) {
  avisos.push("GOOGLE_CLIENT_SECRET: normalmente começa com GOCSPX-");
}
if (redirect && !redirect.pathname.endsWith("/api/drive/oauth/callback")) {
  erros.push("GOOGLE_OAUTH_REDIRECT_URI: path deve ser /api/drive/oauth/callback");
}

// 6-9. Opcionais
const opcionais = [
  "RESEND_API_KEY",
  "EMAIL_FROM",
  "SENTRY_DSN",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "ASAAS_API_KEY",
  "ASAAS_WEBHOOK_TOKEN",
  "ASAAS_BASE_URL",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
  "VITE_API_BASE",
];
const preenchidos = opcionais.filter((k) => env[k] && !/^<.*>$/.test(env[k]));
const vazios = opcionais.filter((k) => !env[k] || /^<.*>$/.test(env[k]));

if (env.VITE_SUPABASE_URL && supabaseUrl && env.VITE_SUPABASE_URL !== env.SUPABASE_URL) {
  avisos.push("VITE_SUPABASE_URL difere de SUPABASE_URL");
}
if (env.VITE_SUPABASE_ANON_KEY && anon && env.VITE_SUPABASE_ANON_KEY !== anon) {
  avisos.push("VITE_SUPABASE_ANON_KEY difere de SUPABASE_ANON_KEY");
}
if (env.VITE_API_BASE && redirect) {
  try {
    const api = new URL(env.VITE_API_BASE);
    if (api.origin !== redirect.origin) {
      avisos.push("VITE_API_BASE e GOOGLE_OAUTH_REDIRECT_URI estão em origens diferentes");
    }
  } catch {
    avisos.push("VITE_API_BASE: URL inválida");
  }
}

console.log("=== STAGING ENV ===");
for (const item of ok) console.log(`✓ ${item}`);
if (avisos.length) {
  console.log("\n=== AVISOS ===");
  for (const item of avisos) console.log(`! ${item}`);
}
if (erros.length) {
  console.log("\n=== ERROS ===");
  for (const item of erros) console.log(`✗ ${item}`);
}
console.log("\n=== OPCIONAIS ===");
console.log(`Preenchidos: ${preenchidos.length ? preenchidos.join(", ") : "nenhum"}`);
console.log(`Vazios/placeholder: ${vazios.length ? vazios.join(", ") : "nenhum"}`);
console.log(`\nResultado: ${erros.length ? "FALHOU" : "OK"} (${erros.length} erro(s), ${avisos.length} aviso(s))`);
process.exitCode = erros.length ? 1 : 0;
