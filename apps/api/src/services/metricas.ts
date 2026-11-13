import {
  PLANOS,
  chaveMes,
  rotuloMes,
  serieMensal,
  taxa,
  topValores,
  variacao,
} from "@fichapro/shared";
import type { Env } from "../env.js";
import { clienteAdmin } from "../lib/supabase.js";

const PRECOS: Record<string, number> = {
  solo: PLANOS.solo.preco_mensal,
  estudio: PLANOS.estudio.preco_mensal,
  pro: PLANOS.pro.preco_mensal,
};

interface TenantMetrica {
  id: string;
  slug: string;
  nome_negocio: string;
  nicho_slug: string;
  plano: string;
  status: string;
  trial_expira_em: string | null;
  criado_em: string;
  onboarding_concluido_em?: string | null;
}

interface FichaMetrica {
  id: string;
  tenant_id: string;
  status: string;
  criado_em: string;
  menor_idade?: boolean;
  dados_json?: Record<string, unknown> | null;
}

function diasAtras(dias: number) {
  return new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
}

function mesAtual(d: Date) {
  return chaveMes(d);
}

/**
 * Métricas da plataforma (admin global). Usa apenas colunas do núcleo,
 * portanto funciona mesmo antes das migrations de features.
 */
export async function metricasPlataforma(env: Env) {
  const admin = clienteAdmin(env);

  const [{ data: tenantsData }, { data: fichasData }] = await Promise.all([
    admin
      .from("tenants")
      .select(
        "id, slug, nome_negocio, nicho_slug, plano, status, trial_expira_em, criado_em, onboarding_concluido_em"
      )
      .order("criado_em", { ascending: false })
      .limit(2000),
    admin
      .from("fichas")
      .select("id, tenant_id, status, criado_em, menor_idade, dados_json")
      .gte("criado_em", diasAtras(180).toISOString())
      .order("criado_em", { ascending: false })
      .limit(5000),
  ]);

  const tenants = (tenantsData ?? []) as TenantMetrica[];
  const fichas = (fichasData ?? []) as FichaMetrica[];
  const agora = new Date();
  const inicioMes = new Date(agora.getFullYear(), agora.getMonth(), 1).toISOString();
  const em30 = diasAtras(30).toISOString();
  const em60 = diasAtras(60).toISOString();

  const ativos = tenants.filter((t) => t.status === "ativo");
  const trial = tenants.filter((t) => t.status === "trial");
  const suspensos = tenants.filter((t) => t.status === "suspenso");
  const cancelados = tenants.filter((t) => t.status === "cancelado");
  const novos30 = tenants.filter((t) => t.criado_em >= em30);
  const novos30Anterior = tenants.filter((t) => t.criado_em >= em60 && t.criado_em < em30);
  const trialsExpirando = trial.filter((t) => {
    if (!t.trial_expira_em) return false;
    const expira = new Date(t.trial_expira_em).getTime();
    return expira >= Date.now() && expira <= diasAtras(-7).getTime();
  });

  const mrr = ativos.reduce((soma, t) => soma + (PRECOS[t.plano] ?? 0), 0);
  const fichas30 = fichas.filter((f) => f.criado_em >= em30);
  const fichas30Anterior = fichas.filter((f) => f.criado_em >= em60 && f.criado_em < em30);
  const salvas = fichas30.filter((f) => f.status === "salva").length;
  const erros = fichas30.filter((f) => f.status === "erro").length;

  const tenantsComFicha = new Set(fichas30.map((f) => f.tenant_id));
  const ativacao30 = taxa(
    ativos.filter((t) => tenantsComFicha.has(t.id)).length,
    ativos.length
  );

  const porNichoMap = new Map<string, { total: number; ativos: number; mrr: number }>();
  for (const t of tenants) {
    const atual = porNichoMap.get(t.nicho_slug) ?? { total: 0, ativos: 0, mrr: 0 };
    atual.total += 1;
    if (t.status === "ativo") {
      atual.ativos += 1;
      atual.mrr += PRECOS[t.plano] ?? 0;
    }
    porNichoMap.set(t.nicho_slug, atual);
  }

  const serieTenants = new Map<string, number>();
  for (const t of tenants) {
    const k = chaveMes(t.criado_em);
    serieTenants.set(k, (serieTenants.get(k) ?? 0) + 1);
  }
  const serieFichas = new Map<string, number>();
  for (const f of fichas) {
    const k = chaveMes(f.criado_em);
    serieFichas.set(k, (serieFichas.get(k) ?? 0) + 1);
  }
  const serie = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(agora.getFullYear(), agora.getMonth() - i, 1);
    const k = chaveMes(d);
    serie.push({
      mes: k,
      rotulo: rotuloMes(d),
      novos_tenants: serieTenants.get(k) ?? 0,
      fichas: serieFichas.get(k) ?? 0,
    });
  }

  const tickets = ativos.map((t) => PRECOS[t.plano] ?? 0).filter((v) => v > 0);
  const ticketMedio = tickets.length
    ? Math.round((tickets.reduce((a, b) => a + b, 0) / tickets.length) * 100) / 100
    : 0;

  return {
    atualizado_em: agora.toISOString(),
    tenants: {
      total: tenants.length,
      ativos: ativos.length,
      trial: trial.length,
      suspensos: suspensos.length,
      cancelados: cancelados.length,
      novos_30d: novos30.length,
      variacao_novos: variacao(novos30.length, novos30Anterior.length),
      trials_expirando_7d: trialsExpirando.length,
    },
    negocio: {
      mrr,
      arr: mrr * 12,
      arpa: ativos.length ? Math.round((mrr / ativos.length) * 100) / 100 : 0,
      ticket_medio: ticketMedio,
      conversao_trial: taxa(ativos.length, ativos.length + trial.length),
      churn: taxa(cancelados.length, Math.max(1, ativos.length + cancelados.length)),
      ativacao_30d: ativacao30,
    },
    fichas: {
      total_180d: fichas.length,
      ultimos_30_dias: fichas30.length,
      variacao: variacao(fichas30.length, fichas30Anterior.length),
      salvas_30d: salvas,
      erros_30d: erros,
      taxa_conclusao: taxa(salvas, fichas30.length),
      taxa_erro: taxa(erros, fichas30.length),
      menores_30d: fichas30.filter((f) => f.menor_idade).length,
      por_mes: serie,
      top_profissionais: topValores(fichas30, "profissional", 5),
    },
    nichos: [...porNichoMap.entries()]
      .map(([nicho, dados]) => ({
        nicho,
        ...dados,
        percentual: taxa(dados.ativos, Math.max(1, ativos.length)),
      }))
      .sort((a, b) => b.ativos - a.ativos),
    tenants_recentes: tenants.slice(0, 8).map((t) => ({
      id: t.id,
      slug: t.slug,
      nome_negocio: t.nome_negocio,
      nicho_slug: t.nicho_slug,
      plano: t.plano,
      status: t.status,
      criado_em: t.criado_em,
      trial_expira_em: t.trial_expira_em,
    })),
    fichas_mes_atual: fichas.filter((f) => mesAtual(new Date(f.criado_em)) === mesAtual(agora)).length,
    inicio_mes: inicioMes,
  };
}
