import type { Env } from "../env.js";

function escaparHtml(texto: string): string {
  return String(texto)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function enviarEmail(
  env: Env,
  { para, assunto, html }: { para: string; assunto: string; html: string }
): Promise<boolean> {
  if (!env.RESEND_API_KEY) {
    console.log("RESEND_API_KEY ausente; e-mail não enviado:", assunto, para);
    return false;
  }

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM ?? "FichaPro <nao-responda@fichapro.app>",
        to: [para],
        subject: assunto,
        html,
      }),
    });
    if (!resp.ok) {
      console.error("Falha ao enviar e-mail:", resp.status, await resp.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("Erro de e-mail:", err);
    return false;
  }
}

export async function enviarBoasVindas(
  env: Env,
  { email, nomeNegocio, linkFicha, linkPainel }: {
    email: string;
    nomeNegocio: string;
    linkFicha: string;
    linkPainel: string;
  }
): Promise<boolean> {
  const nome = escaparHtml(nomeNegocio);
  const ficha = escaparHtml(linkFicha);
  const painel = escaparHtml(linkPainel);

  const html = `<!doctype html>
<html lang="pt-BR"><body style="margin:0;background:#f3f7f4;font-family:Arial,sans-serif;color:#1d2b24">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <p style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#4f7963">FichaPro</p>
    <h1 style="font-size:26px;font-weight:400;margin:10px 0 14px">Bem-vindo(a), ${nome}!</h1>
    <p style="font-size:15px;line-height:1.65;color:#52665b">
      Sua conta está pronta. Falta conectar o Google Drive e imprimir o QR code para começar a receber as fichas.
    </p>
    <p style="margin:26px 0">
      <a href="${painel}" style="background:#4f7963;color:#fff;text-decoration:none;padding:13px 22px;border-radius:8px;font-size:13px;letter-spacing:1px;text-transform:uppercase">Abrir o painel</a>
    </p>
    <p style="font-size:13px;line-height:1.6;color:#52665b">Link da sua ficha: <a href="${ficha}" style="color:#4f7963">${ficha}</a></p>
    <hr style="border:none;border-top:1px solid #dbe7e0;margin:28px 0">
    <p style="font-size:11px;line-height:1.6;color:#8aa094">
      Você recebeu este e-mail porque criou uma conta no FichaPro. Se não reconhece, ignore esta mensagem.
    </p>
  </div>
</body></html>`;

  return enviarEmail(env, {
    para: email,
    assunto: "Sua ficha digital está pronta",
    html,
  });
}
