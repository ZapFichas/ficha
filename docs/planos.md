# Planos e ponto de corte

Fonte de verdade: `packages/shared/src/planos.js`.
Este documento explica a estratégia por trás dos limites.

## Princípios

1. **O básico não bloqueia o atendimento.** O cliente Solo consegue emitir
   fichas sem limite, porque o valor percebido está no fluxo diário.
2. **O upgrade acontece quando o negócio cresce.** Cada limite corresponde a um
   evento real: contratar alguém, criar mais campos, precisar de dados.
3. **Dados são o principal gatilho de valor.** Quem tem equipe e volume precisa
   de dashboard; quem é solo raramente precisa.
4. **Sem surpresa na renovação.** Limites são exibidos antes e no momento do
   bloqueio, com caminho claro para o plano seguinte e para o suporte.

## Tiers

| | **Solo** | **Estúdio** | **Pro** |
|---|---|---|---|
| Preço/mês | R$ 49 | R$ 99 | R$ 199 |
| Profissionais | 1 | até 5 | ilimitados |
| Fichas/mês | ilimitadas | ilimitadas | ilimitadas |
| Campos personalizados | 3 | até 15 | ilimitados |
| Busca de clientes por CPF | Sim | Sim | Sim |
| Google Drive | Sim | Sim | Sim |
| Dashboard de dados | — | Sim | Sim |
| Relatórios avançados | — | — | Sim |
| Aprovação de alterações | — | Sim | Sim |
| API e integrações | — | — | Sim |
| Domínio próprio | — | — | Sim |

**Trial:** 7 dias, 20 fichas, 1 profissional, 3 campos, dashboard básico.
Serve para experimentar o fluxo completo, não para operar de graça.

## Gatilhos de upgrade

### Solo → Estúdio

- **2º profissional** — o limite de 1 é o gatilho mais previsível.
- **4º campo personalizado** — clientes com operação própria começam a pedir
  campos específicos.
- **Dashboard de dados** — o cliente quer entender volume, retorno e
  procedimentos mais procurados.
- **Aprovação de alterações** — começa a existir risco de correção indevida.

### Estúdio → Pro

- **6º profissional** — a operação virou uma equipe maior.
- **16º campo personalizado** — necessidade de formulários muito específicos.
- **API/integrações** — CRM, ERP ou automação.
- **Domínio próprio** — marca própria e operação multi-unidade.

## O que cada limite protege

- **Profissionais:** custo de suporte e complexidade de permissões.
- **Campos:** evita formulários incontroláveis e mantém a qualidade do PDF.
- **Fichas/mês no trial:** evita abuso do teste sem punir o Solo.
- **Analytics:** é o recurso com maior percepção de valor e menor custo marginal.
- **API/domínio:** custo de engenharia e onboarding.

## Métricas para validar a estratégia

- conversão trial → pago por coorte;
- % de upgrades motivados por profissional vs. dados;
- churn por plano;
- uso médio de campos personalizados;
- tempo até o primeiro upgrade (meta: até 60 dias).

## Ainda depende de decisão comercial

- preço final e desconto anual;
- política de downgrade e retenção de dados;
- limites de armazenamento (hoje citados nas landings como 5/20/100 GB);
- cobrança avulsa de setup/onboarding para Pro.

Até a cobrança estar automatizada, o CTA de upgrade leva ao WhatsApp de suporte
com mensagem contextual e o plano é ajustado manualmente no banco.
