const API_BASE = (
  globalThis.__FICHA_CONFIG__?.apiBase ??
  import.meta.env.VITE_API_BASE ??
  ""
).replace(/\/$/, "");

async function json(resp) {
  const texto = await resp.text();
  let data = null;
  try {
    data = texto ? JSON.parse(texto) : null;
  } catch {
    data = { mensagem: texto };
  }
  if (!resp.ok) {
    const erro = new Error(
      data?.erro ?? data?.mensagem ?? `Falha na comunicação (${resp.status}).`
    );
    erro.status = resp.status;
    erro.detalhes = data?.detalhes;
    throw erro;
  }
  return data;
}

export function apiBase() {
  return API_BASE;
}

export async function buscarFormulario(slug, { sinal } = {}) {
  const url = `${API_BASE}/api/public/form/${encodeURIComponent(slug)}`;
  const resp = await fetch(url, {
    signal: sinal,
    headers: { Accept: "application/json" },
  });
  return json(resp);
}

export async function enviarFicha(payload, { sinal } = {}) {
  const resp = await fetch(`${API_BASE}/api/public/fichas`, {
    method: "POST",
    signal: sinal,
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  return json(resp);
}

export async function consultarStatus(slug, protocolo) {
  const resp = await fetch(
    `${API_BASE}/api/public/fichas/${encodeURIComponent(protocolo)}/status?tenant=${encodeURIComponent(
      slug
    )}`,
    { headers: { Accept: "application/json" } }
  );
  return json(resp);
}
