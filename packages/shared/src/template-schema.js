import { z } from "zod";

const idSchema = z
  .string()
  .min(2)
  .max(64)
  .regex(/^[a-z][a-z0-9_]*$/, "Use snake_case começando por letra minúscula.");

const condicionalSchema = z
  .object({
    tipo: z.enum(["menor_idade", "maior_idade", "parq_positivo"]).optional(),
    campo: z.string().optional(),
    operador: z
      .enum(["igual", "diferente", "contem", "nao_contem", "verdadeiro", "preenchido"])
      .optional(),
    valor: z.union([z.string(), z.number(), z.boolean()]).optional(),
  })
  .refine((c) => Boolean(c.tipo) || Boolean(c.campo), {
    message: "Condicional precisa de `tipo` ou `campo`.",
  });

const campoSchema = z
  .object({
    id: idSchema,
    label: z.string().min(2).max(160),
    tipo: z.enum([
      "text",
      "textarea",
      "date",
      "cpf",
      "tel",
      "email",
      "number",
      "sim_nao",
      "checkbox",
      "select",
      "upload",
    ]),
    obrigatorio: z.boolean().default(false),
    placeholder: z.string().max(200).optional(),
    hint: z.string().max(300).optional(),
    opcoes: z.array(z.string().min(1).max(120)).optional(),
    opcoes_fonte: z.enum(["profissionais"]).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    min_selecionados: z.number().int().positive().optional(),
    exclusivo: z.string().optional(),
    max_mb: z.number().positive().max(25).optional(),
    aceita: z.array(z.string()).optional(),
    compacto: z.boolean().optional(),
    alerta_sim: z.boolean().optional(),
    parq: z.boolean().optional(),
    autocomplete: z.string().max(40).optional(),
    regra: z.enum(["data_passada"]).optional(),
    condicional: condicionalSchema.optional(),
  })
  .superRefine((campo, ctx) => {
    if (campo.tipo === "select" && !campo.opcoes?.length && !campo.opcoes_fonte) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Campo "${campo.id}": select exige opcoes ou opcoes_fonte.`,
      });
    }
    if (campo.tipo === "checkbox" && !campo.opcoes?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Campo "${campo.id}": checkbox exige opcoes.`,
      });
    }
    if (
      campo.opcoes_fonte &&
      campo.opcoes_fonte === "profissionais" &&
      campo.tipo !== "select"
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Campo "${campo.id}": opcoes_fonte profissionais só é válido em select.`,
      });
    }
    if (campo.exclusivo && campo.opcoes && !campo.opcoes.includes(campo.exclusivo)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Campo "${campo.id}": exclusivo deve existir em opcoes.`,
      });
    }
  });

const secaoSchema = z.object({
  id: idSchema,
  titulo: z.string().min(2).max(120),
  rotulo_curto: z.string().max(24).optional(),
  descricao: z.string().max(400).optional(),
  layout: z.enum(["padrao", "grade"]).optional(),
  condicional: condicionalSchema.optional(),
  campos: z.array(campoSchema).min(1),
});

const landingSchema = z
  .object({
    headline: z.string().min(5),
    subheadline: z.string().min(5),
    cta_primario: z.string().min(2),
    cta_secundario: z.string().optional(),
    secoes: z.array(z.string()).optional(),
    seo_keywords: z.array(z.string()).optional(),
    faq: z
      .array(z.object({ pergunta: z.string(), resposta: z.string() }))
      .optional(),
    depoimentos: z.array(z.any()).optional(),
  })
  .passthrough();

export const templateSchema = z
  .object({
    nicho_slug: idSchema,
    nome: z.string().min(3).max(160),
    nome_comercial: z.string().max(80),
    dominio: z.string().max(120).optional(),
    versao: z.number().int().positive().default(1),
    publico: z.string().max(200).optional(),
    dor_principal: z.string().max(400).optional(),
    secoes: z.array(secaoSchema).min(1),
    consentimentos_extras: z
      .array(
        z.object({
          id: idSchema,
          label: z.string().min(10).max(500),
          obrigatorio: z.boolean().default(false),
        })
      )
      .optional(),
    termo_texto: z.string().min(80),
    consentimento_lgpd: z.string().min(80),
    landing_copy: landingSchema.optional(),
    onboarding: z.record(z.any()).optional(),
    preco: z.record(z.any()).optional(),
    metricas_sucesso: z.array(z.string()).optional(),
  })
  .superRefine((template, ctx) => {
    const idsCampos = new Map();
    const idsSecoes = new Set();

    for (const secao of template.secoes) {
      if (idsSecoes.has(secao.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Seção duplicada: ${secao.id}`,
        });
      }
      idsSecoes.add(secao.id);
      for (const campo of secao.campos) {
        if (idsCampos.has(campo.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Campo duplicado: ${campo.id} (seções ${idsCampos.get(campo.id)} e ${secao.id})`,
          });
        }
        idsCampos.set(campo.id, secao.id);
      }
    }

    for (const secao of template.secoes) {
      for (const campo of secao.campos) {
        const cond = campo.condicional;
        if (cond?.campo && !idsCampos.has(cond.campo)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: `Campo "${campo.id}" referencia condicional inexistente: ${cond.campo}`,
          });
        }
      }
    }

    const idsExtras = new Set();
    for (const extra of template.consentimentos_extras ?? []) {
      if (idsExtras.has(extra.id) || idsCampos.has(extra.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Consentimento extra duplicado: ${extra.id}`,
        });
      }
      idsExtras.add(extra.id);
    }
  });

/**
 * Valida e normaliza um template (aplica defaults).
 * Lança ZodError com detalhes legíveis em caso de falha.
 */
export function validarTemplate(template) {
  return templateSchema.parse(template);
}

export function validarTemplateSeguro(template) {
  return templateSchema.safeParse(template);
}
