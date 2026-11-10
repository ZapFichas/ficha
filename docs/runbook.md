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
- Para testes rápidos, desative “Confirm email”; em produção, mantenha ativo.
- Personalize os templates de e-mail de confirmação/recuperação.

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
ENVIRONMENT = "production"
```

`FICHA_URL` é usada no link/QR do cliente. `PANEL_URL` é usada no retorno do OAuth do Drive e nos links do onboarding.

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

## 4. Cloudflare Pages (ficha)

```bash
npm run build -w @fichapro/ficha
```

Publique `apps/ficha/dist` no Pages:

- Build command: `npm run build -w @fichapro/ficha`
- Output directory: `apps/ficha/dist`
- Root directory: raiz do repo
- Variável de build: `VITE_API_BASE=https://SEU-WORKER.workers.dev`
- SPA fallback: o arquivo `public/_redirects` já contém `/* /index.html 200`.

Para apontar a API sem rebuild, defina antes do bundle:

```html
<script>
  window.__FICHA_CONFIG__ = { apiBase: "https://SEU-WORKER.workers.dev" };
</script>
```

Domínios por nicho:

- `fichadetatuador.com.br` → landing + CTA para o app;
- `app.seudominio.com/f/{slug}` → ficha.

### 4.1 Painel (Cloudflare Pages)

```bash
npm run build -w @fichapro/painel
```

Publique `apps/painel/dist` em um projeto Pages separado (recomendado `painel.seudominio.com`):

- Build command: `npm run build -w @fichapro/painel`
- Output directory: `apps/painel/dist`
- Root directory: raiz do repo
- Variáveis de build:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `VITE_API_BASE=https://SEU-WORKER.workers.dev`
- `public/_redirects` já cobre as rotas da SPA.
- Ajuste `PANEL_URL` no Worker para o domínio do painel.

Alternativa: servir o painel em `app.seudominio.com/painel` exige `base: "/painel/"` no `vite.config.js` e um rewrite no Pages. O subdomínio separado é menos sujeito a erro.

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
3. Abrir `https://app/f/{slug}` em um celular.
4. Preencher e assinar uma ficha de teste.
5. Conferir no banco:

```sql
select protocolo, status, hash_pdf, drive_file_id, r2_key, tentativas_pdf
from public.fichas order by criado_em desc limit 1;
```

6. Conferir o PDF no Drive/R2.
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
- [ ] Bucket privado, policies e lifecycle.
- [ ] Filas e DLQ criadas.
- [ ] Secrets configurados (nenhum no git).
- [ ] OAuth do Drive testado com uma conta real.
- [ ] Worker deployado e `/health` ok.
- [ ] Pages deployado e `_redirects` funcionando.
- [ ] Painel deployado com `VITE_SUPABASE_*` e `VITE_API_BASE`.
- [ ] `PANEL_URL` e `FICHA_URL` conferidos no Worker.
- [ ] E-mail de boas-vindas testado.
- [ ] Sentry recebendo um erro de teste.
- [ ] Termo/LGPD revisados.
- [ ] Política de privacidade publicada.
- [ ] Primeira ficha de teste gerou PDF e hash.
- [ ] Alerta de cota/fila configurado.
