# Checklist de release (Definition of Done)

Uma entrega só entra em produção quando todos os itens abaixo estiverem marcados.

## Código

- [ ] Revisão por outra pessoa/agente.
- [ ] `npm run templates:validate` passou.
- [ ] `npm run typecheck` passou.
- [ ] `npm test` passou (unit + PDF + cripto + validação).
- [ ] `npm run build` passou.
- [ ] Nenhum segredo no diff (`git diff` + `git status`).
- [ ] Nenhum `console.log` com PII.

## Multi-tenant / RLS

- [ ] Toda tabela nova tem `tenant_id` e policy.
- [ ] Tenant A não lê `fichas`, `formularios`, `assinaturas`, `consentimentos`, `tenants` de B.
- [ ] `tenant_secrets` e `webhook_eventos` inacessíveis para `authenticated`.
- [ ] Storage privado e policy por prefixo testada.
- [ ] Funções `SECURITY DEFINER` com `search_path` fixo.

## Produto

- [ ] Ficha abre em celular real (iOS + Android) e desktop.
- [ ] Máscaras/validações funcionam.
- [ ] Upload de imagem grande comprime e de PDF funciona.
- [ ] Assinatura funciona com dedo, mouse e caneta.
- [ ] Menor de 18 libera responsável + assinatura.
- [ ] PAR-Q exige liberação médica quando positivo.
- [ ] Termo e LGPD não podem ser contornados.
- [ ] Revisão permite editar e volta para o resumo.
- [ ] PDF contém todas as seções, assinatura, hash, IP, UA e timestamp.
- [ ] PDF é salvo no Drive/R2 e o hash confere.

## Assíncrono

- [ ] Fila e DLQ criadas.
- [ ] Retry testado (derrubar storage temporariamente).
- [ ] Idempotência testada (reenviar mesma chave).
- [ ] Cron de reprocessamento e expurgo rodando.
- [ ] Status final `salva` ou `erro` visível.

## Observabilidade

- [ ] Eventos de funil gravados.
- [ ] Sentry recebe erro de teste (sem PII).
- [ ] Alerta de fila/erro/cota configurado.
- [ ] `wrangler tail` usado no smoke test.

## Documentação

- [ ] `docs/api.md` atualizado.
- [ ] ADR criado para decisão não óbvia.
- [ ] Runbook atualizado.
- [ ] Termo/LGPD revisados quando o texto mudar.

## Deploy

- [ ] Staging (ou preview) com smoke test.
- [ ] Migrations aplicadas antes do Worker.
- [ ] Secrets conferidos.
- [ ] Rollback documentado (redeploy anterior + migration reversível).
- [ ] Aprovação do orquestrador (produto) e do responsável técnico.

## Pós-deploy

- [ ] `/health` ok.
- [ ] 1 ficha real de teste gerou PDF.
- [ ] 1 tenant B não vê ficha de A.
- [ ] Nenhum erro crítico em 1 hora.
- [ ] Métrica de ativação/funil começa a popular.
