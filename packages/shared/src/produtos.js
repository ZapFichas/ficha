/**
 * Vitrine interna (cross-selling) e canal de suporte.
 *
 * A vitrine aparece para o administrador do nicho e para o cliente final,
 * sempre com contexto: "quem usa tatuagem também costuma usar...".
 */

export const SUPORTE_WHATSAPP = {
  numero: "5561992944998",
  exibicao: "(61) 99294-4998",
  url(mensagem = "Olá! Preciso de ajuda com o FichaPro.") {
    return `https://wa.me/5561992944998?text=${encodeURIComponent(mensagem)}`;
  },
};

export const PRODUTOS = [
  {
    id: "tatuagem",
    nome: "FichaPro Tatuagem",
    descricao: "Anamnese, termo e autorização de menor para estúdios de tatuagem.",
    nichos: ["tatuagem"],
    caminho: "tatuagem",
    destaque: "Mais usado",
  },
  {
    id: "piercing",
    nome: "FichaPro Piercing",
    descricao: "Cuidados, contraindicações e termo específicos para piercing.",
    nichos: ["piercing"],
    caminho: "piercing",
  },
  {
    id: "estetica",
    nome: "FichaPro Estética",
    descricao: "Ficha de avaliação, fotos e termo para clínicas de estética.",
    nichos: ["estetica"],
    caminho: "estetica",
  },
  {
    id: "fitness",
    nome: "FichaPro Fitness",
    descricao: "PAR-Q, liberação médica e anamnese para personal e academias.",
    nichos: ["fitness"],
    caminho: "fitness",
  },
  {
    id: "odonto",
    nome: "FichaPro Odonto",
    descricao: "Anamnese odontológica e termo informado. Em breve.",
    nichos: [],
    caminho: null,
    em_breve: true,
  },
  {
    id: "fisio",
    nome: "FichaPro Fisio",
    descricao: "Avaliação funcional e histórico de sessões. Em breve.",
    nichos: [],
    caminho: null,
    em_breve: true,
  },
  {
    id: "salao",
    nome: "FichaPro Salão",
    descricao: "Ficha de química capilar, alergias e termo. Em breve.",
    nichos: [],
    caminho: null,
    em_breve: true,
  },
];

/** Produtos diferentes do nicho atual, priorizando os que já estão no ar. */
export function produtosPara(nichoAtual, limite = 3) {
  return [...PRODUTOS]
    .sort((a, b) => {
      const aAtual = a.nichos.includes(nichoAtual) ? 1 : 0;
      const bAtual = b.nichos.includes(nichoAtual) ? 1 : 0;
      if (aAtual !== bAtual) return aAtual - bAtual;
      return Number(Boolean(a.em_breve)) - Number(Boolean(b.em_breve));
    })
    .filter((p) => !p.nichos.includes(nichoAtual))
    .slice(0, limite);
}

export function linkProduto(produto, { fichaBase = "https://zapfichas.github.io/ficha", painelUrl = "" } = {}) {
  if (produto.caminho) {
    return `${fichaBase.replace(/\/$/, "")}/${produto.caminho}/`;
  }
  if (painelUrl) {
    return `${painelUrl.replace(/\/$/, "")}/?nicho=${encodeURIComponent(produto.id)}`;
  }
  return `${fichaBase.replace(/\/$/, "")}/`;
}
