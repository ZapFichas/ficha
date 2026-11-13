/**
 * Permissões operacionais do tenant.
 * São configurações de fluxo, não de segurança: a autorização real continua
 * no servidor (owner/profissional) e no RLS.
 */

export const PERMISSOES_PADRAO = {
  permite_pendencia_responsavel: true,
  permite_alteracao_dados: true,
  exige_aprovacao_alteracao: true,
  mostrar_vitrine: true,
  permitir_profissional_customizado: false,
};

export function normalizarPermissoes(entrada) {
  const base = { ...PERMISSOES_PADRAO };
  if (!entrada || typeof entrada !== "object") return base;
  for (const chave of Object.keys(PERMISSOES_PADRAO)) {
    if (typeof entrada[chave] === "boolean") base[chave] = entrada[chave];
  }
  return base;
}
