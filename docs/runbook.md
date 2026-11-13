# Runbook — colocar em produção

## Pré-requisitos

- Node 20+ e npm.
- Conta Cloudflare (Workers, Pages, R2, Queues).
- Projeto Supabase.
- Conta Google Cloud (OAuth consent screen + OAuth Client Web).
- Conta Resend (opcional).
- Conta Stripe e/ou Asaas (opcional nesta fase).
- `supabase` CLI (`npm i -g supabase` ou `npx supabase`).
- `wrangler` (já é dependência do workspace).

---

## 1. Supabase

### 1.1 Criar e linkar

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
```

### 1.2 Aplicar migrations

```bash
supabase db push
```

Isso cria:

- extensões `pgcrypto`, `citext`, `pg_trgm`;
- tabelas, índices, triggers, funções;
- RLS e grants;
- bucket `fichas` e policies de storage.

### 1.3 Seed dos templates

Opção A — reset local (se usar Docker/Supabase local):

```bash
npm run templates:seed   # regenera supabase/seed.sql
supabase db reset
```

Opção B — projeto remoto:

```bash
cp .env.example .env
# preencha SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
npm run templates:sync
```

Confira:

```sql
select nicho_slug, versao, ativo from public.templates order by nicho_slug;
-- tatuagem, piercing, estetica, fitness
```

### 1.4 Ativar o hook de JWT

Dashboard → **Authentication → Hooks → Custom Access Token** → selecione
`public.custom_access_token_hook`.

Isso injeta `tenant_id` e `tenant_role` no JWT. Mesmo sem o hook, o RLS funciona pelo fallback em `usuarios`, mas o claim reduz uma consulta por policy.

### 1.5 Configurar Auth

- **Site URL**: `https://painel.seudominio.com`
- **Redirect URLs**:
  - `https://painel.seudominio.com/**`
  - `https://app.seudominio.com/**`
  - `http://localhost:5173/**`
  - `http://localhost:5174/**`
  - `http://localhost:4173/**`
  - `http://localhost:4174/**`
- Habilitar e-mail/senha e Google OAuth (se quiser login social).
- Para testes rápidos, desative "Confirm email"; em produção, mantenha ativo.
- Personalize os templates de e-mail de confirmação/recuperação.

No staging atual:

- **Site URL**: `https://zapfichas.github.io/ficha/dashboard/`
- **Redirect URLs**: as landings, os caminhos `/write/**` de cada nicho e `localhost:5173/5174`.

### 1.6 Teste de RLS (obrigatório)

Crie dois tenants e dois usuários. Autentique como tenant A e execute no SQL Editor com o JWT de A:

```sql
select count(*) from public.fichas;           -- deve contar só A
select count(*) from public.formularios;      -- só A
select count(*) from public.assinaturas;      -- só A
select count(*) from public.tenants;          -- 1 (A)
select count(*) from public.tenant_secrets;   -- 0 (sem policy)
```

Qualquer vazamento = bloqueio de release.

---

## 2. Cloudflare

### 2.1 Criar recursos

```bash
cd apps/api
npx wrangler login
npx wrangler queues create fichapro-pdf
npx wrangler queues create fichapro-pdf-dlq
npx wrangler r2 bucket create fichapro-fichas
```

Ajuste `wrangler.toml` se usar outros nomes. O bucket é privado.

### 2.2 Secrets do Worker

Gere as chaves:

```bash
openssl rand -base64 32   # DATA_ENCRYPTION_KEY
openssl rand -hex 32      # CPF_HASH_PEPPER
openssl rand -hex 32      # OAUTH_STATE_SECRET
```

Configure:

```bash
npx wrangler secret put SUPABASE_URL
npx wrangler secret put SUPABASE_ANON_KEY
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
npx wrangler secret put DATA_ENCRYPTION_KEY
npx wrangler secret put CPF_HASH_PEPPER
npx wrangler secret put OAUTH_STATE_SECRET
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put GOOGLE_OAUTH_REDIRECT_URI
npx wrangler secret put RESEND_API_KEY       # opcional
npx wrangler secret put EMAIL_FROM           # opcional
npx wrangler secret put SENTRY_DSN           # opcional
```

Variáveis não secretas (`APP_URL`, `FICHA_URL`, `PANEL_URL`, `ENVIRONMENT`) ficam em `[vars]` no `wrangler.toml`. Em produção:

```toml
[vars]
APP_URL = "https://app.seudominio.com"
FICHA_URL = "https://app.seudominio.com"
PANEL_URL = "https://painel.seudominio.com"   # ou https://app.seudominio.com/painel
FICHA_URL_TEMPLATE = "https://app.seudominio.com/{nicho}/write/?t={slug}"
ENVIRONMENT = "production"
```

`FICHA_URL_TEMPLATE` é opcional. Sem ele, o link é `FICHA_URL/f/{slug}`. Com ele, `{nicho}` e `{slug}` são substituídos — necessário para GitHub Pages ou sites estáticos com caminho por nicho. `PANEL_URL` é usada no retorno do OAuth do Drive e nos links do onboarding.

### 2.3 Deploy

```bash
npx wrangler deploy
```

O deploy publica também o consumer da fila e o cron diário (`0 6 * * *`).

Health check:

```bash
curl https://SEU-WORKER.workers.dev/health
```

---

## 3. Google Drive (OAuth)

1. Google Cloud Console → **APIs & Services** → habilite **Google Drive API**.
2. **OAuth consent screen**:
   - tipo External (ou Internal se for Workspace);
   - escopo `https://www.googleapis.com/auth/drive.file`;
   - adicione usuários de teste enquanto o app não estiver verificado.
3. **Credentials → Create credentials → OAuth client ID → Web application**.
4. Authorized redirect URI:
   - staging: `https://fichapro-api.zapfichas.workers.dev/api/drive/oauth/callback`
   - produção: `https://SEU-WORKER.workers.dev/api/drive/oauth/callback`
   - local: `http://localhost:8787/api/drive/oauth/callback`
5. Preencha `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` e `GOOGLE_OAUTH_REDIRECT_URI`.

O app usa `drive.file`: só vê arquivos/pastas que ele mesmo criou. A pasta raiz é
`FichaPro - {nome do negócio}` → `AAAA-MM` → arquivos.

Se o refresh token expirar/revogar:

- o job de PDF falha com `ErroDriveReconectar`;
- o tenant precisa reconectar em Configurações → Google Drive;
- enquanto isso, pode operar em R2 (`storage_mode = r2`).

---

## 4. Frontends (GitHub Pages)

O staging usa GitHub Pages para ficha, painel e landings. O build junta tudo em `site/`.

### 4.1 Build local

```bash
node --env-file=.env.staging scripts/build-pages.mjs
```

Variáveis usadas:

- `VITE_API_BASE=https://SEU-WORKER.workers.dev`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (chave pública, protegida por RLS)
- `PANEL_URL=https://zapfichas.github.io/ficha/dashboard/`

Estrutura gerada:

```text
site/
  index.html
  tatuagem/index.html          # landing
  tatuagem/write/index.html    # ficha (?t=slug)
  piercing/...
  estetica/...
  fitness/...
  dashboard/index.html         # painel
  404.html
```

### 4.2 Publicar

1. GitHub → Settings → Pages → Build and deployment → Source: **GitHub Actions**.
2. O workflow `.github/workflows/pages.yml` roda em push para `main` e publica `site/`.
3. Para republicar sem commit: Actions → Deploy GitHub Pages → Run workflow.

O diretório `site/` está no `.gitignore`; o artefato é gerado no CI.

### 4.3 URLs e link por tenant

No Worker (`apps/api/wrangler.toml`):

```toml
[vars]
APP_URL = "https://zapfichas.github.io/ficha/tatuagem"
FICHA_URL = "https://zapfichas.github.io/ficha/tatuagem/write"
PANEL_URL = "https://zapfichas.github.io/ficha/dashboard"
FICHA_URL_TEMPLATE = "https://zapfichas.github.io/ficha/{nicho}/write/?t={slug}"
ENVIRONMENT = "staging"
```

O QR code por tenant vira:

```text
https://zapfichas.github.io/ficha/tatuagem/write/?t=estudio-aurora
```

O app da ficha lê `t`, `slug` ou `tenant` da query string. Para demonstração:
`.../write/?demo=1&nicho=tatuagem`.

### 4.4 Cloudflare Pages (alternativa)

Os dois apps usam `base: "./"` e podem ser publicados em Pages:

- ficha: build `npm run build -w @fichapro/ficha`, output `apps/ficha/dist`;
- painel: build `npm run build -w @fichapro/painel`, output `apps/painel/dist`;
- `public/_redirects` cobre rotas de SPA;
- ajuste `FICHA_URL`/`PANEL_URL` e remova `FICHA_URL_TEMPLATE` se voltar ao formato `/f/{slug}`.

Não misture as duas origens para o mesmo tenant no mesmo QR code.


---

## 5. E-mail transacional

1. Verifique o domínio no Resend.
2. Crie a API key.
3. Configure `RESEND_API_KEY` e `EMAIL_FROM` (ex.: `FichaPro <nao-responda@seudominio.com>`).

O onboarding envia boas-vindas. Dunning/recibos ficam para o incremento de billing.

---

## 6. Billing (opcional nesta fase)

### Stripe

- Crie produtos/preços `solo`, `estudio`, `pro` (mensal e anual).
- Webhook endpoint: `https://SEU-WORKER/webhooks/stripe`.
- Eventos: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.
- Configure `STRIPE_WEBHOOK_SECRET`.
- No checkout, envie `metadata.tenant_id`.

### Asaas

- Webhook: `https://SEU-WORKER/webhooks/asaas`.
- Configure o token em `ASAAS_WEBHOOK_TOKEN` e no painel do Asaas.
- Envie `externalReference = tenant_id`.

O Worker registra cada evento em `webhook_eventos` e é idempotente.

---

## 7. Smoke test de release

1. `GET /health` responde `ok`.
2. Criar conta no painel e concluir o onboarding (nome, slug, nicho).
3. Abrir `https://zapfichas.github.io/ficha/{nicho}/write/?t={slug}` em um celular.
4. Preencher e assinar uma ficha de teste.
5. Conferir no banco:

```sql
select protocolo, status, hash_pdf, drive_file_id, r2_key, tentativas_pdf
from public.fichas order by criado_em desc limit 1;
```

6. Conferir o PDF no Drive/R2. Se `status = erro` e `erro_ultimo` citar R2/Drive, resolva o storage antes de reprocessar.
7. Conferir os eventos:

```sql
select tipo, criado_em from public.eventos order by criado_em desc limit 10;
```

8. Testar tenant B e confirmar que não vê a ficha de A.
9. Testar uma ficha de menor de idade (seção do responsável + assinatura).
10. Testar upload de imagem grande (compressão) e PDF.
11. Simular falha do Drive (desconectar) e confirmar retry/erro + alerta.

---

## 8. Troubleshooting

| Sintoma | Causa provável | Ação |
|---|---|---|
| `DATA_ENCRYPTION_KEY inválida` | chave não tem 32 bytes | gerar com `openssl rand -base64 32` |
| Ficha salva, PDF não gera | fila/consumer não deployado | `wrangler queues list`, logs do Worker |
| `Cloudflare R2 não configurado` | R2 não habilitado e Drive desconectado | habilitar R2/criar bucket ou conectar o Drive |
| `Please enable R2` (10042) | R2 não habilitado na conta | Dashboard → R2 → Enable R2 |
| `ERRO 23505` ao criar tenant | slug em uso | escolher outro slug |
| Painel não vê nada | JWT sem vínculo em `usuarios` | onboarding ou conferir hook/fallback |
| `tenant_secrets` vazio no painel | RLS bloqueia authenticated | esperado; usar `/api/drive/status` |
| Drive 401/400 | refresh token revogado | reconectar OAuth |
| PDF sem acentos | caractere fora de WinAnsi | já sanitizado; investigar texto novo |
| Upload 413 | corpo > 22 MB | comprimir/limitar documento |
| `pdf-lib` erro de fonte | texto com emoji | sanitização troca por `?` |
| Trial expirado | `trial_expira_em` | atualizar plano/status |

Logs:

```bash
cd apps/api
npx wrangler tail
```

---

## 9. Rotação e backup

- **Backup Supabase**: habilite PITR no plano; teste restore trimestral.
- **R2**: habilite versioning + lifecycle de retenção.
- **Drive**: backup é responsabilidade do cliente; ofereça export ZIP no painel.
- **Chaves**: rotação de `DATA_ENCRYPTION_KEY` exige re-encrypt (envelope `v1` → `v2`); planeje janela e script.
- **Segredos**: se vazar, revogue no provedor, rotacione o secret e invalide sessões.

---

## 10. Checklist de go-live

- [ ] Migrations aplicadas e seed conferido.
- [ ] Hook de JWT ativo.
- [ ] RLS testado com dois tenants.
- [ ] Storage escolhido: Google Drive conectado **ou** R2 habilitado com bucket privado.
- [ ] Filas e DLQ criadas.
- [ ] Secrets configurados (nenhum no git).
- [ ] OAuth do Drive testado com uma conta real (se usar Drive).
- [ ] Worker deployado e `/health` ok.
- [ ] GitHub Pages com Source = **GitHub Actions** e workflow passando.
- [ ] Painel deployado com `VITE_SUPABASE_*` e `VITE_API_BASE`.
- [ ] `PANEL_URL`, `FICHA_URL` e `FICHA_URL_TEMPLATE` conferidos no Worker.
- [ ] Provider Google do Supabase Auth configurado (se `VITE_GOOGLE_AUTH=1`).
- [ ] E-mail de boas-vindas testado.
- [ ] Sentry recebendo um erro de teste.
- [ ] Termo/LGPD revisados.
- [ ] Política de privacidade publicada.
- [ ] Primeira ficha de teste gerou PDF e hash.
- [ ] Alerta de cota/fila configurado.
