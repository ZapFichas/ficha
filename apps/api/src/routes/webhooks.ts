import { Hono } from "hono";
import { hmacSha256Hex } from "@fichapro/shared";
import type { AppEnv } from "../env.js";
import { clienteAdmin } from "../lib/supabase.js";

export const rotasWebhooks = new Hono<AppEnv>();

function iguaisSeguro(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verificarStripe(
  corpo: string,
  header: string | undefined,
  segredo: string
): Promise<boolean> {
  if (!header) return false;
  const partes = new Map(
    header.split(",").map((p) => {
      const idx = p.indexOf("=");
      return [p.slice(0, idx).trim(), p.slice(idx + 1).trim()] as const;
    })
  );
  const timestamp = Number(partes.get("t"));
  const assinatura = partes.get("v1");
  if (!timestamp || !assinatura) return false;
  if (Math.abs(Date.now() / 1000 - timestamp) > 300) return false;

  const esperado = await hmacSha256Hex(segredo, `${timestamp}.${corpo}`);
  return iguaisSeguro(esperado, assinatura);
}

interface EventoWebhook {
  id: string;
  gateway: "stripe" | "asaas";
  payload: Record<string, any>;
}

async function processarEvento(
  env: AppEnv["Bindings"],
  evento: EventoWebhook
): Promise<string> {
  const admin = clienteAdmin(env);
  const obj = evento.payload?.data?.object ?? evento.payload?.payment ?? evento.payload;
  const tipo: string = evento.payload?.type ?? evento.payload?.event ?? "desconhecido";

  const tenantId: string | undefined =
    obj?.metadata?.tenant_id ??
    obj?.subscription_details?.metadata?.tenant_id ??
    obj?.externalReference ??
    evento.payload?.tenant_id;

  if (!tenantId) return `sem_tenant:${tipo}`;

  const atualizacao: Record<string, unknown> = {
    gateway: evento.gateway,
  };

  if (evento.gateway === "stripe") {
    if (obj?.customer) atualizacao.gateway_customer_id = obj.customer;
    if (obj?.id && String(obj.id).startsWith("sub_")) {
      atualizacao.gateway_assinatura_id = obj.id;
    }

    if (tipo === "checkout.session.completed") atualizacao.status = "ativo";
    else if (tipo === "customer.subscription.updated") {
      atualizacao.status = ["active", "trialing"].includes(obj?.status) ? "ativo" : "suspenso";
    } else if (tipo === "customer.subscription.deleted") {
      atualizacao.status = "cancelado";
    } else if (tipo === "invoice.payment_failed") {
      atualizacao.status = "suspenso";
    }
  } else {
    if (obj?.customer) atualizacao.gateway_customer_id = obj.customer;
    if (obj?.subscription) atualizacao.gateway_assinatura_id = obj.subscription;

    if (["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"].includes(tipo)) {
      atualizacao.status = "ativo";
    } else if (tipo === "PAYMENT_OVERDUE") {
      atualizacao.status = "suspenso";
    } else if (["SUBSCRIPTION_DELETED", "SUBSCRIPTION_INACTIVATED"].includes(tipo)) {
      atualizacao.status = "cancelado";
    }
  }

  const { error } = await admin.from("tenants").update(atualizacao).eq("id", tenantId);
  if (error) throw new Error(`Falha ao atualizar tenant: ${error.message}`);
  return tipo;
}

async function registrarProcessar(
  env: AppEnv["Bindings"],
  evento: EventoWebhook
): Promise<{ duplicado: boolean; resultado?: string }> {
  const admin = clienteAdmin(env);

  const { data: existente } = await admin
    .from("webhook_eventos")
    .select("id, processado_em, erro")
    .eq("id", evento.id)
    .maybeSingle();

  if (existente?.processado_em) return { duplicado: true };
  if (!existente) {
    const { error } = await admin.from("webhook_eventos").insert({
      id: evento.id,
      gateway: evento.gateway,
      payload: evento.payload,
    });
    if (error && error.code !== "23505") {
      throw new Error(`Falha ao registrar webhook: ${error.message}`);
    }
  }

  try {
    const resultado = await processarEvento(env, evento);
    await admin
      .from("webhook_eventos")
      .update({ processado_em: new Date().toISOString(), erro: null })
      .eq("id", evento.id);
    return { duplicado: false, resultado };
  } catch (err) {
    await admin
      .from("webhook_eventos")
      .update({ erro: err instanceof Error ? err.message : String(err) })
      .eq("id", evento.id);
    throw err;
  }
}

rotasWebhooks.post("/stripe", async (c) => {
  if (!c.env.STRIPE_WEBHOOK_SECRET) {
    return c.json({ erro: "Webhook Stripe não configurado." }, 503);
  }
  const corpo = await c.req.text();
  const valido = await verificarStripe(
    corpo,
    c.req.header("stripe-signature"),
    c.env.STRIPE_WEBHOOK_SECRET
  );
  if (!valido) return c.json({ erro: "Assinatura inválida." }, 400);

  const payload = JSON.parse(corpo) as Record<string, any>;
  const id = String(payload.id ?? `stripe_${Date.now()}`);

  const { duplicado, resultado } = await registrarProcessar(c.env, {
    id,
    gateway: "stripe",
    payload,
  });
  return c.json({ ok: true, duplicado, resultado });
});

rotasWebhooks.post("/asaas", async (c) => {
  if (!c.env.ASAAS_WEBHOOK_TOKEN) {
    return c.json({ erro: "Webhook Asaas não configurado." }, 503);
  }
  const token = c.req.header("asaas-access-token");
  if (!token || !iguaisSeguro(token, c.env.ASAAS_WEBHOOK_TOKEN)) {
    return c.json({ erro: "Token inválido." }, 401);
  }

  const payload = (await c.req.json().catch(() => null)) as Record<string, any> | null;
  if (!payload) return c.json({ erro: "JSON inválido." }, 400);

  const id = String(
    payload.id ??
      `${payload.event}_${payload.payment?.id ?? Date.now()}`
  );

  const { duplicado, resultado } = await registrarProcessar(c.env, {
    id,
    gateway: "asaas",
    payload,
  });
  return c.json({ ok: true, duplicado, resultado });
});
