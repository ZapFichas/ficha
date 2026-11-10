import {
  base64ParaBytes,
  bytesParaBase64,
  hmacSha256Hex,
  somenteDigitos,
  sha256Hex,
} from "@fichapro/shared";

const cacheChaves = new Map<string, CryptoKey>();

async function importarChave(chaveBase64: string): Promise<CryptoKey> {
  const cache = cacheChaves.get(chaveBase64);
  if (cache) return cache;

  const bytes = base64ParaBytes(chaveBase64);
  if (bytes.length !== 32) {
    throw new Error(
      "DATA_ENCRYPTION_KEY inválida: informe 32 bytes em base64 (openssl rand -base64 32)."
    );
  }
  const chave = await crypto.subtle.importKey(
    "raw",
    bytes,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"]
  );
  cacheChaves.set(chaveBase64, chave);
  return chave;
}

/** Criptografa JSON com AES-256-GCM. Formato: v1.<iv_b64>.<ciphertext_b64>. */
export async function criptografarJson(
  valor: unknown,
  chaveBase64: string
): Promise<string> {
  const chave = await importarChave(chaveBase64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const texto = new TextEncoder().encode(JSON.stringify(valor));
  const cifrado = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, chave, texto);
  return `v1.${bytesParaBase64(iv)}.${bytesParaBase64(new Uint8Array(cifrado))}`;
}

export async function descriptografarJson<T>(
  envelope: string,
  chaveBase64: string
): Promise<T> {
  const partes = String(envelope).split(".");
  if (partes.length !== 3 || partes[0] !== "v1") {
    throw new Error("Envelope de dados inválido.");
  }
  const chave = await importarChave(chaveBase64);
  const iv = base64ParaBytes(partes[1]);
  const cifrado = base64ParaBytes(partes[2]);
  const claro = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, chave, cifrado);
  return JSON.parse(new TextDecoder().decode(claro)) as T;
}

export async function hashCPF(cpf: string, pepper: string): Promise<string> {
  return hmacSha256Hex(pepper, somenteDigitos(cpf));
}

export async function hashBytes(bytes: Uint8Array): Promise<string> {
  return sha256Hex(bytes);
}

export function normalizarIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  let valor = String(ip).trim();
  if (valor.startsWith("::ffff:")) valor = valor.slice(7);
  if (valor === "unknown" || valor === "localhost") return null;
  // IPv4
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(valor)) {
    const ok = valor.split(".").every((p) => Number(p) >= 0 && Number(p) <= 255);
    return ok ? valor : null;
  }
  // IPv6 (validação conservadora; inet do Postgres valida o restante)
  if (/^[0-9a-f:]{2,45}$/i.test(valor) && valor.includes(":")) return valor;
  return null;
}

export function nomeArquivoSeguro(nome: string, fallback = "arquivo"): string {
  const limpo = String(nome ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
  return limpo || fallback;
}
