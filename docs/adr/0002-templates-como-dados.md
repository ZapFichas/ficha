# ADR 0002 — Template de nicho é dado, não código

**Data:** 2026-11-05  
**Status:** aceito

## Contexto

O produto começa em tatuagem e expande para piercing, estética, fitness, salão, odonto e fisio. Criar uma branch ou um app por nicho multiplica manutenção e impede o modelo “um motor, N marcas”.

## Decisão

- Cada nicho é um registro em `templates`, com `campos_json` (seções e campos), termo, LGPD, copy de landing e preço.
- A engine renderiza qualquer `campos_json`; não há `if nicho === 'tatuagem'` no código.
- `formularios` guarda o subconjunto/ordem de campos ativos de cada tenant.
- Campos novos são features do template (para todos), não customização por cliente.
- `templates/*.json` é a fonte de verdade versionada; `supabase/seed.sql` é gerado.

## Consequências

- Novo nicho ≈ novo JSON + landing + SEO + onboarding, sem deploy de código de ficha.
- A engine precisa suportar tipos e condicionais genéricos (`menor_idade`, `parq_positivo`, `campo`/`valor`).
- O schema do template é validado no CI (`npm run templates:validate`).
- Customização por cliente é proibida; o painel só liga/desliga campos e branding.

## Alternativas descartadas

- **Um app por nicho:** duplicação, correções em N lugares.
- **Form builder livre por tenant:** explode suporte e qualidade dos termos; foge do produto fechado.
- **Hardcode de seções no front:** cada mudança vira deploy e risco de divergência com o PDF.
