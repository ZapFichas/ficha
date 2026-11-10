const runtime = globalThis.__PAINEL_CONFIG__ ?? {};

export const CONFIG = {
  supabaseUrl: runtime.supabaseUrl ?? import.meta.env.VITE_SUPABASE_URL ?? "",
  supabaseAnonKey:
    runtime.supabaseAnonKey ?? import.meta.env.VITE_SUPABASE_ANON_KEY ?? "",
  apiBase: (runtime.apiBase ?? import.meta.env.VITE_API_BASE ?? "").replace(/\/$/, ""),
};

export const configurado = Boolean(CONFIG.supabaseUrl && CONFIG.supabaseAnonKey);

export const NICHOS = [
  { slug: "tatuagem", nome: "Tatuagem" },
  { slug: "piercing", nome: "Piercing" },
  { slug: "estetica", nome: "Estética" },
  { slug: "fitness", nome: "Fitness" },
];

export const STATUS = {
  rascunho: { rotulo: "Rascunho", classe: "neutro" },
  preenchida: { rotulo: "Processando", classe: "processando" },
  pdf_gerado: { rotulo: "PDF gerado", classe: "processando" },
  salva: { rotulo: "Concluída", classe: "sucesso" },
  erro: { rotulo: "Erro", classe: "erro" },
};
