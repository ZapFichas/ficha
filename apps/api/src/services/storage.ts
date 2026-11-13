import type { Env } from "../env.js";
import { DriveStorage } from "./drive.js";

export interface EntradaUpload {
  key: string;
  bytes: Uint8Array;
  contentType: string;
  fileName: string;
  /** Pastas intermediárias, ex.: ["2026-11"] */
  pastas?: string[];
}

export interface ResultadoUpload {
  key: string;
  externalId?: string;
  url?: string;
}

export interface StorageAdapter {
  readonly modo: "r2" | "drive";
  upload(entrada: EntradaUpload): Promise<ResultadoUpload>;
  download(ref: { key?: string | null; externalId?: string | null }): Promise<{
    bytes: Uint8Array;
    contentType: string;
  } | null>;
  delete(ref: { key?: string | null; externalId?: string | null }): Promise<void>;
}

export class R2Storage implements StorageAdapter {
  readonly modo = "r2" as const;

  constructor(private readonly env: Env) {}

  async upload(entrada: EntradaUpload): Promise<ResultadoUpload> {
    if (!this.env.FICHAS_BUCKET) {
      throw new Error(
        "Cloudflare R2 não configurado. Conecte o Google Drive ou habilite o bucket R2."
      );
    }
    await this.env.FICHAS_BUCKET.put(entrada.key, entrada.bytes, {
      httpMetadata: { contentType: entrada.contentType },
      customMetadata: { nome: entrada.fileName },
    });
    return { key: entrada.key };
  }

  async download(ref: { key?: string | null }) {
    if (!ref.key || !this.env.FICHAS_BUCKET) return null;
    const objeto = await this.env.FICHAS_BUCKET.get(ref.key);
    if (!objeto) return null;
    return {
      bytes: new Uint8Array(await objeto.arrayBuffer()),
      contentType: objeto.httpMetadata?.contentType ?? "application/octet-stream",
    };
  }

  async delete(ref: { key?: string | null }) {
    if (ref.key && this.env.FICHAS_BUCKET) await this.env.FICHAS_BUCKET.delete(ref.key);
  }
}

export interface TenantStorageConfig {
  id: string;
  storage_mode: "drive" | "r2";
  drive_refresh_token?: string | null;
  drive_folder_id?: string | null;
  nome_negocio?: string;
}

export class ErroDriveReconectar extends Error {
  constructor(mensagem = "A conexão com o Google Drive expirou. Reconecte no painel.") {
    super(mensagem);
    this.name = "ErroDriveReconectar";
  }
}

export function obterStorage(
  env: Env,
  tenant: TenantStorageConfig
): StorageAdapter {
  if (tenant.storage_mode === "drive" && tenant.drive_refresh_token) {
    return new DriveStorage(env, {
      refreshToken: tenant.drive_refresh_token,
      folderId: tenant.drive_folder_id ?? null,
      nomeNegocio: tenant.nome_negocio ?? "FichaPro",
    });
  }
  return new R2Storage(env);
}
