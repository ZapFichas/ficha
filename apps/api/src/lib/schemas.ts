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
      modo_demo: z.boolean().optional(),
      idempotencia: z.string().max(100).optional(),
    })
    .passthrough()
    .optional(),
});

export type PayloadFicha = z.infer<typeof payloadFichaSchema>;

export const onboardingSchema = z.object({
  slug: z
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
