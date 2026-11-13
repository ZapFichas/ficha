export interface PdfJob {
  fichaId: string;
  tenantId: string;
}

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;

  /** Chave AES-GCM de 32 bytes em base64. */
  DATA_ENCRYPTION_KEY: string;
  /** Pepper para HMAC-SHA256 do CPF. */
  CPF_HASH_PEPPER: string;
  /** Segredo para assinar o state do OAuth. */
  OAUTH_STATE_SECRET: string;

  APP_URL: string;
  FICHA_URL?: string;
  PANEL_URL?: string;
  FICHA_URL_TEMPLATE?: string;
  ENVIRONMENT?: string;

  FICHAS_BUCKET?: R2Bucket;
  PDF_QUEUE: Queue<PdfJob>;

  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_OAUTH_REDIRECT_URI?: string;

  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  SENTRY_DSN?: string;

  /** E-mails (separados por vírgula) com acesso ao dashboard global. */
  PLATFORM_ADMIN_EMAILS?: string;

  STRIPE_WEBHOOK_SECRET?: string;
  ASAAS_WEBHOOK_TOKEN?: string;
}

export interface UsuarioSessao {
  id: string;
  email: string;
  tenantId: string;
  role: "owner" | "profissional";
  nome: string | null;
}

export type AppEnv = {
  Bindings: Env;
  Variables: {
    usuario: UsuarioSessao;
    accessToken: string;
  };
};
