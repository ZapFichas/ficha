import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../env.js";
import { clienteUsuario } from "./supabase.js";

/**
 * Valida o JWT do Supabase e carrega o usuário/tenant.
 * As consultas seguintes usam o cliente do usuário, portanto RLS é aplicado.
 */
export const exigirAutenticacao: MiddlewareHandler<AppEnv> = async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    return c.json({ erro: "Não autenticado." }, 401);
  }
  const token = header.slice(7).trim();
  if (!token) return c.json({ erro: "Não autenticado." }, 401);

  const db = clienteUsuario(c.env, token);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) {
    return c.json({ erro: "Sessão inválida ou expirada." }, 401);
  }

  const { data: usuario, error: erroUsuario } = await db
    .from("usuarios")
    .select("id, email, tenant_id, role, nome, ativo")
    .eq("id", data.user.id)
    .maybeSingle();

  if (erroUsuario) {
    return c.json({ erro: "Não foi possível carregar o usuário." }, 500);
  }
  if (!usuario || !usuario.ativo) {
    return c.json(
      {
        erro: "onboarding_necessario",
        mensagem: "Sua conta ainda não está vinculada a um estabelecimento.",
      },
      403
    );
  }

  c.set("accessToken", token);
  c.set("usuario", {
    id: usuario.id,
    email: usuario.email,
    tenantId: usuario.tenant_id,
    role: usuario.role,
    nome: usuario.nome,
  });

  await next();
};

export function exigirOwner(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const usuario = c.get("usuario");
    if (!usuario || usuario.role !== "owner") {
      return c.json({ erro: "Apenas o proprietário pode executar esta ação." }, 403);
    }
    await next();
  };
}

/** Valida um JWT e devolve o usuário do Supabase, sem exigir vínculo com tenant. */
export async function obterUsuarioDoToken(
  env: AppEnv["Bindings"],
  token: string
): Promise<{ id: string; email: string | null } | null> {
  const db = clienteUsuario(env, token);
  const { data, error } = await db.auth.getUser(token);
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

export function tokenDoHeader(header: string | undefined | null): string | null {
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice(7).trim() || null;
}
