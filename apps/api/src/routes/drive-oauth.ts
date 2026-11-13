import { Hono } from "hono";
import { SignJWT, jwtVerify } from "jose";
import type { AppEnv } from "../env.js";
import { exigirAutenticacao, exigirOwner } from "../lib/auth.js";
import { criptografarJson, descriptografarJson } from "../lib/crypto.js";
import { clienteAdmin } from "../lib/supabase.js";
import { urlPainel } from "../lib/urls.js";
import { conectarDrive, DriveStorage } from "../services/drive.js";
import { ErroDriveReconectar } from "../services/storage.js";

export const rotasDrive = new Hono<AppEnv>();

const ESCOPO = "https://www.googleapis.com/auth/drive.file";

function segredoState(env: AppEnv["Bindings"]): Uint8Array {
  const segredo = env.OAUTH_STATE_SECRET || env.CPF_HASH_PEPPER;
  if (!segredo) throw new Error("OAUTH_STATE_SECRET não configurado.");
  return new TextEncoder().encode(segredo);
}

function redirectUri(env: AppEnv["Bindings"], origem: string): string {
  return env.GOOGLE_OAUTH_REDIRECT_URI || `${origem}/api/drive/oauth/callback`;
}

rotasDrive.get("/oauth/start", exigirAutenticacao, async (c) => {
  if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET) {
    return c.json(
      { erro: "A conexão com o Google Drive ainda não está disponível." },
      503
    );
  }

  const usuario = c.get("usuario");
  const ruri = redirectUri(c.env, new URL(c.req.url).origin);

  const state = await new SignJWT({ tid: usuario.tenantId, ruri })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(usuario.id)
    .setIssuedAt()
    .setExpirationTime("10m")
    .sign(segredoState(c.env));

  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", c.env.GOOGLE_CLIENT_ID);
  url.searchParams.set("redirect_uri", ruri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", ESCOPO);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", state);

  c.header("Cache-Control", "no-store");
  return c.json({ url: url.toString(), redirect_uri: ruri });
});

rotasDrive.get("/oauth/callback", async (c) => {
  const destinoErro = (motivo: string) =>
    c.redirect(
      `${urlPainel(c.env)}?drive=erro&motivo=${encodeURIComponent(motivo)}#/configuracoes`
    );

  const erroGoogle = c.req.query("error");
  if (erroGoogle) return destinoErro(erroGoogle);

  const code = c.req.query("code");
  const state = c.req.query("state");
  if (!code || !state) return destinoErro("parametros_ausentes");

  let claims: { sub?: string; tid?: string; ruri?: string };
  try {
    const verificado = await jwtVerify(state, segredoState(c.env));
    claims = verificado.payload as typeof claims;
  } catch {
    return destinoErro("state_invalido");
  }

  if (!claims.tid || !claims.sub) return destinoErro("state_incompleto");

  const admin = clienteAdmin(c.env);
  const { data: tenant } = await admin
    .from("tenants")
    .select("id, nome_negocio, status")
    .eq("id", claims.tid)
    .maybeSingle();

  if (!tenant) return destinoErro("estabelecimento_inexistente");

  const { data: usuario } = await admin
    .from("usuarios")
    .select("id")
    .eq("id", claims.sub)
    .eq("tenant_id", claims.tid)
    .maybeSingle();

  if (!usuario) return destinoErro("usuario_sem_permissao");

  try {
    const ruri = claims.ruri || redirectUri(c.env, new URL(c.req.url).origin);
    const conectado = await conectarDrive(
      c.env,
      code,
      ruri,
      tenant.nome_negocio
    );

    const [refreshEnc, accessEnc] = await Promise.all([
      criptografarJson({ token: conectado.refreshToken }, c.env.DATA_ENCRYPTION_KEY),
      criptografarJson({ token: conectado.accessToken }, c.env.DATA_ENCRYPTION_KEY),
    ]);

    const { error } = await admin.from("tenant_secrets").upsert(
      {
        tenant_id: tenant.id,
        drive_refresh_token_enc: refreshEnc,
        drive_access_token_enc: accessEnc,
        drive_token_expira_em: conectado.expiraEm.toISOString(),
        drive_folder_id: conectado.folderId,
        drive_email: conectado.email,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "tenant_id" }
    );

    if (error) throw new Error(error.message);

    await admin
      .from("tenants")
      .update({ storage_mode: "drive" })
      .eq("id", tenant.id);

    return c.redirect(`${urlPainel(c.env)}?drive=conectado#/configuracoes`);
  } catch (err) {
    console.error("Erro no callback do Drive:", err);
    const mensagem = err instanceof Error ? err.message : "erro_desconhecido";
    return destinoErro(mensagem);
  }
});

rotasDrive.get("/status", exigirAutenticacao, async (c) => {
  const usuario = c.get("usuario");
  const admin = clienteAdmin(c.env);

  const { data: segredos } = await admin
    .from("tenant_secrets")
    .select("drive_refresh_token_enc, drive_folder_id, drive_email, atualizado_em")
    .eq("tenant_id", usuario.tenantId)
    .maybeSingle();

  const { data: tenant } = await admin
    .from("tenants")
    .select("storage_mode")
    .eq("id", usuario.tenantId)
    .maybeSingle();

  return c.json({
    conectado: Boolean(segredos?.drive_refresh_token_enc),
    storage_mode: tenant?.storage_mode ?? "r2",
    r2_configurado: Boolean(c.env.FICHAS_BUCKET),
    google_configurado: Boolean(c.env.GOOGLE_CLIENT_ID && c.env.GOOGLE_CLIENT_SECRET),
    folder_id: segredos?.drive_folder_id ?? null,
    email: segredos?.drive_email ?? null,
    atualizado_em: segredos?.atualizado_em ?? null,
  });
});

rotasDrive.post("/testar", exigirAutenticacao, exigirOwner(), async (c) => {
  const usuario = c.get("usuario");
  const admin = clienteAdmin(c.env);
  const { data: segredos } = await admin
    .from("tenant_secrets")
    .select("drive_refresh_token_enc, drive_folder_id")
    .eq("tenant_id", usuario.tenantId)
    .maybeSingle();

  if (!segredos?.drive_refresh_token_enc) {
    return c.json(
      {
        ok: false,
        precisa_reconectar: true,
        mensagem: "O Google Drive ainda não está conectado.",
      },
      409
    );
  }

  try {
    const token = await descriptografarJson<{ token: string }>(
      segredos.drive_refresh_token_enc,
      c.env.DATA_ENCRYPTION_KEY
    );
    const drive = new DriveStorage(c.env, {
      refreshToken: token.token,
      folderId: segredos.drive_folder_id ?? null,
      nomeNegocio: "FichaPro",
    });
    const resultado = await drive.testarConexao();
    return c.json({
      ...resultado,
      precisa_reconectar: false,
      storage_mode: "drive",
    });
  } catch (err) {
    const reconectar = err instanceof ErroDriveReconectar;
    return c.json(
      {
        ok: false,
        precisa_reconectar: reconectar,
        mensagem:
          err instanceof Error
            ? err.message
            : "Não foi possível validar a conexão com o Drive.",
      },
      reconectar ? 409 : 502
    );
  }
});

rotasDrive.post("/desconectar", exigirAutenticacao, exigirOwner(), async (c) => {
  const usuario = c.get("usuario");
  const admin = clienteAdmin(c.env);

  const { error: erroSegredos } = await admin
    .from("tenant_secrets")
    .update({
      drive_refresh_token_enc: null,
      drive_access_token_enc: null,
      drive_token_expira_em: null,
      drive_folder_id: null,
      drive_email: null,
      atualizado_em: new Date().toISOString(),
    })
    .eq("tenant_id", usuario.tenantId);

  if (erroSegredos) {
    return c.json({ erro: "Não foi possível desconectar o Drive." }, 500);
  }

  await admin
    .from("tenants")
    .update({ storage_mode: "r2" })
    .eq("id", usuario.tenantId);

  return c.json({ ok: true, storage_mode: "r2" });
});
