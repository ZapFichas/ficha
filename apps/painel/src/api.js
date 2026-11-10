import { CONFIG } from "./config.js";
import { supabase, tokenAtual } from "./supabase.js";

export class ApiError extends Error {
  constructor(status, mensagem, detalhes = null) {
    super(mensagem);
    this.name = "ApiError";
    this.status = status;
    this.detalhes = detalhes;
  }
}

async function tratar(resp) {
  const texto = await resp.text();
  let dados = null;
  try {
    dados = texto ? JSON.parse(texto) : null;
  } catch {
    dados = { erro: texto };
  }
  if (!resp.ok) {
    throw new ApiError(
      resp.status,
      dados?.erro ?? dados?.mensagem ?? `Falha na comunicação (${resp.status}).`,
      dados?.detalhes ?? null
    );
  }
  return dados;
}

export async function api(path, { method = "GET", body, headers = {} } = {}) {
  const token = await tokenAtual();
  if (!token) throw new ApiError(401, "Sessão expirada. Entre novamente.");

  const resp = await fetch(`${CONFIG.apiBase}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  try {
    return await tratar(resp);
  } catch (err) {
    if (err.status === 401 && supabase) await supabase.auth.signOut();
    throw err;
  }
}

export async function baixarPdf(fichaId, protocolo) {
  const token = await tokenAtual();
  if (!token) throw new ApiError(401, "Sessão expirada.");

  const resp = await fetch(`${CONFIG.apiBase}/api/panel/fichas/${fichaId}/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!resp.ok) {
    let mensagem = "Não foi possível baixar o PDF.";
    try {
      const dados = await resp.json();
      mensagem = dados?.erro ?? mensagem;
    } catch {
      // resposta não-JSON
    }
    throw new ApiError(resp.status, mensagem);
  }

  const blob = await resp.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${protocolo ?? "ficha"}.pdf`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
