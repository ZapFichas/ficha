# FichaPro

Micro-SaaS multi-tenant de **ficha de anamnese + termo de consentimento + assinatura digital + organização automática** para estúdios de tatuagem, piercing, estética e fitness.

> Nicho no marketing e no template. Generalista na arquitetura. Um código, N portas de entrada.

---

## Staging publicado

- Seletor: https://zapfichas.github.io/ficha/
- Landing tatuagem: https://zapfichas.github.io/ficha/tatuagem/
- Ficha (tenant): `https://zapfichas.github.io/ficha/tatuagem/write/?t=<slug>`
- Painel: https://zapfichas.github.io/ficha/dashboard/
- API: https://fichapro-api.zapfichas.workers.dev

Estado detalhado, pendências de storage/Drive e comandos: [docs/staging.md](docs/staging.md).

---

## O que já está neste repositório

| Camada | Status | Onde |
|---|---|---|
| Schema multi-tenant + RLS | ✅ | `supabase/migrations/` |
| Templates de 4 nichos (tatuagem, piercing, estética, fitness) | ✅ | `templates/*.json` |
| Engine de formulário parametrizada por `campos_json` | ✅ | `apps/ficha/` |
| Assinatura canvas, upload comprimido, máscaras, menor de idade, PAR-Q | ✅ | `apps/ficha/src/` |
| API pública (formulário + criação de ficha) | ✅ | `apps/api/src/routes/public.ts` |
| PDF com trilha de auditoria (hash, IP, user-agent, timestamp) | ✅ | `apps/api/src/services/pdf.ts` |
| Criptografia AES-256-GCM dos dados sensíveis | ✅ | `apps/api/src/lib/crypto.ts` |
| Storage híbrido (Drive OAuth + R2) | ✅ | `apps/api/src/services/storage.ts`, `drive.ts` |
| Fila assíncrona de PDF + retry + idempotência | ✅ | `apps/api/src/index.ts`, `services/fichas.ts` |
| Onboarding atômico (tenant + formulário + owner) | ✅ | função `criar_tenant` |
| Painel do tenant (login, onboarding, fichas, QR, branding, Drive, campos) | ✅ MVP | `apps/painel/` |
| Billing Stripe + Asaas | 🟡 receptor idempotente de webhooks | `routes/webhooks.ts` |
| Landing pages por nicho | ✅ estáticas, geradas dos templates | `scripts/build-pages.mjs` |
| Deploy GitHub Pages | ✅ workflow + Pages Source = Actions | `.github/workflows/pages.yml` |

O fluxo público está **testável localmente em modo demo**, sem Supabase, sem credenciais e sem enviar dados.

---

## Quick start (3 minutos)

Requisitos: Node 20+ (recomendado 22+).

```bash
npm install
npm run templates:validate
npm run dev        # ficha demo em http://localhost:5173
npm run dev:painel # painel em http://localhost:5174 (requer Supabase/API)
```

Abra:

- `http://localhost:5173` → seletor dos 4 nichos em modo demonstração
- `http://localhost:5173/f/demo-tatuagem` → ficha completa
- `http://localhost:5173/f/demo-fitness` → PAR-Q + liberação médica condicional
- `http://localhost:5174` → painel (configure `apps/painel/.env`)

No modo demo:

- Nenhum dado é enviado ou armazenado.
- O botão **Imprimir comprovante** gera uma visualização para impressão.
- A assinatura funciona com mouse, dedo e caneta.

Testes:

```bash
npm test                 # 29 testes (validação, URLs, schemas, cripto, PDF)
npm run typecheck        # TypeScript do Worker
npm run build            # build da ficha + painel + bundle do Worker
```

> No staging, o storage ainda não está ativo: R2 não habilitado e Drive não conectado.
> O botão Google do painel fica oculto até o provider do Supabase Auth ser configurado.

---

## Estrutura

```
apps/
  ficha/                 # SPA pública (Vite + JS puro), GitHub Pages/Cloudflare Pages
  painel/                # painel do tenant (Vite + Supabase Auth + QR)
  api/                   # Cloudflare Worker (Hono + pdf-lib + Supabase)
packages/
  shared/                # validação, CPF, datas, condicionais, hash, schema de template
templates/               # fonte de verdade do conteúdo de cada nicho
supabase/
  migrations/            # schema, RLS, storage
  seed.sql               # gerado a partir de templates/*.json
scripts/                 # validação, seed e sync de templates
docs/                    # arquitetura, API, LGPD, runbook, ADRs, fase 0
```

---

## Stack

- **Banco/Auth**: Supabase (Postgres + RLS + Auth + Storage)
- **Compute**: Cloudflare Workers
- **Frontends**: GitHub Pages (staging) ou Cloudflare Pages (build Vite estático)
- **PDF**: `pdf-lib` no Worker
- **Fila**: Cloudflare Queues
- **Storage**: Google Drive do cliente (OAuth `drive.file`) ou Cloudflare R2
- **E-mail**: Resend
- **Pagamentos**: Stripe + Asaas (webhooks idempotentes)
- **Observabilidade**: Sentry (envelope API) + Cloudflare Analytics

---

## Configuração de produção

Siga o [runbook](docs/runbook.md). Resumo:

1. Crie o projeto Supabase e rode as migrations (`supabase db push`).
2. Rode `supabase db reset` localmente ou `npm run templates:sync` no remoto.
3. Ative o **Custom Access Token Hook** (`public.custom_access_token_hook`).
4. Crie as filas `fichapro-pdf` / `fichapro-pdf-dlq` e, se for usar R2, o bucket `fichapro-fichas`.
5. Configure os secrets do Worker (`wrangler secret put ...`).
6. Crie o OAuth Client do Google (Drive) e cadastre a redirect URI.
7. Faça deploy do Worker.
8. Configure `FICHA_URL_TEMPLATE`/`PANEL_URL` e publique o site (`node scripts/build-pages.mjs`).
9. No GitHub, deixe Pages → Source = **GitHub Actions**.
10. Faça o smoke test de uma ficha de teste.

```bash
# Worker
cd apps/api
npx wrangler queues create fichapro-pdf
npx wrangler queues create fichapro-pdf-dlq
# R2 opcional: habilite no dashboard e descomente o binding no wrangler.toml
npx wrangler secret put DATA_ENCRYPTION_KEY
npx wrangler deploy

# Site (GitHub Pages / Cloudflare Pages)
node --env-file=.env.staging scripts/build-pages.mjs
# publique ./site no Cloudflare Pages, ou deixe o workflow pages.yml publicar no GitHub Pages
```

> **Nunca comite** `.dev.vars`, `.env`, chaves de criptografia ou tokens OAuth.

---

## Decisões que não se negociam

1. **RLS em toda tabela de tenant.** A função `current_tenant_id()` vem do claim JWT ou da tabela `usuarios`. O Worker público usa `service_role` apenas no servidor.
2. **Template é dado, não código.** Campo novo entra em `templates/*.json`; não existe branch por nicho.
3. **Dados sensíveis criptografados na aplicação.** O payload completo fica em `fichas.dados_cifrados` (AES-256-GCM). `dados_json` contém apenas resumo não sensível.
4. **CPF não fica em claro em metadados.** Guardamos HMAC-SHA256 + últimos 4 dígitos. O CPF completo só existe dentro do payload cifrado.
5. **PDF é assíncrono e idempotente.** Fila + retry + status. O request da ficha nunca espera o PDF.
6. **Nada de customização por cliente.** Configuração via painel (campos ativos, branding, retenção).
7. **Fase 0 manda.** Não adianta construir o nicho 5 antes de existirem 2 pagantes no nicho 1. Ver [plano de validação](docs/fase-0/plano-validacao.md).

---

## Documentação

- [Staging atual](docs/staging.md)
- [Arquitetura](docs/arquitetura.md)
- [API](docs/api.md)
- [Segurança e LGPD](docs/seguranca-lgpd.md)
- [Runbook](docs/runbook.md)
- [ADRs](docs/adr/)
- [Fase 0 — validação comercial](docs/fase-0/plano-validacao.md)
- [Script de abordagem](docs/fase-0/script-abordagem.md)
- [Roteiro de demo](docs/fase-0/roteiro-demo.md)
- [Template de prospects](docs/fase-0/prospects-template.csv)

---

## Aviso legal

O produto fornece ferramenta de registro e assinatura eletrônica. **Não é prontuário médico, não substitui avaliação profissional e não garante validade jurídica automática.** Os textos de termo/LGPD dos templates são ponto de partida e devem passar por revisão jurídica antes de uso comercial. Ver [Segurança e LGPD](docs/seguranca-lgpd.md).
