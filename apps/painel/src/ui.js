export function h(tag, attrs = {}, ...filhos) {
  const el = document.createElement(tag);
  for (const [chave, valor] of Object.entries(attrs ?? {})) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (chave === "class") el.className = valor;
    else if (chave === "text") el.textContent = valor;
    else if (chave === "html") el.innerHTML = valor;
    else if (chave === "dataset") Object.assign(el.dataset, valor);
    else if (chave === "on") {
      for (const [evento, fn] of Object.entries(valor)) el.addEventListener(evento, fn);
    } else if (valor === true) el.setAttribute(chave, "");
    else el.setAttribute(chave, String(valor));
  }
  for (const filho of filhos.flat()) {
    if (filho === null || filho === undefined || filho === false) continue;
    el.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
  }
  return el;
}

export function iniciais(nome = "") {
  const partes = String(nome).trim().split(/\s+/).filter(Boolean);
  if (!partes.length) return "F";
  return (partes[0][0] + (partes[partes.length - 1][0] ?? "")).toUpperCase();
}

export function slugify(texto = "") {
  return String(texto)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, 63);
}

export function hexParaRgb(hex) {
  const limpo = String(hex ?? "").replace("#", "").trim();
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(limpo)) return null;
  const full =
    limpo.length === 3
      ? limpo
          .split("")
          .map((c) => c + c)
          .join("")
      : limpo;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

export function formatarData(iso) {
  if (!iso) return "—";
  const data = new Date(iso.length === 10 ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(data.getTime())) return String(iso);
  return data.toLocaleDateString("pt-BR");
}

export function formatarDataHora(iso) {
  if (!iso) return "—";
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return String(iso);
  return data.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatarMoeda(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return String(valor);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

let toastTimer = null;
export function toast(mensagem, tipo = "ok") {
  let el = document.querySelector(".toast");
  if (!el) {
    el = h("div", { class: "toast", role: "status" });
    document.body.append(el);
  }
  el.className = `toast toast-${tipo} visivel`;
  el.textContent = mensagem;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    el.classList.remove("visivel");
  }, 3800);
}

export async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    toast("Link copiado.");
  } catch {
    const input = document.createElement("textarea");
    input.value = texto;
    document.body.append(input);
    input.select();
    document.execCommand("copy");
    input.remove();
    toast("Link copiado.");
  }
}
