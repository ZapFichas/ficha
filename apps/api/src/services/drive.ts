import type { Env } from "../env.js";
import type {
  EntradaUpload,
  ResultadoUpload,
  StorageAdapter,
} from "./storage.js";
import { ErroDriveReconectar } from "./storage.js";

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";

interface DriveConfig {
  refreshToken: string;
  folderId: string | null;
  nomeNegocio: string;
}

interface TokenCache {
  accessToken: string;
  expiraEm: number;
}

const cacheTokens = new Map<string, TokenCache>();

class ErroDriveHttp extends Error {
  constructor(public readonly status: number, mensagem: string) {
    super(mensagem);
    this.name = "ErroDriveHttp";
  }
}

/**
 * Storage no Google Drive do cliente com escopo drive.file.
 * O Worker só enxerga arquivos/pastas que ele mesmo criou.
 */
export class DriveStorage implements StorageAdapter {
  readonly modo = "drive" as const;

  constructor(private readonly env: Env, private readonly config: DriveConfig) {}

  private async accessToken(): Promise<string> {
    const cache = cacheTokens.get(this.config.refreshToken);
    if (cache && cache.expiraEm > Date.now() + 30_000) return cache.accessToken;

    if (!this.env.GOOGLE_CLIENT_ID || !this.env.GOOGLE_CLIENT_SECRET) {
      throw new ErroDriveReconectar("OAuth do Google não configurado no servidor.");
    }

    const corpo = new URLSearchParams({
      client_id: this.env.GOOGLE_CLIENT_ID,
      client_secret: this.env.GOOGLE_CLIENT_SECRET,
      refresh_token: this.config.refreshToken,
      grant_type: "refresh_token",
    });

    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: corpo,
    });

    if (!resp.ok) {
      const texto = await resp.text();
      cacheTokens.delete(this.config.refreshToken);
      // invalid_grant = refresh token revogado/expirado (inclusive apps em
      // modo "Testing" do Google, cujo token expira em 7 dias).
      if (
        resp.status === 400 ||
        resp.status === 401 ||
        texto.includes("invalid_grant") ||
        texto.includes("Token has been expired or revoked")
      ) {
        throw new ErroDriveReconectar(
          "A autorização do Google Drive expirou ou foi revogada. Reconecte a conta no painel e, se necessário, publique o app OAuth no Google Cloud."
        );
      }
      throw new Error(`Falha ao renovar token do Drive: ${resp.status} ${texto.slice(0, 500)}`);
    }

    const dados = (await resp.json()) as {
      access_token: string;
      expires_in: number;
    };
    cacheTokens.set(this.config.refreshToken, {
      accessToken: dados.access_token,
      expiraEm: Date.now() + dados.expires_in * 1000,
    });
    return dados.access_token;
  }

  private async pedir<T>(url: string, init: RequestInit = {}): Promise<T> {
    const token = await this.accessToken();
    const resp = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.headers ?? {}),
      },
    });
    if (!resp.ok) {
      const texto = await resp.text();
      if (resp.status === 401) throw new ErroDriveReconectar();
      if (resp.status === 403) {
        throw new ErroDriveReconectar(
          "O Google negou acesso ao Drive. Reconecte a conta e confira se o app OAuth está publicado."
        );
      }
      throw new ErroDriveHttp(resp.status, `Google Drive ${resp.status}: ${texto.slice(0, 500)}`);
    }
    return (await resp.json()) as T;
  }

  /** Diagnóstico usado pelo painel: token, conta e pasta raiz. */
  async testarConexao(): Promise<{
    ok: boolean;
    email: string | null;
    nome: string | null;
    pasta_id: string | null;
    pasta_ok: boolean;
    mensagem: string;
  }> {
    await this.accessToken();
    let email: string | null = null;
    let nome: string | null = null;
    try {
      const conta = await this.pedir<{
        user?: { emailAddress?: string; displayName?: string };
      }>(`${API}/about?fields=user(emailAddress,displayName)`);
      email = conta.user?.emailAddress ?? null;
      nome = conta.user?.displayName ?? null;
    } catch (err) {
      if (err instanceof ErroDriveReconectar) throw err;
    }

    let pastaId = this.config.folderId ?? null;
    let pastaOk = false;
    if (pastaId) {
      try {
        const pasta = await this.pedir<{ id: string; trashed?: boolean }>(
          `${API}/files/${encodeURIComponent(pastaId)}?fields=id,name,trashed`
        );
        pastaOk = Boolean(pasta.id) && !pasta.trashed;
      } catch (err) {
        if (err instanceof ErroDriveHttp && err.status === 404) {
          this.config.folderId = null;
          pastaId = null;
        } else if (err instanceof ErroDriveReconectar) {
          throw err;
        }
      }
    }
    if (!pastaOk) {
      pastaId = await this.garantirPastaRaiz();
      pastaOk = Boolean(pastaId);
    }

    return {
      ok: Boolean(pastaOk),
      email,
      nome,
      pasta_id: pastaId,
      pasta_ok: pastaOk,
      mensagem: pastaOk
        ? "Conexão com o Google Drive funcionando."
        : "Não foi possível acessar a pasta do FichaPro no Drive.",
    };
  }

  private async garantirPastaRaiz(): Promise<string> {
    if (this.config.folderId) return this.config.folderId;

    const nome = `FichaPro - ${this.config.nomeNegocio}`.slice(0, 120);
    const criada = await this.pedir<{ id: string }>(
      `${API}/files?fields=id`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: nome,
          mimeType: "application/vnd.google-apps.folder",
        }),
      }
    );
    this.config.folderId = criada.id;
    return criada.id;
  }

  private async garantirPasta(nome: string, pai: string): Promise<string> {
    const nomeSeguro = nome.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
    const busca = await this.pedir<{ files: Array<{ id: string; name: string }> }>(
      `${API}/files?q=${encodeURIComponent(
        `name='${nomeSeguro}' and '${pai}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`
      )}&fields=files(id,name)&pageSize=5`
    );
    if (busca.files?.length) return busca.files[0].id;

    const criada = await this.pedir<{ id: string }>(`${API}/files?fields=id`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: nome,
        mimeType: "application/vnd.google-apps.folder",
        parents: [pai],
      }),
    });
    return criada.id;
  }

  private async resolverPasta(pastas: string[] = []): Promise<string> {
    let atual = await this.garantirPastaRaiz();
    for (const pasta of pastas) {
      atual = await this.garantirPasta(pasta, atual);
    }
    return atual;
  }

  /** Cria (ou reaproveita) a pasta raiz do app no Drive do cliente. */
  async prepararPastaRaiz(): Promise<string> {
    return this.garantirPastaRaiz();
  }

  async upload(entrada: EntradaUpload): Promise<ResultadoUpload> {
    const pastaId = await this.resolverPasta(entrada.pastas);
    const boundary = `fichapro_${crypto.randomUUID()}`;
    const metadata = JSON.stringify({
      name: entrada.fileName,
      mimeType: entrada.contentType,
      parents: [pastaId],
    });

    const corpo = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n`,
      metadata,
      `\r\n--${boundary}\r\nContent-Type: ${entrada.contentType}\r\n\r\n`,
      entrada.bytes as unknown as BlobPart,
      `\r\n--${boundary}--`,
    ]);

    const token = await this.accessToken();
    const resp = await fetch(
      `${UPLOAD}/files?uploadType=multipart&fields=id,webViewLink`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body: corpo,
      }
    );

    if (!resp.ok) {
      const texto = await resp.text();
      if (resp.status === 401) throw new ErroDriveReconectar();
      throw new Error(`Falha no upload para o Drive: ${resp.status} ${texto.slice(0, 500)}`);
    }

    const dados = (await resp.json()) as { id: string; webViewLink?: string };
    return {
      key: entrada.key,
      externalId: dados.id,
      url: dados.webViewLink,
    };
  }

  async download(ref: { externalId?: string | null }) {
    if (!ref.externalId) return null;
    const token = await this.accessToken();
    const resp = await fetch(
      `${API}/files/${encodeURIComponent(ref.externalId)}?alt=media`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!resp.ok) {
      if (resp.status === 401) throw new ErroDriveReconectar();
      if (resp.status === 404) return null;
      throw new Error(`Falha ao baixar do Drive: ${resp.status}`);
    }
    return {
      bytes: new Uint8Array(await resp.arrayBuffer()),
      contentType: resp.headers.get("content-type") ?? "application/pdf",
    };
  }

  async delete(ref: { externalId?: string | null }) {
    if (!ref.externalId) return;
    const token = await this.accessToken();
    const resp = await fetch(
      `${API}/files/${encodeURIComponent(ref.externalId)}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
    );
    if (!resp.ok && resp.status !== 404) {
      if (resp.status === 401) throw new ErroDriveReconectar();
      throw new Error(`Falha ao remover do Drive: ${resp.status}`);
    }
  }
}

/** Troca o code do OAuth por tokens e garante a pasta raiz. */
export async function conectarDrive(
  env: Env,
  code: string,
  redirectUri: string,
  nomeNegocio = "Estabelecimento"
): Promise<{
  refreshToken: string;
  accessToken: string;
  expiraEm: Date;
  folderId: string;
  email: string | null;
}> {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) {
    throw new Error("OAuth do Google não configurado.");
  }

  const resp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  });

  if (!resp.ok) {
    throw new Error(`Falha ao conectar o Drive: ${resp.status} ${await resp.text()}`);
  }

  const tokens = (await resp.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  if (!tokens.refresh_token) {
    throw new Error(
      "O Google não retornou refresh_token. Revogue o acesso e conecte novamente com prompt=consent."
    );
  }

  const drive = new DriveStorage(env, {
    refreshToken: tokens.refresh_token,
    folderId: null,
    nomeNegocio,
  });
  const folderId = await drive.prepararPastaRaiz();
  if (!folderId) throw new Error("Não foi possível criar a pasta no Drive.");

  let email: string | null = null;
  try {
    const conta = await drive.testarConexao();
    email = conta.email;
  } catch {
    // A conexão principal já foi validada pela criação da pasta.
  }

  return {
    refreshToken: tokens.refresh_token,
    accessToken: tokens.access_token,
    expiraEm: new Date(Date.now() + tokens.expires_in * 1000),
    folderId,
    email,
  };
}
