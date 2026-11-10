# ADR 0001 — Multi-tenant com RLS no Postgres

**Data:** 2026-11-05  
**Status:** aceito

## Contexto

Um único backend serve estúdios diferentes. Vazamento entre tenants é falha crítica e LGPD. Filtrar `tenant_id` apenas no código é frágil: qualquer query esquecida vaza dados.

## Decisão

- Toda tabela de dados carrega `tenant_id`.
- RLS habilitado em todas as tabelas.
- `public.current_tenant_id()` resolve o tenant por:
  1. claim `tenant_id` do JWT (custom access token hook);
  2. fallback: `usuarios` por `auth.uid()`.
- Funções `SECURITY DEFINER` com `search_path` fixo.
- O cliente do painel usa `anon key + JWT`; o Worker público usa `service_role`.
- Escritas públicas não têm policy; passam pela API.
- `tenant_secrets` e `webhook_eventos` não têm policy para `authenticated`.

## Consequências

- Defesa em profundidade: mesmo query sem filtro explícito respeita o tenant.
- Custo: uma consulta a `usuarios` quando o claim não está presente; mitigado pelo hook.
- Toda nova tabela de tenant precisa de policy + teste de isolamento.
- Teste de RLS com dois tenants é obrigatório no release.

## Alternativas descartadas

- **Filtrar só no Worker:** simples, mas um erro de query vaza dados.
- **Schema por tenant:** isolamento forte, mas migrações e conexões viram pesadelo operacional.
- **Banco por tenant:** custo e operação inviáveis para micro-SaaS self-service.
