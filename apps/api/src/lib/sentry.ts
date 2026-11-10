import type { Env } from "../env.js";

interface ContextoErro {
  rota?: string;
  tenantId?: string;
  fichaId?: string;
  [chave: string]: unknown;
}

/**
 * Envia uma exceção para o Sentry via Envelope API, sem SDK.
 * Falhas de observabilidade nunca devem derrubar a requisição.
 */
export async function capturarErro(
  env: Env,
  erro: unknown,
  contexto: ContextoErro = {}
): Promise<void> {
  if (!env.SENTRY_DSN) return;

  try {
    const dsn = new URL(env.SENTRY_DSN);
    const chave = dsn.username;
    const projeto = dsn.pathname.replace(/^\//, "");
    if (!chave || !projeto) return;

    const eventId = crypto.randomUUID().replace(/-/g, "");
    const err = erro instanceof Error ? erro : new Error(String(erro));
    const endpoint = `${dsn.protocol}//${dsn.host}/api/${projeto}/envelope/?sentry_key=${chave}&sentry_version=7`;

    const evento = {
      event_id: eventId,
      timestamp: new Date().toISOString(),
      platform: "javascript",
      level: "error",
      environment: env.ENVIRONMENT ?? "production",
      transaction: contexto.rota,
      tags: {
        tenant_id: contexto.tenantId,
        ficha_id: contexto.fichaId,
      },
      exception: {
        values: [
          {
            type: err.name,
            value: err.message,
            stacktrace: err.stack
              ? { frames: err.stack.split("\n").slice(0, 30).map((linha) => ({ filename: linha.trim() })) }
              : undefined,
          },
        ],
      },
      extra: contexto,
    };

    const envelope = [
      JSON.stringify({ event_id: eventId, sent_at: new Date().toISOString() }),
      JSON.stringify({ type: "event" }),
      JSON.stringify(evento),
    ].join("\n");

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2500);
    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-sentry-envelope" },
      body: envelope,
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
  } catch {
    // silencioso de propósito
  }
}
