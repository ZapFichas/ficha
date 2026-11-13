import type { SupabaseClient } from "@supabase/supabase-js";

export interface Profissional {
  id: string;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  especialidade?: string | null;
  registro?: string | null;
  cor?: string | null;
  ativo?: boolean;
}

export interface ListaProfissionais {
  itens: Profissional[];
  fonte: "profissionais" | "usuarios" | "indisponivel";
  aviso?: string;
}

function tabelaAusente(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const msg = String(error.message ?? "").toLowerCase();
  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    error.code === "PGRST204" ||
    msg.includes("does not exist") ||
    msg.includes("could not find the table") ||
    msg.includes("schema cache")
  );
}

/**
 * Lista profissionais do tenant.
 * A tabela `profissionais` é a fonte nova. Se a migration ainda não foi
 * aplicada, cai para os usuários do tenant (comportamento antigo).
 */
export async function listarProfissionais(
  admin: SupabaseClient,
  tenantId: string,
  { somenteAtivos = true } = {}
): Promise<ListaProfissionais> {
  const base = admin
    .from("profissionais")
    .select("id, nome, email, telefone, especialidade, registro, cor, ativo")
    .eq("tenant_id", tenantId)
    .order("nome", { ascending: true });

  const { data, error } = somenteAtivos ? await base.eq("ativo", true) : await base;

  if (!error && data && data.length > 0) {
    return { itens: data as Profissional[], fonte: "profissionais" };
  }

  if (error && !tabelaAusente(error)) {
    return {
      itens: [],
      fonte: "indisponivel",
      aviso: "Não foi possível carregar os profissionais.",
    };
  }

  const { data: usuarios, error: erroUsuarios } = await admin
    .from("usuarios")
    .select("id, nome, email, ativo")
    .eq("tenant_id", tenantId)
    .eq("ativo", true)
    .order("nome", { ascending: true });

  if (erroUsuarios) {
    return { itens: [], fonte: "indisponivel", aviso: "Não foi possível carregar os profissionais." };
  }

  return {
    itens: (usuarios ?? []).map((u: Record<string, unknown>) => ({
      id: String(u.id),
      nome: String(u.nome ?? u.email ?? "Profissional").trim() || "Profissional",
      email: u.email ? String(u.email) : null,
      ativo: true,
    })),
    fonte: "usuarios",
    aviso:
      "Cadastro completo de profissionais disponível após aplicar a migration de equipe.",
  };
}

export async function resolverProfissional(
  admin: SupabaseClient,
  tenantId: string,
  { id, nome }: { id?: string | null; nome?: string | null }
): Promise<Profissional | null> {
  const lista = await listarProfissionais(admin, tenantId);
  if (id) {
    const porId = lista.itens.find((p) => p.id === id);
    if (porId) return porId;
  }
  const alvo = String(nome ?? "").trim().toLowerCase();
  if (!alvo) return null;
  return lista.itens.find((p) => p.nome.trim().toLowerCase() === alvo) ?? null;
}
