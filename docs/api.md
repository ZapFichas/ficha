# API â€” FichaPro Worker

Base local: `http://localhost:8787`
Base produÃ§Ã£o: `https://api.seudominio.com`

Formato: JSON. Erros seguem `{ "erro": "...", "detalhes"?: { "campo": "mensagem" } }`.

## AutenticaÃ§Ã£o

- Rotas pÃºblicas: sem token.
- Rotas do painel/onboarding/Drive: `Authorization: Bearer <access_token do Supabase>`.
- O Worker valida o JWT com `auth.getUser` e usa o cliente do usuÃ¡rio (anon key + JWT), portanto **RLS Ã© aplicado**.
- O tenant vem do claim `tenant_id` ou, como fallback, da linha em `usuarios`.

---

## PÃºblico

### `GET /api/public/form/:slug`

Retorna a configuraÃ§Ã£o da ficha do tenant. Ã‰ o que a SPA carrega no QR code.

```json
{
  "tenant": {
    "slug": "estudio-exemplo",
    "nome_negocio": "EstÃºdio Exemplo",
    "branding": {
      "cor_primaria": "#4F7963",
      "cor_secundaria": "#3a5c4a",
      "cor_fundo": "#e7efe9",
      "logo_url": null
    },
    "retencao_anos": 5,
    "email_contato": "contato@exemplo.com"
  },
  "template": {
    "nicho_slug": "tatuagem",
    "nome": "Ficha de Anamnese e Termo de Consentimento â€” Tatuagem",
    "versao": 1,
    "secoes": [{ "id": "identificacao", "titulo": "Dados de identificaÃ§Ã£o", "campos": [] }],
    "consentimentos_extras": [
      { "id": "autorizo_imagens", "label": "...", "obrigatorio": true }
    ],
    "termo_texto": "...",
    "consentimento_lgpd": "..."
  },
  "formulario": { "id": "uuid", "nome": "Ficha padrÃ£o", "campos_ativos": null },
  "profissionais": [{ "id": "uuid", "nome": "Ana Ribeiro" }],
  "config": { "api_version": 1 }
}
```

- `404` se o slug nÃ£o existir.
- `403` se o tenant estiver suspenso ou com trial expirado.
- `409` se nÃ£o houver formulÃ¡rio/template ativo.
- `Cache-Control: public, max-age=30`.

### `POST /api/public/fichas`

Cria a ficha. NÃ£o gera o PDF de forma sÃ­ncrona.

```json
{
  "tenant_slug": "estudio-exemplo",
  "template_slug": "tatuagem",
  "formulario_id": "uuid-opcional",
  "dados": {
    "nome": "JoÃ£o da Silva",
    "data_nascimento": "1990-05-12",
    "cpf": "111.444.777-35",
    "telefone": "(61) 98765-4321",
    "endereco": "Rua das Flores, 42...",
    "contato_emergencia": "Maria - (61) 98888-7777",
    "tratamento_medico": "NÃ£o",
    "alergia": "NÃ£o",
    "local_tatuagem": "AntebraÃ§o direito",
    "profissional": "Ana Ribeiro",
    "data_procedimento": "2026-11-10",
    "documento": {
      "nome": "rg.jpg",
      "mime": "image/jpeg",
      "tamanho": 182000,
      "base64": "..."
    }
  },
  "assinaturas": [
    {
      "papel": "cliente",
      "imagem_base64": "data:image/png;base64,...",
      "timestamp": "2026-11-05T14:30:00.000Z"
    }
  ],
  "consentimentos": [
    { "tipo": "termo", "aceito": true, "versao": "1" },
    { "tipo": "lgpd", "aceito": true, "versao": "1" },
    { "tipo": "extra:autorizo_imagens", "aceito": true }
  ],
  "meta": {
    "iniciado_em": "2026-11-05T14:20:00.000Z",
    "concluido_em": "2026-11-05T14:30:00.000Z",
    "user_agent": "Mozilla/5.0...",
    "idioma": "pt-BR",
    "menor_idade": false,
    "idempotencia": "uuid-gerado-no-cliente"
  }
}
```

Resposta `201`:

```json
{
  "id": "uuid",
  "protocolo": "F261105-AB12CD",
  "status": "preenchida",
  "idempotente": false,
  "mensagem": "Ficha recebida. O PDF serÃ¡ gerado e salvo automaticamente."
}
```

Regras:

- ValidaÃ§Ã£o server-side com o mesmo cÃ³digo da ficha.
- CPF validado por dÃ­gito verificador.
- Menor de 18 exige seÃ§Ã£o do responsÃ¡vel + assinatura `responsavel`.
- Termo e LGPD sÃ£o obrigatÃ³rios; extras obrigatÃ³rios do template tambÃ©m.
- Textos canÃ´nicos de termo/LGPD vÃªm do banco, nÃ£o do cliente.
- Uploads sÃ£o extraÃ­dos para `ficha_anexos` e o payload cifrado guarda apenas metadados.
- `idempotencia` Ã© opcional, mas recomendada; repetir a chave devolve a ficha existente.
- Limite de corpo: 22 MB.
- `422` com `detalhes` por campo quando a validaÃ§Ã£o falha.

### `GET /api/public/fichas/:protocolo/status?tenant=slug`

```json
{
  "protocolo": "F261105-AB12CD",
  "status": "salva",
  "pdf_disponivel": true,
  "atualizado_em": "2026-11-05T14:31:10.000Z"
}
```

NÃ£o expÃµe dados pessoais.

---

## Painel (Bearer)

### `GET /api/panel/me`

```json
{
  "usuario": { "id": "uuid", "email": "dono@estudio.com", "tenantId": "uuid", "role": "owner", "nome": "Dono" },
  "tenant": { "id": "uuid", "slug": "estudio-exemplo", "nome_negocio": "...", "plano": "solo", "status": "trial", "branding": {}, "retencao_anos": 5 },
  "link_ficha": "https://zapfichas.github.io/ficha/tatuagem/write/?t=estudio-exemplo",
  "painel_url": "https://zapfichas.github.io/ficha/dashboard/"
}
```

### `GET /api/panel/fichas`

Query: `limite` (1â€“50, default 25), `status`, `q` (nome), `cursor` (ISO de `criado_em`).

```json
{
  "itens": [
    {
      "id": "uuid",
      "protocolo": "F261105-AB12CD",
      "cliente_nome": "JoÃ£o da Silva",
      "cliente_cpf_ultimos4": "7735",
      "status": "salva",
      "dados_json": { "profissional": "Ana Ribeiro", "data_procedimento": "2026-11-10" },
      "criado_em": "2026-11-05T14:30:00.000Z",
      "pdf_gerado_em": "2026-11-05T14:31:10.000Z"
    }
  ],
  "proximo_cursor": "2026-11-05T14:30:00.000Z"
}
```

### `GET /api/panel/fichas/:id`

Retorna a ficha, o payload descriptografado, meta, assinaturas, consentimentos e anexos.

```json
{
  "ficha": { "id": "uuid", "protocolo": "...", "status": "salva", "hash_pdf": "..." },
  "dados": { "nome": "...", "cpf": "111.444.777-35" },
  "meta": { "menor_idade": false, "idioma": "pt-BR" },
  "assinaturas": [{ "papel": "cliente", "timestamp": "...", "ip": "...", "hash_conteudo": "..." }],
  "consentimentos": [{ "tipo": "lgpd", "aceito": true, "versao_termo": "1" }],
  "anexos": [{ "tipo": "documento", "nome_arquivo": "rg.jpg", "status": "enviado" }]
}
```

### `GET /api/panel/fichas/:id/pdf`

Faz streaming do PDF autenticado. `409` se ainda estiver processando.

### `GET /api/panel/stats`

```json
{ "total": 42, "salvas": 40, "erro": 1, "processando": 1, "ultimos_30_dias": 12, "atualizado_em": "05/11/2026 14:35" }
```

### `GET /api/panel/formulario`

Retorna o formulÃ¡rio ativo e o template completo (para a tela de configuraÃ§Ã£o de campos).

> Se `FICHA_URL_TEMPLATE` estiver definido, os links de ficha usam `{nicho}` e `{slug}`, por exemplo:
> `https://zapfichas.github.io/ficha/{nicho}/write/?t={slug}`.

### `PATCH /api/panel/formulario` (owner)

```json
{ "nome": "Ficha padrÃ£o", "campos_ativos": { "secoes": [{ "id": "identificacao", "campos": ["nome", "cpf"] }] } }
```

`campos_ativos = null` libera todos os campos do template.

### `PATCH /api/panel/tenant` (owner)

Campos permitidos: `nome_negocio`, `branding`, `email_contato`, `whatsapp`, `timezone`, `retencao_anos` (1â€“30). `plano` e `status` sÃ£o alterados apenas por billing/servidor.

### `POST /api/panel/fichas/:id/reprocessar` (owner)

Reenfileira o PDF. Retorna `202`.

---

## Onboarding

### `POST /api/onboarding/check-slug`

```json
{ "slug": "estudio-exemplo" }
â†’ { "disponivel": true, "slug": "estudio-exemplo" }
```

### `POST /api/onboarding/criar` (Bearer)

```json
{
  "slug": "estudio-exemplo",
  "nome_negocio": "EstÃºdio Exemplo",
  "nicho_slug": "tatuagem",
  "nome_usuario": "Ana Ribeiro",
  "branding": { "cor_primaria": "#4F7963" }
}
```

Cria tenant + formulÃ¡rio + usuÃ¡rio owner em **uma transaÃ§Ã£o** (funÃ§Ã£o SQL `criar_tenant`).

`201`:

```json
{
  "tenant_id": "uuid",
  "slug": "estudio-exemplo",
  "formulario_id": "uuid",
  "template_slug": "tatuagem",
  "status": "trial",
  "link_ficha": "https://zapfichas.github.io/ficha/tatuagem/write/?t=estudio-exemplo",
  "painel_url": "https://zapfichas.github.io/ficha/dashboard/"
}
```

Erros: `409` slug em uso / usuÃ¡rio jÃ¡ vinculado; `422` template inexistente.

### `GET /api/onboarding/status` (Bearer)

```json
{ "vinculado": false, "onboarding_necessario": true }
```

### `POST /api/onboarding/concluir` (Bearer)

Marca `onboarding_concluido_em` para mÃ©tricas de ativaÃ§Ã£o.

---

## Google Drive

### `GET /api/drive/oauth/start` (Bearer)

```json
{ "url": "https://accounts.google.com/o/oauth2/v2/auth?...", "redirect_uri": "https://api.../api/drive/oauth/callback" }
```

Redirecione o navegador para `url`.

### `GET /api/drive/oauth/callback`

Recebe `code` + `state`, troca por tokens, cria a pasta raiz e grava o refresh token criptografado. Redireciona para `PANEL_URL?drive=conectado|erro`.

### `GET /api/drive/status` (Bearer)

```json
{
  "conectado": true,
  "storage_mode": "drive",
  "r2_configurado": false,
  "folder_id": "...",
  "email": null,
  "atualizado_em": "..."
}
```

`r2_configurado` indica se o binding `FICHAS_BUCKET` existe no Worker. Se `conectado=false` e `r2_configurado=false`, nÃ£o hÃ¡ storage disponÃ­vel para o PDF.

### `POST /api/drive/desconectar` (owner)

Limpa tokens e volta `storage_mode` para `r2`.

---

## Webhooks

### `POST /webhooks/stripe`

Valida `Stripe-Signature` (HMAC SHA-256, tolerÃ¢ncia de 5 min), grava em `webhook_eventos` (idempotente) e atualiza o tenant via `metadata.tenant_id`.

### `POST /webhooks/asaas`

Valida `asaas-access-token` e processa `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`, `SUBSCRIPTION_DELETED`, etc. Usa `externalReference` como `tenant_id`.

---

## OperaÃ§Ã£o

- `GET /health` â†’ `{ ok: true, servico, versao, ambiente }`.
- `OPTIONS` liberado por CORS em `/api/*`.
- Recomenda-se Cloudflare WAF/rate limiting por IP em `/api/public/fichas` (ex.: 20 req/min).
- Segredos nunca aparecem em respostas.

---

## Novos endpoints (v2)

### `GET /api/panel/analytics?dias=30|90|180`

Dashboard do tenant. Retorna KPIs, série mensal, profissionais, procedimentos,
dias da semana, funil, recorrência e comparativo de planos.

- Solo: `disponivel=false` com prévia mensal e `motivo` de upgrade.
- Estúdio/Pro: dados completos.

### `GET /api/panel/clientes?q=`

Busca por nome, CPF completo (11 dígitos) ou 4 últimos dígitos. Agrupa as fichas
do mesmo cliente e devolve histórico, pendências e profissional.

### `GET|POST /api/panel/profissionais`

Cadastro operacional de profissionais (nome, e-mail, telefone, especialidade,
registro, cor). `PATCH /api/panel/profissionais/:id` e
`DELETE /api/panel/profissionais/:id` (soft delete) são exclusivos do owner.

### `PATCH /api/panel/formulario`

Aceita também `campos_customizados: []` com até 40 campos. Limite por plano:
Solo 3, Estúdio 15, Pro ilimitado.

### `PATCH /api/panel/fichas/:id` (owner)

Edita dados com justificativa obrigatória. Revalida o template, atualiza o hash
do CPF quando necessário e grava evento `ficha_alterada`.

### `GET /api/panel/alteracoes?status=pendente`

Lista solicitações de alteração feitas pelo cliente.

### `PATCH /api/panel/alteracoes/:id` (owner)

Aprova (`aprovada`) ou recusa (`recusada`) uma solicitação.

### `POST /api/panel/fichas/:id/pendencias/:indice/resolver` (owner)

Marca uma pendência (ex.: documento do responsável) como resolvida.

### `POST /api/drive/testar` (owner)

Valida token, conta Google e pasta raiz. Retorna `precisa_reconectar=true` em
caso de `invalid_grant`/403.

### `POST /api/public/fichas/solicitar-alteracao`

```json
{
  "tenant_slug": "estudio-exemplo",
  "protocolo": "F261105-AB12CD",
  "cpf_ultimos4": "7735",
  "justificativa": "Corrigir o endereço informado.",
  "campos": ["endereco"]
}
```

Não exige login. A prova é o protocolo + 4 últimos dígitos do CPF. Cria uma
solicitação pendente para aprovação do dono.

### `GET /api/public/complementar?f=&p=&t=`

Abre os dados seguros do link de complemento (sem CPF e sem respostas).

### `POST /api/public/complementar`

Recebe `{ f, p, t, nome_arquivo, mime, base64 }` (até 12 MB) e anexa a
documentação do responsável legal. O token é HMAC do id da ficha + protocolo.

### `GET /api/admin/metricas`

Dashboard global (MRR, ARR, ARPA, churn, conversão, ativação, nichos, funil).
Requer e-mail em `PLATFORM_ADMIN_EMAILS`.
