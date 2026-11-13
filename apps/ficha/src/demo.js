import { produtosPara } from "@fichapro/shared";
import tatuagem from "../../../templates/tatuagem.json";
import piercing from "../../../templates/piercing.json";
import estetica from "../../../templates/estetica.json";
import fitness from "../../../templates/fitness.json";

const TEMPLATES = { tatuagem, piercing, estetica, fitness };

export const NICHOS = [
  {
    slug: "tatuagem",
    nome: "Tatuagem",
    descricao: "Anamnese, termo, assinatura e autorização de menor.",
    cor: "#4F7963",
  },
  {
    slug: "piercing",
    nome: "Piercing",
    descricao: "Termo específico, joia, alergia a metal e menor.",
    cor: "#2f6f73",
  },
  {
    slug: "estetica",
    nome: "Estética",
    descricao: "Procedimentos, foto antes e consentimento de imagem.",
    cor: "#8a5a6b",
  },
  {
    slug: "fitness",
    nome: "Fitness",
    descricao: "PAR-Q, liberação médica e termo de responsabilidade.",
    cor: "#2f5d8a",
  },
];

const BRANDING = {
  tatuagem: {
    cor_primaria: "#4F7963",
    cor_secundaria: "#3a5c4a",
    cor_fundo: "#e7efe9",
    nome_negocio: "Estúdio Exemplo",
  },
  piercing: {
    cor_primaria: "#2f6f73",
    cor_secundaria: "#234f52",
    cor_fundo: "#e4eff0",
    nome_negocio: "Estúdio Exemplo",
  },
  estetica: {
    cor_primaria: "#8a5a6b",
    cor_secundaria: "#6d4353",
    cor_fundo: "#f5eaee",
    nome_negocio: "Clínica Exemplo",
  },
  fitness: {
    cor_primaria: "#2f5d8a",
    cor_secundaria: "#234768",
    cor_fundo: "#e8eff7",
    nome_negocio: "Studio Exemplo",
  },
};

const PROFISSIONAIS = {
  tatuagem: [
    { id: "ana", nome: "Ana Ribeiro" },
    { id: "bruno", nome: "Bruno Salles" },
  ],
  piercing: [{ id: "carla", nome: "Carla Nunes" }],
  estetica: [{ id: "marina", nome: "Dra. Marina Alves" }],
  fitness: [{ id: "rafael", nome: "Rafael Costa" }],
};

export function nichoDoSlug(slug = "") {
  const limpo = slug.replace(/^demo-/, "");
  return TEMPLATES[limpo] ? limpo : "tatuagem";
}

export function configDemo(nicho = "tatuagem") {
  const slug = TEMPLATES[nicho] ? nicho : "tatuagem";
  const template = structuredClone(TEMPLATES[slug]);
  template.consentimentos_extras =
    template.consentimentos_extras ?? [];
  const branding = BRANDING[slug];

  return {
    demo: true,
    tenant: {
      slug: `demo-${slug}`,
      nome_negocio: branding.nome_negocio,
      branding: {
        cor_primaria: branding.cor_primaria,
        cor_secundaria: branding.cor_secundaria,
        cor_fundo: branding.cor_fundo,
        logo_url: null,
      },
      retencao_anos: 5,
      email_contato: "contato@estudioexemplo.com.br",
    },
    template,
    formulario: {
      id: `demo-${slug}`,
      campos_ativos: null,
      campos_customizados: [
        {
          id: "custom_como_nos_conheceu",
          label: "Como você nos conheceu?",
          tipo: "select",
          opcoes: ["Instagram", "Indicação", "Google", "Passando na rua"],
          obrigatorio: false,
          customizado: true,
        },
      ],
    },
    permissoes: {
      permite_pendencia_responsavel: true,
      permite_alteracao_dados: true,
      exige_aprovacao_alteracao: true,
      mostrar_vitrine: true,
    },
    produtos: produtosPara(slug, 3),
    profissionais: PROFISSIONAIS[slug],
  };
}
