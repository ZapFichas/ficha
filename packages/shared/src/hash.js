/** Hash, HMAC, base64 e JSON canônico — compatível com browser, Worker e Node 18+. */

export function bytesParaBase64(bytes) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  if (typeof btoa === "function") return btoa(bin);
  return Buffer.from(bytes).toString("base64");
}

export function base64ParaBytes(base64) {
  const limpo = String(base64 ?? "")
    .replace(/^data:[^;]+;base64,/, "")
    .replace(/\s+/g, "");
  if (!limpo) return new Uint8Array();
  if (typeof atob === "function") {
    const bin = atob(limpo);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  return Uint8Array.from(Buffer.from(limpo, "base64"));
}

export function dataURLParaBytes(dataURL) {
  return base64ParaBytes(dataURL);
}

export async function sha256Hex(input) {
  const bytes =
    typeof input === "string" ? new TextEncoder().encode(input) : input;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hmacSha256Hex(segredo, mensagem) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(segredo),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const assinatura = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(mensagem)
  );
  return [...new Uint8Array(assinatura)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** JSON estável (chaves ordenadas) — base do hash de assinatura. */
export function canonicalJson(valor) {
  const ordenar = (v) => {
    if (Array.isArray(v)) return v.map(ordenar);
    if (v && typeof v === "object") {
      return Object.keys(v)
        .sort()
        .reduce((acc, k) => {
          if (v[k] !== undefined) acc[k] = ordenar(v[k]);
          return acc;
        }, {});
    }
    return v;
  };
  return JSON.stringify(ordenar(valor));
}

export async function hashConteudo(payload) {
  return sha256Hex(canonicalJson(payload));
}
