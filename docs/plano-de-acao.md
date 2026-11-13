# Plano de ação — revisão de produto (13/11/2026)

Este documento organiza as demandas por categoria, registra o que já foi
implementado no código e o que depende de credenciais/infra para entrar no ar.

## Resumo executivo

- **Código entregue neste ciclo:** correções de CPF e assinatura, tema com
  contraste automático, campos personalizados, cadastro de profissionais,
  busca de clientes por CPF com histórico, fluxo provisório de menor de idade,
  aprovação de alterações, dashboards (tenant e admin global), vitrine,
  WhatsApp de suporte e catálogo de planos com gatilhos de upgrade.
- **Depende de credenciais para publicar:**
  1. aplicar a migration `supabase/migrations/20260102000000_features.sql`;
  2. `wrangler deploy` do Worker (Cloudflare);
  3. variável `PLATFORM_ADMIN_EMAILS` no Worker (admin global);
  4. app OAuth do Google **publicado** (modo Testing expira refresh token em 7 dias);
  5. rebuild/deploy do GitHub Pages (o workflow já faz isso no push).
- **Nada foi quebrado no staging atual:** as telas novas degradam com mensagem
  amigável quando o servidor ainda não tem a migration ou o endpoint novo.

---

## 🐛 1. Correções de bugs

### 1.1 CPF inválido não limpava ao corrigir

- **Causa:** o evento `input` chamava `definirValor(..., { silencioso: true })`,
  que não limpava o erro; o `blur` só revalidava quando não havia erro.
- **Correção:** o `input` revalida quando existe erro e limpa ao ficar válido; o
  `blur` sempre revalida. Vale para CPF, telefone, e-mail e obrigatórios.
- **Arquivo:** `apps/ficha/src/engine.js`.
- **Teste manual:** digitar CPF inválido, sair do campo, corrigir → mensagem
  desaparece imediatamente.

### 1.2 Assinatura “pontilhada”

- **Causa:** o traço era desenhado em segmentos que não se encontravam nos
  pontos médios, gerando falhas visuais; a exportação usava a tela em baixa
  densidade e quadros grandes no PDF.
- **Correção:**
  - curvas quadráticas contínuas entre pontos médios + coalescência de eventos;
  - render em até 3x de densidade e redesenho vetorial no resize;
  - export corta a área vazia, gera PNG em fundo branco com até 1600 px.
- **Arquivo:** `apps/ficha/src/signature.js`.

### 1.3 Google Drive parou de funcionar

- **Causas prováveis tratadas:**
  - refresh token expirado/revogado (`invalid_grant`), comum quando o app OAuth
    está em **Testing** (o Google expira em 7 dias);
  - pasta raiz removida/renomeada no Drive;
  - permissão negada (403) sem mensagem clara no painel.
- **Correção:**
  - mensagens específicas para `invalid_grant` e 403;
  - validação real de token/conta/pasta (`POST /api/drive/testar`);
  - recriação automática da pasta quando a anterior não existe;
  - armazenamento do e-mail da conta Google e exibição no painel;
  - botão **Testar conexão** em Configurações.
- **Arquivos:** `apps/api/src/services/drive.ts`,
  `apps/api/src/routes/drive-oauth.ts`, `apps/painel/src/main.js`.
- **Ação externa necessária:** publicar o OAuth consent screen no Google Cloud
  (sair de “Testing”) e reconectar a conta.

---

## 🧩 2. Novas funcionalidades

### 2.1 Campos personalizados

- O tenant cria campos (texto, texto longo, data, CPF, telefone, e-mail,
  número, sim/não, lista, múltipla escolha), escolhe seção e obrigatoriedade.
- Os campos são mesclados no template em leitura, validação, PDF e painel.
- Limite por plano: Solo 3, Estúdio 15, Pro ilimitado.
- **Arquivos:** `packages/shared/src/campos-customizados.js`,
  `apps/api/src/routes/panel.ts`, `apps/painel/src/main.js`,
  `supabase/migrations/20260102000000_features.sql`.

### 2.2 Múltiplos profissionais responsáveis

- Nova tabela `profissionais` (nome, contato, especialidade, registro, cor).
- A ficha já mostra o profissional no select; a ficha grava `profissional_id`
  quando disponível e mantém compatibilidade com o nome no `dados_json`.
- Tela **Equipe** com cadastro/desativação; fallback para `usuarios` enquanto a
  migration não for aplicada.
- Limite por plano: Solo 1, Estúdio 5, Pro ilimitado.

### 2.3 Busca de clientes por CPF + jornada

- `GET /api/panel/clientes?q=` aceita CPF completo (hash HMAC), 4 últimos
  dígitos ou nome.
- Agrupa fichas por cliente e devolve histórico, pendências, última ficha e
  profissional.
- Tela **Clientes** com busca e lista de fichas clicáveis.
- O CPF completo nunca é exposto; o índice segue a regra de hash + últimos 4.

### 2.4 Exceções no preenchimento

- **Menor de idade provisório:** se o estabelecimento permitir, o cliente pode
  concluir sem a assinatura do responsável; a ficha registra uma pendência e
  gera um **link de complemento** para envio posterior do documento.
- **Alteração de dados:** cliente solicita pelo protocolo + 4 últimos dígitos
  do CPF; o dono aprova/recusa. O dono também pode editar diretamente com
  justificativa e trilha de auditoria.
- **Arquivos:** `apps/api/src/services/complementos.ts`,
  `apps/ficha` (tela de complemento gerada em `/complementar/`),
  `apps/painel/src/main.js`.

---

## 📊 3. Ciência de dados e analytics

### 3.1 Dashboard do tenant

- `GET /api/panel/analytics?dias=30|90|180`:
  - KPIs (total, conclusão, clientes distintos, menores);
  - série mensal, profissionais mais acionados, procedimentos, dias da semana;
  - funil operacional, distribuição por status, recorrência de clientes.
- Tela **Insights** com gráficos em CSS/SVG, sem dependência extra.
- Plano Solo vê prévia + CTA de upgrade; Estúdio/Pro veem o dashboard completo.

### 3.2 Dashboard interno (admin global)

- `GET /api/admin/metricas` protegido por `PLATFORM_ADMIN_EMAILS`.
- Métricas: MRR, ARR, ARPA, ticket médio, ativos, trial, conversão, churn,
  novos clientes, fichas por mês, ativação, distribuição por nicho e operação.
- Tela **Admin global** aparece no menu apenas para e-mails autorizados.
- **Sem a variável configurada, ninguém acessa** — inclusive você. Configure no
  Worker: `wrangler secret put PLATFORM_ADMIN_EMAILS` (ou `[vars]`).

---

## 🎨 4. UI/UX e copywriting

### 4.1 Contraste automático

- `packages/shared/src/tema.js` deriva paleta completa:
  - texto, texto suave, texto claro, superfícies, bordas, cor sobre botão;
  - faixa superior com contraste garantido;
  - modo escuro automático quando o fundo é escuro.
- Aplicado na ficha e no painel, com prévia ao vivo nas cores do painel.
- Testes garantem contraste AA em fundos claros e escuros.

### 4.2 Linguagem amigável

- Substituições principais: “engine” → “ficha/solução”; “trilha de auditoria”
  → “registro de segurança”; “storage” → “armazenamento”; textos de erro e
  onboarding reescritos para o tom comercial.
- Landing pages e painel revisados; o texto jurídico do template continua
  separado e deve passar por revisão jurídica.

### 4.3 Vitrine / cross-selling

- Catálogo compartilhado em `packages/shared/src/produtos.js`.
- Aparece no fim da ficha (cliente final), no painel e nos Insights.
- Botão **Indicar** leva para a landing do outro nicho.

### 4.4 Suporte WhatsApp

- Número **61 99294-4998** visível:
  - rodapé da ficha, tela de sucesso e tela de erro;
  - topo, rodapé, configurações, login e botão flutuante do painel;
  - landings e página de complemento.
- Link `wa.me` com mensagem contextual.

---

## 💼 5. Negócios e estratégia

- Catálogo único em `packages/shared/src/planos.js` e documento
  [planos.md](planos.md).
- Limites claros por recurso e gatilhos de upgrade:
  - Solo → Estúdio: 2º profissional, 4º campo, dashboard de dados;
  - Estúdio → Pro: 6º profissional, 16º campo, API/domínio próprio.
- Tela **Planos** com comparativo, limites atuais e CTA de upgrade.
- Enforcement no servidor para fichas/mês (trial), profissionais e campos.

---

## O que ainda depende de você/credenciais

1. **Aplicar a migration** no Supabase (CLI ou SQL editor).
2. **Deploy do Worker** (`cd apps/api && npx wrangler deploy`).
3. **Configurar `PLATFORM_ADMIN_EMAILS`** com seu e-mail.
4. **Publicar o app OAuth** no Google Cloud e reconectar o Drive.
5. **Rebuild do Pages** (push na `main` dispara o workflow) — necessário para
   publicar o novo painel/ficha. O Worker novo só funciona depois do passo 2.
6. **Revisar preços/limites** comercialmente antes de comunicar aos clientes.
7. **Revisar juridicamente** os textos de termo/LGPD e o fluxo provisório de
   menor de idade.

## Ordem recomendada de validação

1. Rodar `npm test`, `npm run typecheck` e `npm run templates:validate`.
2. Aplicar a migration em um projeto de staging.
3. Deploy do Worker e smoke test:
   - abrir ficha demo;
   - criar ficha de teste;
   - conectar/testar Drive;
   - criar campo personalizado e profissional;
   - buscar cliente por CPF;
   - abrir Insights e Admin global.
4. Publicar Pages e validar no celular.
