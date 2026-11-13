# Staging — estado atual

Atualizado em **13/11/2026**.

## URLs publicadas

| Recurso | URL |
|---|---|
| Seletor de nichos | https://zapfichas.github.io/ficha/ |
| Landing tatuagem | https://zapfichas.github.io/ficha/tatuagem/ |
| Landing piercing | https://zapfichas.github.io/ficha/piercing/ |
| Landing estética | https://zapfichas.github.io/ficha/estetica/ |
| Landing fitness | https://zapfichas.github.io/ficha/fitness/ |
| Ficha (tenant) | https://zapfichas.github.io/ficha/tatuagem/write/?t=SEU_SLUG |
| Painel | https://zapfichas.github.io/ficha/dashboard/ |
| API | https://fichapro-api.zapfichas.workers.dev |
| Supabase | projeto `fichas` (`zprvmebwmoohksmfbnzn`) |

O alias `tattoo` também funciona: `https://zapfichas.github.io/ficha/tattoo/`.

## O que está configurado

- Supabase:
  - migrations `core`, `rls`, `storage` aplicadas;
  - 4 templates carregados;
  - hook `public.custom_access_token_hook` ativo;
  - Site URL e redirect URLs apontando para o GitHub Pages.
- RLS validado com dois usuários reais:
  - A viu só a ficha de A; B só a de B;
  - consulta cruzada retornou 0;
  - `tenant_secrets` bloqueado;
  - insert/update direto bloqueados.
- Cloudflare Worker:
  - deploy em `https://fichapro-api.zapfichas.workers.dev`;
  - secrets configurados (Supabase, criptografia, Google OAuth);
  - filas `fichapro-pdf` e `fichapro-pdf-dlq`;
  - cron diário.
- GitHub Pages:
  - `build_type = workflow`;
  - workflow `.github/workflows/pages.yml`;
  - site estático gerado por `scripts/build-pages.mjs`.
- Fluxo testado:
  - onboarding via API criou tenant `estudio-teste-mwef4294`;
  - `GET /api/public/form/:slug` retornou template e profissional;
  - `POST /api/public/fichas` criou a ficha `F261113-E52246`;
  - eventos e fila de PDF funcionaram.

## Pendências para fechar o E2E

### 1. Storage do PDF (bloqueio atual)

A ficha `F261113-E52246` ficou com status `erro`:

```text
Cloudflare R2 não configurado. Conecte o Google Drive ou habilite o bucket R2.
```

Escolha um caminho:

**A. Google Drive (recomendado para produção)**
1. Google Cloud → APIs & Services → Credentials → seu OAuth Client.
2. Adicione a redirect URI exata:
   `https://fichapro-api.zapfichas.workers.dev/api/drive/oauth/callback`
3. OAuth consent screen → Test users → adicione a conta Google que vai conectar.
4. Gere novamente o link em `GET /api/drive/oauth/start` e abra no navegador.
5. Autorize. O callback grava o refresh token criptografado.
6. Reprocesse a ficha:
   `POST /api/panel/fichas/:id/reprocessar` (owner) ou pelo painel.

**B. Cloudflare R2**
1. Dashboard Cloudflare → R2 → **Enable R2** (pode exigir método de pagamento).
2. Crie o bucket `fichapro-fichas`.
3. Descomente o binding em `apps/api/wrangler.toml`:
   ```toml
   [[r2_buckets]]
   binding = "FICHAS_BUCKET"
   bucket_name = "fichapro-fichas"
   ```
4. `npx wrangler deploy` em `apps/api`.
5. Reprocesse a ficha.

### 2. Google Auth do painel (opcional)

O botão “Continuar com Google” está oculto (`VITE_GOOGLE_AUTH=0`) porque o provider Google do **Supabase Auth** ainda não foi configurado. Para habilitar:

1. No Google Cloud, adicione a redirect URI:
   `https://zprvmebwmoohksmfbnzn.supabase.co/auth/v1/callback`
2. Supabase → Authentication → Providers → Google → habilite com Client ID/Secret.
3. No build do painel, defina `VITE_GOOGLE_AUTH=1`.
4. Rebuild/deploy do Pages.

Login por e-mail/senha já funciona.

### 3. Rotação de segredos

As chaves foram compartilhadas durante o setup. Depois de validar o staging:

- rotacione `SUPABASE_SERVICE_ROLE_KEY` (e atualize o secret do Worker);
- rotacione `CLOUDFLARE_API_TOKEN`;
- rotacione `GOOGLE_CLIENT_SECRET`, se necessário;
- mantenha `DATA_ENCRYPTION_KEY` e `CPF_HASH_PEPPER` (trocar quebra os dados existentes).

## Arquivos locais sensíveis

- `.env.staging` — ignorado pelo git.
- `apps/api/.dev.vars` — ignorado; contém a service_role para `wrangler dev`.
- `.tmp/` — ignorado; sessões de teste.

Nunca comite esses arquivos.

## Teste rápido da ficha

```text
https://zapfichas.github.io/ficha/tatuagem/write/?t=estudio-teste-mwef4294
```

Modo demonstração (sem dados reais):

```text
https://zapfichas.github.io/ficha/tatuagem/write/?demo=1&nicho=tatuagem
```

## Comandos úteis

```bash
# rebuild do site
node --env-file=.env.staging scripts/build-pages.mjs

# deploy do Worker
cd apps/api && npx wrangler deploy

# status da ficha
curl "https://fichapro-api.zapfichas.workers.dev/api/public/fichas/F261113-E52246/status?tenant=estudio-teste-mwef4294"

# logs do Worker
cd apps/api && npx wrangler tail
```
