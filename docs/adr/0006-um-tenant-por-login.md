# ADR 0006 — Um login pertence a um tenant no MVP

**Data:** 2026-11-05  
**Status:** aceito (revisar na fase 3)

## Contexto

O público inicial é estúdio pequeno: um dono, poucos profissionais. Permitir que um mesmo e-mail participe de vários estúdios exige tabela de membership, seletor de tenant, claim ativa e UX de troca de contexto. Isso aumenta complexidade sem validar a dor principal.

## Decisão

- `usuarios.id` = `auth.users.id` (PK), com um `tenant_id`.
- Um login = um tenant.
- O JWT carrega `tenant_id`; o fallback consulta `usuarios`.
- Profissionais do mesmo tenant compartilham o acesso; o painel lista `usuarios`.

## Consequências

- Onboarding e RLS ficam simples.
- Dono com dois estúdios precisa de dois logins (ou convite separado).
- Ao crescer para redes/franquias, será necessário:
  - tabela `memberships` (user_id, tenant_id, role);
  - tenant ativo na sessão;
  - claim `tenant_id` escolhida;
  - policies baseadas em membership.
- A migração é possível sem mudar o formato dos dados (fichas continuam por tenant).

## Alternativas descartadas

- **Membership desde o dia 1:** correto para escala, mas atrasa a validação e adiciona casos de borda de RLS.
- **Uma conta por profissional com vários tenants:** necessário para marketplace, não para o MVP.
