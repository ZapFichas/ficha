import { avaliarCondicao, valorVazio, calcularParqPositivo } from "./condicoes.js";
import { calcularIdade, parseDataISO } from "./datas.js";
import { somenteDigitos, validarCPF } from "./cpf.js";

/** Tipos suportados pela engine. */
export const TIPOS_CAMPO = [
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
];

export const UPLOAD_PADRAO = {
  max_mb: 10,
  aceita: ["image/jpeg", "image/png", "image/webp", "application/pdf"],
};

/**
 * Aplica o subconjunto/ordem de campos configurado pelo tenant.
 * camposAtivos aceita:
 *  - null/undefined  -> template completo
 *  - ["id1","id2"]   -> filtra campos por id, mantendo a ordem do template
 *  - { secoes: [{ id, campos?: [ids] }] } -> filtra e reordena seções/campos
 */
export function aplicarCamposAtivos(template, camposAtivos = null) {
  if (!camposAtivos) return template;

  if (Array.isArray(camposAtivos)) {
    const permitidos = new Set(camposAtivos);
    return {
      ...template,
      secoes: (template.secoes ?? [])
        .map((secao) => ({
          ...secao,
          campos: (secao.campos ?? []).filter((c) => permitidos.has(c.id)),
        }))
        .filter((s) => s.campos.length > 0),
    };
  }

  if (camposAtivos.secoes) {
    const mapa = new Map((template.secoes ?? []).map((s) => [s.id, s]));
    const secoes = [];
    for (const entrada of camposAtivos.secoes) {
      const original = mapa.get(entrada.id);
      if (!original) continue;
      const permitidos = entrada.campos ? new Set(entrada.campos) : null;
      const campos = (original.campos ?? []).filter(
        (c) => !permitidos || permitidos.has(c.id)
      );
      if (campos.length) secoes.push({ ...original, campos });
    }
    return { ...template, secoes };
  }

  return template;
}

export function camposDoTemplate(template) {
  return (template?.secoes ?? []).flatMap((s) => s.campos ?? []);
}

export function secoesVisiveis(template, ctx) {
  return (template?.secoes ?? []).filter((secao) =>
    avaliarCondicao(secao.condicional, ctx)
  );
}

export function campoVisivel(campo, ctx) {
  return avaliarCondicao(campo.condicional, ctx);
}

export function montarContexto(template, dados, hoje = new Date()) {
  return {
    dados,
    menorIdade: (() => {
      const idade = calcularIdade(dados?.data_nascimento, hoje);
      return idade !== null && idade < 18;
    })(),
    parqPositivo: calcularParqPositivo(template, dados),
  };
}

function erro(msg) {
  return msg;
}

export function validarCampo(campo, valor, ctx = {}) {
  const obrigatorio = Boolean(campo.obrigatorio);

  if (valorVazio(valor)) {
    return obrigatorio ? `${campo.label} é obrigatório.` : null;
  }

  switch (campo.tipo) {
    case "cpf": {
      if (!validarCPF(valor)) return "CPF inválido. Confira os 11 dígitos.";
      return null;
    }
    case "tel": {
      const digitos = somenteDigitos(valor);
      if (digitos.length < 10 || digitos.length > 13) {
        return "Telefone inválido. Informe DDD + número.";
      }
      return null;
    }
    case "email": {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(valor).trim())) {
        return "E-mail inválido.";
      }
      return null;
    }
    case "date": {
      if (!parseDataISO(valor)) return "Data inválida.";
      if (campo.regra === "data_passada") {
        const d = parseDataISO(valor);
        const hoje = ctx.hoje ?? new Date();
        const hojeUTC = new Date(
          Date.UTC(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
        );
        if (d > hojeUTC) return "A data não pode estar no futuro.";
      }
      return null;
    }
    case "number": {
      const n = Number(valor);
      if (!Number.isFinite(n)) return "Informe um número válido.";
      if (campo.min !== undefined && n < campo.min) {
        return `Valor mínimo: ${campo.min}.`;
      }
      if (campo.max !== undefined && n > campo.max) {
        return `Valor máximo: ${campo.max}.`;
      }
      return null;
    }
    case "sim_nao": {
      if (valor !== "Sim" && valor !== "Não") return "Selecione Sim ou Não.";
      return null;
    }
    case "select": {
      if (!campo.opcoes_fonte && Array.isArray(campo.opcoes)) {
        if (!campo.opcoes.includes(String(valor))) return "Selecione uma opção válida.";
      }
      return null;
    }
    case "checkbox": {
      const lista = Array.isArray(valor) ? valor : [valor];
      if (campo.opcoes) {
        const invalido = lista.find((v) => !campo.opcoes.includes(v));
        if (invalido) return "Opção inválida.";
      }
      if (campo.min_selecionados && lista.length < campo.min_selecionados) {
        return `Selecione ao menos ${campo.min_selecionados} opção(ões).`;
      }
      if (campo.exclusivo && lista.length > 1 && lista.includes(campo.exclusivo)) {
        return `"${campo.exclusivo}" não pode ser combinado com outras opções.`;
      }
      return null;
    }
    case "upload": {
      const cfg = { ...UPLOAD_PADRAO, ...campo };
      if (!valor?.base64) return obrigatorio ? `${campo.label} é obrigatório.` : null;
      const maxBytes = (cfg.max_mb ?? 10) * 1024 * 1024;
      const aproxBytes = Math.floor((String(valor.base64).length * 3) / 4);
      if (aproxBytes > maxBytes) {
        return `Arquivo acima do limite de ${cfg.max_mb} MB.`;
      }
      const mime = String(valor.mime ?? "");
      const aceita = cfg.aceita ?? UPLOAD_PADRAO.aceita;
      const permitido = aceita.some((padrao) => {
        if (padrao.endsWith("/*")) return mime.startsWith(padrao.slice(0, -1));
        return mime === padrao;
      });
      if (!permitido) return "Formato de arquivo não aceito.";
      return null;
    }
    case "text":
    case "textarea": {
      const s = String(valor);
      if (campo.min !== undefined && s.trim().length < campo.min) {
        return `Mínimo de ${campo.min} caracteres.`;
      }
      if (campo.max !== undefined && s.length > campo.max) {
        return `Máximo de ${campo.max} caracteres.`;
      }
      return null;
    }
    default:
      return null;
  }
}

/**
 * Valida todas as respostas visíveis de um template.
 * Retorna erros por id de campo.
 */
export function validarRespostas(template, dados, opcoes = {}) {
  const {
    hoje = new Date(),
    camposAtivos = null,
    contextoExtra = {},
  } = opcoes;

  const t = aplicarCamposAtivos(template, camposAtivos);
  const ctx = {
    ...montarContexto(t, dados, hoje),
    hoje,
    ...contextoExtra,
  };

  const erros = {};
  for (const secao of secoesVisiveis(t, ctx)) {
    for (const campo of secao.campos ?? []) {
      if (!campoVisivel(campo, ctx)) continue;
      const msg = validarCampo(campo, dados?.[campo.id], ctx);
      if (msg) erros[campo.id] = msg;
    }
  }

  return { valido: Object.keys(erros).length === 0, erros };
}

/**
 * Remove respostas de campos ocultos (condicionais) e desconhecidos.
 * Evita gravar dados órfãos ou não previstos no template.
 */
export function sanitizarRespostas(template, dados, opcoes = {}) {
  const { hoje = new Date(), camposAtivos = null, contextoExtra = {} } = opcoes;
  const t = aplicarCamposAtivos(template, camposAtivos);
  const ctx = {
    ...montarContexto(t, dados, hoje),
    hoje,
    ...contextoExtra,
  };

  const limpo = {};
  for (const secao of secoesVisiveis(t, ctx)) {
    for (const campo of secao.campos ?? []) {
      if (!campoVisivel(campo, ctx)) continue;
      if (dados?.[campo.id] !== undefined) limpo[campo.id] = dados[campo.id];
    }
  }
  return limpo;
}

/** Resumo não sensível (indexável) para listagens e métricas. */
export function resumoFicha(template, dados) {
  const resumo = {};
  const candidatos = [
    "profissional",
    "data_procedimento",
    "local_tatuagem",
    "local_piercing",
    "procedimentos",
    "objetivo",
    "valor",
  ];
  for (const campo of camposDoTemplate(template)) {
    if (candidatos.includes(campo.id) && dados?.[campo.id] !== undefined) {
      resumo[campo.id] = dados[campo.id];
    }
  }
  return resumo;
}

export function camposObrigatoriosVisiveis(template, dados) {
  const t = aplicarCamposAtivos(template, null);
  const ctx = montarContexto(t, dados);
  return secoesVisiveis(t, ctx)
    .flatMap((s) => s.campos)
    .filter((c) => c.obrigatorio && campoVisivel(c, ctx))
    .map((c) => c.id);
}

export { erro };
