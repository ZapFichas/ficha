import { Hono } from "hono";
import type { AppEnv } from "../env.js";
import { exigirAutenticacao, obterUsuarioDoToken, tokenDoHeader } from "../lib/auth.js";
import { enviarBoasVindas } from "../lib/email.js";
import { onboardingSchema } from "../lib/schemas.js";
import { clienteAdmin, clienteUsuario } from "../lib/supabase.js";
import { urlFicha, urlPainel } from "../lib/urls.js";

export const rotasOnboarding = new Hono<AppEnv>();

rotasOnboarding.post("/check-slug", async (c) => {
  const corpo = (await c.req.json().catch(() => null)) as { slug?: string } | null;
  const slug = String(corpo?.slug ?? "")
    .trim()
    .toLowerCase();

  if (!/^[a-z0-9][a-z0-9-]{2,62}$/.test(slug) || slug.endsWith("-")) {
    return c.json({ disponivel: false, motivo: "formato_invalido" });
  }

  const admin = clienteAdmin(c.env);
  const { data } = await admin.from("tenants").select("id").eq("slug", slug).maybeSingle();
  return c.json({ disponivel: !data, slug });
});

rotasOnboarding.post("/criar", async (c) => {
  const token = tokenDoHeader(c.req.header("Authorization"));
  if (!token) return c.json({ erro: "Não autenticado." }, 401);

  const usuario = await obterUsuarioDoToken(c.env, token);
  if (!usuario?.email) return c.json({ erro: "Sessão inválida." }, 401);
  const emailUsuario = usuario.email;

  const corpo = await c.req.json().catch(() => null);
  const parsed = onboardingSchema.safeParse(corpo);
  if (!parsed.success) {
    return c.json(
      {
        erro: "Dados inválidos.",
        detalhes: Object.fromEntries(
          parsed.error.issues.map((i) => [i.path.join("."), i.message])
        ),
      },
      422
    );
  }

  const { slug, nome_negocio, nicho_slug, nome_usuario, branding } = parsed.data;
  const admin = clienteAdmin(c.env);

  const { data, error } = await admin.rpc("criar_tenant", {
    p_user_id: usuario.id,
    p_email: usuario.email,
    p_slug: slug,
    p_nome_negocio: nome_negocio,
    p_nicho_slug: nicho_slug,
    p_nome_usuario: nome_usuario ?? null,
    p_branding: branding ?? {},
  });

  if (error) {
    const mensagem = error.message ?? "";
    if (error.code === "23505" && mensagem.includes("usuario_ja_vinculado")) {
      return c.json({ erro: "Sua conta já está vinculada a um estabelecimento." }, 409);
    }
    if (error.code === "23505") {
      return c.json({ erro: "Este link já está em uso. Escolha outro." }, 409);
    }
    if (mensagem.includes("template_inexistente")) {
      return c.json({ erro: "Template indisponível para este nicho." }, 422);
    }
    console.error("Erro no onboarding:", error);
    return c.json({ erro: "Não foi possível criar o estabelecimento." }, 500);
  }

  const resultado = data as {
    tenant_id: string;
    slug: string;
    formulario_id: string;
    template_slug: string;
    status: string;
  };

  // Semeia o primeiro profissional a partir do owner. Best-effort: bancos sem
  // a migration de features seguem usando o fallback de usuarios.
  c.executionCtx.waitUntil(
    (async () => {
      try {
        const { error: erroProfissional } = await admin
          .from("profissionais")
          .insert({
            tenant_id: resultado.tenant_id,
            nome: nome_usuario?.trim() || emailUsuario.split("@")[0],
            email: emailUsuario,
            especialidade: nicho_slug,
            ativo: true,
          });
        if (erroProfissional && erroProfissional.code !== "42P01") {
          console.warn("Falha ao criar profissional inicial:", erroProfissional.message);
        }
      } catch {
        // Sem migration de equipe: o fallback de usuarios continua valendo.
      }
    })()
  );

  const linkFicha = urlFicha(c.env, resultado.slug, resultado.template_slug);
  const linkPainel = urlPainel(c.env);

  c.executionCtx.waitUntil(
    enviarBoasVindas(c.env, {
      email: usuario.email,
      nomeNegocio: nome_negocio,
      linkFicha,
      linkPainel,
    }).catch((err) => console.error("Falha no e-mail de boas-vindas:", err))
  );

  return c.json(
    {
      ...resultado,
      link_ficha: linkFicha,
      painel_url: linkPainel,
      mensagem: "Estabelecimento criado com sucesso.",
    },
    201
  );
});

rotasOnboarding.get("/status", async (c) => {
  const token = tokenDoHeader(c.req.header("Authorization"));
  if (!token) return c.json({ erro: "Não autenticado." }, 401);

  const usuario = await obterUsuarioDoToken(c.env, token);
  if (!usuario) return c.json({ erro: "Sessão inválida." }, 401);

  const db = clienteUsuario(c.env, token);
  const { data: registro } = await db
    .from("usuarios")
    .select("tenant_id, role, ativo")
    .eq("id", usuario.id)
    .maybeSingle();

  if (!registro?.ativo) {
    return c.json({ vinculado: false, onboarding_necessario: true });
  }

  const { data: tenant } = await db
    .from("tenants")
    .select("slug, nome_negocio, nicho_slug, status, onboarding_concluido_em")
    .eq("id", registro.tenant_id)
    .maybeSingle();

  return c.json({
    vinculado: true,
    tenant_id: registro.tenant_id,
    role: registro.role,
    tenant,
    link_ficha: tenant ? urlFicha(c.env, tenant.slug, tenant.nicho_slug) : null,
  });
});

rotasOnboarding.post("/concluir", exigirAutenticacao, async (c) => {
  const usuario = c.get("usuario");
  const db = clienteUsuario(c.env, c.get("accessToken"));
  const { error } = await db
    .from("tenants")
    .update({ onboarding_concluido_em: new Date().toISOString() })
    .eq("id", usuario.tenantId);

  if (error) return c.json({ erro: "Não foi possível concluir o onboarding." }, 500);
  return c.json({ ok: true });
});
