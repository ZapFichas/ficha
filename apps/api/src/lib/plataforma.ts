/** Allowlist simples de administradores globais da plataforma. */
export function emailsPlataforma(env: { PLATFORM_ADMIN_EMAILS?: string }): string[] {
  return String(env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function ehAdminPlataforma(
  env: { PLATFORM_ADMIN_EMAILS?: string },
  email?: string | null
): boolean {
  if (!email) return false;
  return emailsPlataforma(env).includes(String(email).trim().toLowerCase());
}
