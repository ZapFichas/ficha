import { Hono } from "hono";
import { cors } from "hono/cors";
import { bodyLimit } from "hono/body-limit";
import { secureHeaders } from "hono/secure-headers";
import type { Env, PdfJob } from "./env.js";
import type { AppEnv } from "./env.js";
import { capturarErro } from "./lib/sentry.js";
import { rotasPublicas } from "./routes/public.js";
import { rotasPainel } from "./routes/panel.js";
import { rotasOnboarding } from "./routes/onboarding.js";
import { rotasDrive } from "./routes/drive-oauth.js";
import { rotasAdmin } from "./routes/admin.js";
import { rotasWebhooks } from "./routes/webhooks.js";
import {
  HttpError,
  expurgarVencidas,
  processarFichaPdf,
  reprocessarPendentes,
} from "./services/fichas.js";

const app = new Hono<AppEnv>();

app.use("*", secureHeaders());
app.use(
  "/api/*",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization", "Accept"],
    maxAge: 86400,
  })
);

app.use(
  "/api/public/fichas",
  bodyLimit({
    maxSize: 22 * 1024 * 1024,
    onError: (c) => c.json({ erro: "Envio acima do limite de 22 MB." }, 413),
  })
);

app.get("/health", (c) =>
  c.json({
    ok: true,
    servico: "fichapro-api",
    versao: "0.1.0",
    ambiente: c.env.ENVIRONMENT ?? "production",
  })
);

app.route("/api/public", rotasPublicas);
app.route("/api/panel", rotasPainel);
app.route("/api/onboarding", rotasOnboarding);
app.route("/api/drive", rotasDrive);
app.route("/api/admin", rotasAdmin);
app.route("/webhooks", rotasWebhooks);

app.notFound((c) => c.json({ erro: "Rota não encontrada." }, 404));

app.onError((err, c) => {
  if (err instanceof HttpError) {
    return c.json({ erro: err.message, detalhes: err.detalhes }, err.status as any);
  }

  console.error("Erro não tratado:", err);
  c.executionCtx.waitUntil(
    capturarErro(c.env, err, {
      rota: `${c.req.method} ${new URL(c.req.url).pathname}`,
      tenantId: c.get("usuario")?.tenantId,
    })
  );

  return c.json({ erro: "Erro interno. Tente novamente em instantes." }, 500);
});

export default {
  fetch: app.fetch,

  async queue(batch: MessageBatch, env: Env): Promise<void> {
    for (const mensagem of batch.messages) {
      const job = mensagem.body as PdfJob;
      try {
        await processarFichaPdf(env, job.fichaId);
        mensagem.ack();
      } catch (err) {
        console.error("Falha no job de PDF", job, err);
        await capturarErro(env, err, {
          rota: "queue/pdf",
          tenantId: job.tenantId,
          fichaId: job.fichaId,
        });
        mensagem.retry();
      }
    }
  },

  async scheduled(
    _event: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(
      (async () => {
        try {
          const [expurgadas, reenfileiradas] = await Promise.all([
            expurgarVencidas(env),
            reprocessarPendentes(env),
          ]);
          console.log(
            `Cron: ${expurgadas} ficha(s) expurgada(s), ${reenfileiradas} reenfileirada(s).`
          );
        } catch (err) {
          console.error("Falha no cron:", err);
          await capturarErro(env, err, { rota: "scheduled" });
        }
      })()
    );
  },
} satisfies ExportedHandler<Env>;
