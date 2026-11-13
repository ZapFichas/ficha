import { z } from "zod";

const uploadSchema = z.object({
  base64: z.string().min(16).max(22 * 1024 * 1024),
  mime: z.string().min(3).max(120),
  nome: z.string().min(1).max(255),
  tamanho: z.number().nonnegative().optional(),
});

export const assinaturaSchema = z.object({
  papel: z.enum(["cliente", "responsavel"]),
  imagem_base64: z.string().min(100).max(4 * 1024 * 1024),
  timestamp: z.string().max(40).optional(),
});

export const consentimentoSchema = z.object({
  tipo: z.string().min(2).max(60),
  aceito: z.boolean(),
  texto_aceito: z.string().max(30000).optional(),
  versao: z.string().max(20).optional(),
});

export const payloadFichaSchema = z.object({
  tenant_slug: z.string().min(1).max(64),
  template_slug: z.string().min(1).max(64),
  formulario_id: z.string().uuid().optional(),
  profissional_id: z.string().uuid().optional(),
  dados: z.record(z.any()),
  assinaturas: z.array(assinaturaSchema).min(1).max(3),
  consentimentos: z.array(consentimentoSchema).min(2).max(12),
  meta: z
    .object({
      iniciado_em: z.string().max(40).optional(),
      concluido_em: z.string().max(40).optional(),
      user_agent: z.string().max(1000).optional(),
      idioma: z.string().max(20).optional(),
      menor_idade: z.boolean().optional(),
      pendencia_documentacao: z.boolean().optional(),
      modo_demo: z.boolean().optional(),
      idempotencia: z.string().max(100).optional(),
    })
    .passthrough()
    .optional(),
});

export type PayloadFicha = z.infer<typeof payloadFichaSchema>;

/**
 * null = todos os campos do template.
 * array = lista de ids.
 * objeto = { secoes: [{ id, campos?: [ids] }] }
 */
export const camposAtivosSchema = z.union([
  z.null(),
  z.array(z.string().min(1).max(80)).max(200),
  z.object({
    secoes: z
      .array(
        z.object({
          id: z.string().min(1).max(80),
          campos: z.array(z.string().min(1).max(80)).max(200).optional(),
        })
      )
      .max(50),
  }),
]);

export const campoCustomizadoSchema = z.object({
  id: z.string().max(80).optional(),
  label: z.string().min(2).max(80),
  tipo: z
    .enum([
      "text",
      "textarea",
      "date",
      "cpf",
      "tel",
      "email",
      "number",
      "sim_nao",
      "select",
      "checkbox",
    ])
    .optional(),
  obrigatorio: z.boolean().optional(),
  placeholder: z.string().max(120).optional(),
  hint: z.string().max(180).optional(),
  opcoes: z.array(z.string().min(1).max(60)).max(30).optional(),
  min: z.number().finite().optional(),
  max: z.number().finite().optional(),
  secao_id: z.string().min(1).max(60).optional(),
  secao_titulo: z.string().max(80).optional(),
});

export const camposCustomizadosSchema = z.array(campoCustomizadoSchema).max(40);

export const profissionalSchema = z.object({
  nome: z.string().min(2).max(120),
  email: z.string().email().max(200).optional().nullable(),
  telefone: z.string().max(40).optional().nullable(),
  especialidade: z.string().max(120).optional().nullable(),
  registro: z.string().max(60).optional().nullable(),
  cor: z.string().max(9).optional().nullable(),
  ativo: z.boolean().optional(),
});

export const solicitacaoAlteracaoSchema = z
  .object({
    tenant_slug: z.string().min(1).max(64),
    protocolo: z.string().min(4).max(40),
    cpf: z.string().min(11).max(14).optional(),
    cpf_ultimos4: z.string().regex(/^\d{4}$/).optional(),
    justificativa: z.string().min(5).max(500),
    campos: z.array(z.string().max(80)).max(30).optional(),
  })
  .refine((d) => Boolean(d.cpf || d.cpf_ultimos4), {
    message: "Informe o CPF para confirmar a titularidade.",
    path: ["cpf"],
  });

export const edicaoFichaSchema = z.object({
  dados: z.record(z.any()),
  justificativa: z.string().min(5).max(500),
  alteracao_id: z.string().uuid().optional(),
});

export const onboardingSchema = z.object({  slug: z
    .string()
    .min(3)
    .max(63)
    .regex(/^[a-z0-9][a-z0-9-]*$/, "Use apenas letras minúsculas, números e hífen.")
    .refine((s) => !s.endsWith("-"), "O slug não pode terminar com hífen."),
  nome_negocio: z.string().min(2).max(120),
  nicho_slug: z.enum(["tatuagem", "piercing", "estetica", "fitness", "salao", "odonto", "fisio"]),
  nome_usuario: z.string().max(120).optional(),
  branding: z
    .object({
      cor_primaria: z.string().max(9).optional(),
      cor_secundaria: z.string().max(9).optional(),
      cor_fundo: z.string().max(9).optional(),
      logo_url: z.string().url().max(500).nullable().optional(),
    })
    .partial()
    .optional(),
});
