/**
 * Catálogo de planos — fonte de verdade comercial.
 *
 * O objetivo é ter um ponto de corte claro por recurso, para que o upgrade
 * aconteça quando o cliente cresce (e não por uma decisão arbitrária).
 */

export const ORDEM_PLANOS = ["trial", "solo", "estudio", "pro"];

export const PLANOS = {
  trial: {
    id: "trial",
    nome: "Teste grátis",
    preco_mensal: 0,
    duracao_dias: 7,
    resumo: "7 dias para testar o fluxo completo",
    limites: {
      fichas_mes: 20,
      profissionais: 1,
      campos_customizados: 3,
      analytics: true,
      analytics_avancado: false,
      drive: true,
      busca_clientes: true,
      aprovacao_alteracoes: true,
      api: false,
      dominio_proprio: false,
    },
    gatilhos: [
      "21ª ficha no mês",
      "2º profissional",
      "4º campo personalizado",
      "fim dos 7 dias",
    ],
  },
  solo: {
    id: "solo",
    nome: "Solo",
    preco_mensal: 49,
    resumo: "Para quem trabalha sozinho e quer sair do papel",
    limites: {
      fichas_mes: null,
      profissionais: 1,
      campos_customizados: 3,
      analytics: false,
      analytics_avancado: false,
      drive: true,
      busca_clientes: true,
      aprovacao_alteracoes: false,
      api: false,
      dominio_proprio: false,
    },
    gatilhos: [
      "Contratar o 2º profissional",
      "Criar o 4º campo personalizado",
      "Precisar de relatórios e gráficos",
      "Precisar aprovar alterações de ficha",
    ],
  },
  estudio: {
    id: "estudio",
    nome: "Estúdio",
    preco_mensal: 99,
    resumo: "Para equipes pequenas que precisam de controle e dados",
    limites: {
      fichas_mes: null,
      profissionais: 5,
      campos_customizados: 15,
      analytics: true,
      analytics_avancado: false,
      drive: true,
      busca_clientes: true,
      aprovacao_alteracoes: true,
      api: false,
      dominio_proprio: false,
    },
    gatilhos: [
      "6º profissional",
      "16º campo personalizado",
      "Necessidade de API e integrações",
      "Necessidade de domínio próprio",
    ],
  },
  pro: {
    id: "pro",
    nome: "Pro",
    preco_mensal: 199,
    resumo: "Operação completa, integrações e marca própria",
    limites: {
      fichas_mes: null,
      profissionais: null,
      campos_customizados: null,
      analytics: true,
      analytics_avancado: true,
      drive: true,
      busca_clientes: true,
      aprovacao_alteracoes: true,
      api: true,
      dominio_proprio: true,
    },
    gatilhos: [],
  },
};

export const TRIAL_DIAS = PLANOS.trial.duracao_dias;

export const ROTULOS_RECURSO = {
  fichas_mes: "fichas por mês",
  profissionais: "profissionais responsáveis",
  campos_customizados: "campos personalizados",
  analytics: "dashboard de dados",
  analytics_avancado: "relatórios avançados",
  drive: "Google Drive",
  busca_clientes: "busca de clientes por CPF",
  aprovacao_alteracoes: "aprovação de alterações",
  api: "API e integrações",
  dominio_proprio: "domínio próprio",
};

export function planoEfetivo(tenant = {}) {
  const chave = tenant.plano && PLANOS[tenant.plano] ? tenant.plano : "solo";
  // Trial vencido continua sendo trial na UI, mas o servidor bloqueia o uso.
  return chave;
}

export function limitesDoPlano(plano) {
  const chave = PLANOS[plano] ? plano : "solo";
  return PLANOS[chave].limites;
}

export function recursoDisponivel(plano, recurso) {
  const limite = limitesDoPlano(plano)[recurso];
  return limite !== false;
}

/**
 * Verifica se o uso atual cabe no plano.
 * Retorna `{ ok, limite, uso, restante, upgrade }`.
 */
export function verificarLimite(plano, recurso, uso = 0) {
  const limites = limitesDoPlano(plano);
  const limite = limites[recurso];
  if (limite === false) {
    return {
      ok: false,
      bloqueado: true,
      limite: 0,
      uso,
      restante: 0,
      upgrade: proximoPlanoCom(recurso, planoEfetivo({ plano })),
    };
  }
  if (limite === true || limite === null || limite === undefined) {
    return { ok: true, bloqueado: false, limite: null, uso, restante: null, upgrade: null };
  }
  const n = Number(limite);
  const restante = Math.max(0, n - Number(uso || 0));
  return {
    ok: Number(uso || 0) < n,
    bloqueado: Number(uso || 0) >= n,
    limite: n,
    uso: Number(uso || 0),
    restante,
    upgrade: Number(uso || 0) >= n ? proximoPlanoCom(recurso, planoEfetivo({ plano })) : null,
  };
}

export function proximoPlanoCom(recurso, planoAtual = null) {
  const inicio = planoAtual ? Math.max(0, ORDEM_PLANOS.indexOf(planoAtual) + 1) : 0;
  for (let i = inicio; i < ORDEM_PLANOS.length; i++) {
    if (recursoDisponivel(ORDEM_PLANOS[i], recurso)) return ORDEM_PLANOS[i];
  }
  return "pro";
}

/** Texto de upgrade para exibir no ponto de bloqueio. */
export function mensagemUpgrade(planoAtual, recurso) {
  const proximo = proximoPlanoCom(recurso, planoAtual);
  const alvo = PLANOS[proximo];
  const rotulo = ROTULOS_RECURSO[recurso] ?? recurso;
  if (!alvo) return `Faça upgrade para liberar ${rotulo}.`;
  return `Seu plano ${PLANOS[planoAtual]?.nome ?? planoAtual} não inclui ${rotulo}. O plano ${alvo.nome} libera esse recurso.`;
}

export function comparativoPlanos() {
  return ORDEM_PLANOS.filter((p) => p !== "trial").map((chave) => {
    const plano = PLANOS[chave];
    return {
      ...plano,
      recursos: [
        { rotulo: ROTULOS_RECURSO.profissionais, valor: plano.limites.profissionais ?? "Ilimitados" },
        { rotulo: ROTULOS_RECURSO.fichas_mes, valor: plano.limites.fichas_mes ?? "Ilimitadas" },
        { rotulo: ROTULOS_RECURSO.campos_customizados, valor: plano.limites.campos_customizados ?? "Ilimitados" },
        { rotulo: "Dashboard de dados", valor: plano.limites.analytics ? "Incluído" : "—" },
        { rotulo: "Relatórios avançados", valor: plano.limites.analytics_avancado ? "Incluído" : "—" },
        { rotulo: "Aprovação de alterações", valor: plano.limites.aprovacao_alteracoes ? "Incluído" : "—" },
        { rotulo: "API e integrações", valor: plano.limites.api ? "Incluído" : "—" },
        { rotulo: "Domínio próprio", valor: plano.limites.dominio_proprio ? "Incluído" : "—" },
      ],
    };
  });
}
