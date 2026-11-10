# Segurança e LGPD

> Este documento é técnico e operacional. Não substitui parecer jurídico. Antes do primeiro cliente pagante, os termos e o fluxo de consentimento devem ser revisados por advogado com experiência em LGPD e saúde.

## 1. Classificação dos dados

| Dado | Onde fica | Proteção |
|---|---|---|
| Nome, telefone, e-mail, endereço | `fichas.dados_cifrados` (payload completo) + `fichas.cliente_nome` (índice) | AES-256-GCM no payload; RLS no nome |
| CPF | dentro do payload cifrado | HMAC-SHA256 + últimos 4 dígitos em metadados; máscara no PDF/UI |
| Dados de saúde (alergias, condições, PAR-Q) | `fichas.dados_cifrados` | AES-256-GCM; RLS |
| Assinatura (imagem) | `assinaturas.imagem_base64` | RLS; acesso apenas do tenant |
| Documento/autorização/foto | `ficha_anexos` (base64 temporário) → Drive/R2 | bucket privado / Drive do cliente |
| Texto do termo e LGPD aceitos | `consentimentos` | RLS |
| IP e user-agent | `assinaturas`, `consentimentos`, `fichas` | inet/text; acesso do tenant |
| Tokens OAuth do Drive | `tenant_secrets` | criptografados com AES-GCM; sem policy para authenticated |
| Chaves de criptografia | secrets do Worker | nunca no banco, nunca no repositório |

**CPF em claro não é armazenado em coluna de metadados.** O CPF completo existe apenas dentro do payload cifrado.

## 2. Controles técnicos

### Criptografia

- **Em trânsito:** HTTPS obrigatório (Cloudflare/Supabase).
- **Em repouso:** Supabase e R2 criptografam o disco; além disso, o payload da ficha é cifrado na aplicação.
- **AES-256-GCM:** IV aleatório de 12 bytes por registro, envelope `v1.<iv_b64>.<ciphertext_b64>`.
- **Chave:** `DATA_ENCRYPTION_KEY` (32 bytes em base64) como secret do Worker.
- **CPF:** HMAC-SHA256 com `CPF_HASH_PEPPER`; permite deduplicação sem guardar o CPF em claro.
- **Hash do PDF:** SHA-256 do arquivo, guardado em `fichas.hash_pdf`.
- **Hash de conteúdo:** SHA-256 do JSON canônico assinado, guardado em `assinaturas.hash_conteudo`.

### Isolamento

- RLS em todas as tabelas de tenant.
- `current_tenant_id()` resolve claim JWT + fallback em `usuarios`; funções `SECURITY DEFINER` com `search_path` fixo.
- `tenant_secrets` e `webhook_eventos` sem policies para `authenticated`.
- O bucket `fichas` é privado; policies por prefixo `${tenant_id}/`.
- Upload público só pelo Worker (service_role) após validação.
- Escritas em `fichas`, `assinaturas` e `consentimentos` não são expostas ao cliente autenticado.

### Auditoria

Cada assinatura registra:

- papel (`cliente`/`responsavel`);
- imagem;
- hash do conteúdo assinado;
- timestamp do servidor;
- IP (normalizado, `inet`);
- user-agent;
- versão do template e textos aceitos.

O PDF inclui os mesmos dados + protocolo e hash. O hash do PDF é verificado comparando o arquivo com `fichas.hash_pdf`.

### Acesso

- Painel: JWT do Supabase + RLS.
- Worker: service_role apenas em rotas server-side; nunca é enviado ao browser.
- Admin interno: ainda não implementado; quando existir, deve ser um tenant/role separado com auditoria e MFA.
- Recomendado: MFA para owners, WAF/rate limit no endpoint público, alertas de acesso anômalo.

## 3. Retenção e exclusão

- `tenants.retencao_anos` (1–30; padrão 5) define a retenção.
- No insert, `fichas.retencao_ate = hoje + retencao_anos`.
- `expurgar_fichas_vencidas()` apaga fichas `salva` vencidas (cron diário).
- Anexos e PDFs:
  - R2: configurar lifecycle rule no bucket;
  - Drive: o arquivo é do cliente; o expurgo do banco não apaga o Drive automaticamente. Documentar isso no contrato e oferecer rotina de limpeza.
- Pedido de exclusão do titular:
  1. localizar por nome/protocolo/last4 do CPF;
  2. confirmar identidade;
  3. apagar a ficha (cascade em assinaturas/consentimentos/anexos);
  4. apagar PDF/anexos no storage;
  5. registrar a solicitação e a resposta.
- Exclusão pode ser limitada por obrigação legal de guarda (ex.: prontuário, defesa em processo). O termo deve refletir isso.

## 4. Bases legais (visão prática)

- **Dados de saúde**: dado pessoal sensível (art. 5º, II). O consentimento do titular (art. 11, I) é uma base, mas não a única possível; tutela da saúde por profissionais (art. 11, II, f) e exercício regular de direitos (art. 7º, VI / art. 11, II, d) também podem se aplicar.
- **Termo de consentimento do procedimento**: manifestação de vontade sobre o procedimento em si; não se confunde com consentimento LGPD.
- **Registro fotográfico/portfólio**: consentimento específico e destacável (implementado como `consentimentos_extras`).
- **Menor de 18**: consentimento do responsável legal + assinatura; o template já exige a seção e a assinatura do responsável.
- **Dados de pagamento**: ficam no gateway (Stripe/Asaas); o produto não armazena cartão.
- **Transferência internacional**: Supabase/Cloudflare/Resend/Google podem processar fora do Brasil. O contrato e a política de privacidade precisam listar subprocessadores e mecanismo de transferência.

## 5. Direitos do titular

O MVP atende por processo assistido:

1. titular envia e-mail para o contato do estabelecimento;
2. estabelecimento localiza a ficha no painel;
3. exporta o PDF ou solicita exclusão;
4. registra a solicitação em `eventos` com tipo `solicitacao_titular` (a implementar).

Roadmap: autoatendimento de exportação/exclusão e trilha de solicitações.

## 6. Segurança operacional

- Rotação de `DATA_ENCRYPTION_KEY` exige migração de todos os envelopes (não há rekey automático). Planeje versão `v2` antes de rotacionar.
- Rotação de `CPF_HASH_PEPPER` quebra a busca por CPF existente; faça rehash controlado.
- Revogar `GOOGLE_CLIENT_SECRET` e reconectar tenants em caso de vazamento.
- Segredos:
  - `.dev.vars` local, `wrangler secret` em produção;
  - nunca em logs, Sentry ou respostas de erro.
- Dependências: `npm audit` no CI; revisar `pdf-lib`, `hono`, `supabase-js`.
- Backup: Supabase PITR no plano adequado; R2 versioning/lifecycle; Drive é do cliente.
- Sentry: configurar scrub de PII (não enviar `dados`, CPF, assinatura). O helper atual envia apenas contexto de erro; revise antes de produção.

## 7. Resposta a incidente

1. Conter (revogar secrets, suspender endpoint, bloquear tenant).
2. Avaliar escopo (quais tenants/fichas, dados sensíveis envolvidos).
3. Preservar evidências (logs, hashes, snapshots).
4. Notificar o controlador (estabelecimento) e, quando aplicável, a ANPD e titulares, nos prazos legais.
5. Corrigir a causa e documentar em post-mortem.
6. Comunicar clientes com transparência.

## 8. Checklist antes do primeiro pagante

- [ ] Termo e LGPD revisados por advogado.
- [ ] Política de privacidade publicada com subprocessadores e retenção.
- [ ] Contrato de tratamento de dados (DPA) com o estabelecimento.
- [ ] `DATA_ENCRYPTION_KEY` e `CPF_HASH_PEPPER` fortes e guardados no cofre.
- [ ] RLS testado com dois tenants reais (A não vê B).
- [ ] Bucket privado e policies de storage testadas.
- [ ] Retenção configurada e expurgo testado.
- [ ] Fluxo de exclusão documentado e testado.
- [ ] Sentry sem PII; alertas de erro e cota.
- [ ] Backup/restore testado.
- [ ] Rate limit/WAF no endpoint público.
- [ ] MFA disponível para owners.
- [ ] Aviso claro: “não é prontuário médico” para odonto/fisio/médica.

## 9. O que não prometer

- “Validade jurídica garantida” — a assinatura eletrônica é um indício; a força probatória depende do conjunto.
- “100% LGPD” — compliance é processo contínuo, não um selo.
- “Substitui prontuário” — não substitui.
- “Criptografia de ponta a ponta” — o Worker descriptografa para gerar PDF; não é E2EE.
- “Dados nunca saem do Brasil” — depende dos subprocessadores escolhidos.
