# ADR 0004 — PDF assíncrono com fila, retry e idempotência

**Data:** 2026-11-05  
**Status:** aceito

## Contexto

Gerar PDF no request aumenta latência, consome CPU do Worker e falha se o Drive estiver lento. O cliente está no celular, muitas vezes em rede instável; ele não deve esperar o upload.

## Decisão

- `POST /api/public/fichas` grava a ficha e enfileira `{ fichaId }`.
- Cloudflare Queue com `max_retries = 3` + DLQ.
- Consumer:
  1. envia anexos pendentes;
  2. gera PDF;
  3. calcula SHA-256;
  4. salva no storage;
  5. atualiza `status = salva`.
- `status`: `rascunho → preenchida → salva` ou `erro`.
- Idempotência:
  - `meta.idempotencia` + índice único `(tenant_id, idempotency_key)`;
  - se o job já está `salva`, o consumer retorna sem regravar.
- Cron diário reenfileira fichas presas (< 5 tentativas).

## Consequências

- Resposta rápida e resistente a falhas de storage.
- O cliente vê “ficha concluída”, mas o PDF pode levar alguns segundos.
- Precisa de observabilidade do funil e alerta de fila.
- Anexos ficam temporariamente em base64 na tabela `ficha_anexos`; o consumer limpa após upload.
- Se o upload de anexo falhar, o job falha e tenta novamente; após 3 tentativas a ficha fica `erro` e pode ser reprocessada pelo painel.

## Alternativas descartadas

- **PDF síncrono:** simples, mas lento e frágil.
- **Supabase Edge Function + pg_cron:** viável, mas menos integrado ao R2/Queues e ao modelo de execução do Worker.
- **Gerar no browser:** não serve como trilha de auditoria confiável no servidor.
