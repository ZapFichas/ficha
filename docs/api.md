# API — FichaPro Worker

Base local: `http://localhost:8787`
Base produção: `https://api.seudominio.com`

Formato: JSON. Erros seguem `{ "erro": "...", "detalhes"?: { "campo": "mensagem" } }`.

## Autenticação

- Rotas públicas: sem token.
- Rotas do painel/onboarding/Drive: `Authorization: Bearer <access_token do Supabase>`.
- O Worker valida o JWT com `auth.getUser` e usa o cliente do usuário (anon key + JWT), portanto **RLS é aplicado**.
- O tenant vem do claim `tenant_id` ou, como fallback, da linha em `usuarios`.

---

## Público

### `GET /api/public/form/:slug`

Retorna a configuração da ficha do tenant. É o que a SPA carrega no QR code.

```json
{
  "tenant": {
    "slug": "estudio-exemplo",
    "nome_negocio": "Estúdio Exemplo",
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
    "nome": "Ficha de Anamnese e Termo de Consentimento — Tatuagem",
    "versao": 1,
    "secoes": [{ "id": "identificacao", "titulo": "Dados de identificação", "campos": [] }],
    "consentimentos_extras": [
      { "id": "autorizo_imagens", "label": "...", "obrigatorio": true }
    ],
    "termo_texto": "...",
    "consentimento_lgpd": "..."
  },
  "formulario": { "id": "uuid", "nome": "Ficha padrão", "campos_ativos": null },
  "profissionais": [{ "id": "uuid", "nome": "Ana Ribeiro" }],
  "config": { "api_version": 1 }
}
```

- `404` se o slug não existir.
- `403` se o tenant estiver suspenso ou com trial expirado.
- `409` se não houver formulário/template ativo.
- `Cache-Control: public, max-age=30`.

### `POST /api/public/fichas`

Cria a ficha. Não gera o PDF de forma síncrona.

```json
{
  "tenant_slug": "estudio-exemplo",
  "template_slug": "tatuagem",
  "formulario_id": "uuid-opcional",
  "dados": {
    "nome": "João da Silva",
    "data_nascimento": "1990-05-12",
    "cpf": "111.444.777-35",
    "telefone": "(61) 98765-4321",
    "endereco": "Rua das Flores, 42...",
    "contato_emergencia": "Maria - (61) 98888-7777",
    "tratamento_medico": "Não",
    "alergia": "Não",
    "local_tatuagem": "Antebraço direito",
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
  "mensagem": "Ficha recebida. O PDF será gerado e salvo automaticamente."
}
```

Regras:

- Validação server-side com o mesmo código da ficha.
- CPF validado por dígito verificador.
- Menor de 18 exige seção do responsável + assinatura `responsavel`.
- Termo e LGPD são obrigatórios; extras obrigatórios do template também.
- Textos canônicos de termo/LGPD vêm do banco, não do cliente.
- Uploads são extraídos para `ficha_anexos` e o payload cifrado guarda apenas metadados.
- `idempotencia` é opcional, mas recomendada; repetir a chave devolve a ficha existente.
- Limite de corpo: 22 MB.
- `422` com `detalhes` por campo quando a validação falha.

### `GET /api/public/fichas/:protocolo/status?tenant=slug`

```json
{
  "protocolo": "F261105-AB12CD",
  "status": "salva",
  "pdf_disponivel": true,
  "atualizado_em": "2026-11-05T14:31:10.000Z"
}
```

Não expõe dados pessoais.

---

## Painel (Bearer)

### `GET /api/panel/me`

```json
{
  "usuario": { "id": "uuid", "email": "dono@estudio.com", "tenantId": "uuid", "role": "owner", "nome": "Dono" },
  "tenant": { "id": "uuid", "slug": "estudio-exemplo", "nome_negocio": "...", "plano": "solo", "status": "trial", "branding": {}, "retencao_anos": 5 },
  "link_ficha": "https://app/f/estudio-exemplo",
  "painel_url": "https://app/painel"
}
```

### `GET /api/panel/fichas`

Query: `limite` (1–50, default 25), `status`, `q` (nome), `cursor` (ISO de `criado_em`).

```json
{
  "itens": [
    {
      "id": "uuid",
      "protocolo": "F261105-AB12CD",
      "cliente_nome": "João da Silva",
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

Retorna o formulário ativo e o template completo (para a tela de configuração de campos).

### `PATCH /api/panel/formulario` (owner)

```json
{ "nome": "Ficha padrão", "campos_ativos": { "secoes": [{ "id": "identificacao", "campos": ["nome", "cpf"] }] } }
```

`campos_ativos = null` libera todos os campos do template.

### `PATCH /api/panel/tenant` (owner)

Campos permitidos: `nome_negocio`, `branding`, `email_contato`, `whatsapp`, `timezone`, `retencao_anos` (1–30). `plano` e `status` são alterados apenas por billing/servidor.

### `POST /api/panel/fichas/:id/reprocessar` (owner)

Reenfileira o PDF. Retorna `202`.

---

## Onboarding

### `POST /api/onboarding/check-slug`

```json
{ "slug": "estudio-exemplo" }
→ { "disponivel": true, "slug": "estudio-exemplo" }
```

### `POST /api/onboarding/criar` (Bearer)

```json
{
  "slug": "estudio-exemplo",
  "nome_negocio": "Estúdio Exemplo",
  "nicho_slug": "tatuagem",
  "nome_usuario": "Ana Ribeiro",
  "branding": { "cor_primaria": "#4F7963" }
}
```

Cria tenant + formulário + usuário owner em **uma transação** (função SQL `criar_tenant`).

`201`:

```json
{
  "tenant_id": "uuid",
  "slug": "estudio-exemplo",
  "formulario_id": "uuid",
  "template_slug": "tatuagem",
  "status": "trial",
  "link_ficha": "https://app/f/estudio-exemplo",
  "painel_url": "https://app/painel"
}
```

Erros: `409` slug em uso / usuário já vinculado; `422` template inexistente.

### `GET /api/onboarding/status` (Bearer)

```json
{ "vinculado": false, "onboarding_necessario": true }
```

### `POST /api/onboarding/concluir` (Bearer)

Marca `onboarding_concluido_em` para métricas de ativação.

---

## Google Drive

### `GET /api/drive/oauth/start` (Bearer)

```json
{ "url": "https://accounts.google.com/o/oauth2/v2/auth?...", "redirect_uri": "https://api.../api/drive/oauth/callback" }
```

Redirecione o navegador para `url`.

### `GET /api/drive/oauth/callback`

Recebe `code` + `state`, troca por tokens, cria a pasta raiz e grava o refresh token criptografado. Redireciona para `APP_URL/painel/configuracoes?drive=conectado|erro`.

### `GET /api/drive/status` (Bearer)

```json
{ "conectado": true, "storage_mode": "drive", "folder_id": "...", "email": null, "atualizado_em": "..." }
```

### `POST /api/drive/desconectar` (owner)

Limpa tokens e volta `storage_mode` para `r2`.

---

## Webhooks

### `POST /webhooks/stripe`

Valida `Stripe-Signature` (HMAC SHA-256, tolerância de 5 min), grava em `webhook_eventos` (idempotente) e atualiza o tenant via `metadata.tenant_id`.

### `POST /webhooks/asaas`

Valida `asaas-access-token` e processa `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`, `SUBSCRIPTION_DELETED`, etc. Usa `externalReference` como `tenant_id`.

---

## Operação

- `GET /health` → `{ ok: true, servico, versao, ambiente }`.
- `OPTIONS` liberado por CORS em `/api/*`.
- Recomenda-se Cloudflare WAF/rate limiting por IP em `/api/public/fichas` (ex.: 20 req/min).
- Segredos nunca aparecem em respostas.
