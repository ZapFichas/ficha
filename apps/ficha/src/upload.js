/**
 * Upload com compressão no cliente.
 * Imagens viram JPEG (máx. 1600 px, qualidade 0.82); PDFs são mantidos.
 */

const DIMENSAO_MAX = 1600;
const QUALIDADE = 0.82;

export function estimarTamanhoBytes(base64 = "") {
  return Math.floor((String(base64).length * 3) / 4);
}

function lerComoDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

async function comprimirImagem(file) {
  const dataUrl = await lerComoDataURL(file);
  const img = await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("Formato de imagem não suportado pelo navegador. Envie JPG, PNG ou PDF."));
    image.src = dataUrl;
  });

  let { width, height } = img;
  if (width > DIMENSAO_MAX || height > DIMENSAO_MAX) {
    const escala = Math.min(DIMENSAO_MAX / width, DIMENSAO_MAX / height);
    width = Math.round(width * escala);
    height = Math.round(height * escala);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);

  const comprimido = canvas.toDataURL("image/jpeg", QUALIDADE);
  return {
    base64: comprimido.split(",")[1],
    mime: "image/jpeg",
    nome: file.name.replace(/\.[^.]+$/, "") + ".jpg",
    tamanho: estimarTamanhoBytes(comprimido.split(",")[1]),
  };
}

async function lerPDF(file) {
  const dataUrl = await lerComoDataURL(file);
  return {
    base64: dataUrl.split(",")[1],
    mime: "application/pdf",
    nome: file.name,
    tamanho: file.size,
  };
}

export async function processarArquivo(file, campo) {
  const maxMb = campo.max_mb ?? 10;
  const aceita = campo.aceita ?? ["image/jpeg", "image/png", "image/webp", "application/pdf"];

  const mime = file.type || "";
  const permitido = aceita.some((padrao) =>
    padrao.endsWith("/*") ? mime.startsWith(padrao.slice(0, -1)) : mime === padrao
  );
  if (!permitido) {
    throw new Error("Formato não aceito. Envie uma imagem (JPG/PNG) ou PDF.");
  }
  if (file.size > maxMb * 1024 * 1024) {
    throw new Error(`Arquivo acima de ${maxMb} MB.`);
  }

  if (mime === "application/pdf") return lerPDF(file);
  return comprimirImagem(file);
}

export function criarCampoUpload({ campo, valorInicial, onChange, onError }) {
  let valor = valorInicial ?? null;
  let processando = false;

  const raiz = document.createElement("div");
  raiz.className = "upload-campo";

  const area = document.createElement("div");
  area.className = "upload-area";
  area.tabIndex = 0;
  area.setAttribute("role", "button");
  area.setAttribute("aria-label", campo.label);

  const input = document.createElement("input");
  input.type = "file";
  input.accept = (campo.aceita ?? ["image/*", "application/pdf"]).join(",");
  input.className = "upload-input";
  input.tabIndex = -1;

  const icone = document.createElement("div");
  icone.className = "upload-icone";
  icone.setAttribute("aria-hidden", "true");
  icone.textContent = "＋";

  const texto = document.createElement("div");
  texto.className = "upload-texto";
  texto.innerHTML = "<strong>Toque para enviar</strong><span>ou arraste o arquivo aqui</span>";

  const nota = document.createElement("div");
  nota.className = "upload-nota";
  nota.textContent = `Imagem ou PDF · até ${campo.max_mb ?? 10} MB`;

  const preview = document.createElement("div");
  preview.className = "upload-preview";
  preview.hidden = true;

  const remover = document.createElement("button");
  remover.type = "button";
  remover.className = "upload-remover";
  remover.textContent = "Remover";
  remover.hidden = true;

  area.append(input, icone, texto, nota);
  raiz.append(area, preview, remover);

  const aplicar = (novo, propagar = true) => {
    valor = novo;
    renderizar();
    if (propagar) onChange?.(novo);
  };

  const renderizar = () => {
    if (!valor) {
      area.hidden = false;
      preview.hidden = true;
      remover.hidden = true;
      area.classList.remove("tem-arquivo");
      return;
    }
    area.hidden = true;
    preview.hidden = false;
    remover.hidden = false;
    preview.innerHTML = "";

    if (valor.mime?.startsWith("image/")) {
      const img = document.createElement("img");
      img.src = `data:${valor.mime};base64,${valor.base64}`;
      img.alt = "Prévia do arquivo enviado";
      preview.append(img);
    } else {
      const pdf = document.createElement("div");
      pdf.className = "upload-pdf";
      pdf.textContent = "PDF";
      preview.append(pdf);
    }

    const info = document.createElement("div");
    info.className = "upload-info";
    const nome = document.createElement("span");
    nome.className = "upload-nome";
    nome.textContent = valor.nome ?? "Arquivo anexado";
    const tamanho = document.createElement("small");
    tamanho.textContent = `${(valor.tamanho / 1024 / 1024).toFixed(2)} MB`;
    info.append(nome, tamanho);
    preview.append(info);
  };

  const selecionar = async (file) => {
    if (!file || processando) return;
    processando = true;
    area.classList.add("processando");
    texto.innerHTML = "<strong>Processando…</strong><span>Preparando o arquivo</span>";
    try {
      const resultado = await processarArquivo(file, campo);
      aplicar(resultado);
    } catch (err) {
      onError?.(err.message ?? "Não foi possível processar o arquivo.");
      texto.innerHTML = "<strong>Toque para enviar</strong><span>ou arraste o arquivo aqui</span>";
    } finally {
      processando = false;
      area.classList.remove("processando");
    }
  };

  input.addEventListener("change", () => selecionar(input.files?.[0]));
  remover.addEventListener("click", () => {
    input.value = "";
    aplicar(null);
  });

  area.addEventListener("click", () => input.click());
  area.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      input.click();
    }
  });
  area.addEventListener("dragover", (e) => {
    e.preventDefault();
    area.classList.add("arrastando");
  });
  area.addEventListener("dragleave", () => area.classList.remove("arrastando"));
  area.addEventListener("drop", (e) => {
    e.preventDefault();
    area.classList.remove("arrastando");
    selecionar(e.dataTransfer?.files?.[0]);
  });

  renderizar();

  return {
    elemento: raiz,
    get valor() {
      return valor;
    },
    limpar() {
      input.value = "";
      aplicar(null);
    },
  };
}
