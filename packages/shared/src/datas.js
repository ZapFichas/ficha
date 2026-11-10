/** Datas em formato ISO (YYYY-MM-DD) sem armadilhas de fuso horário. */

export function parseDataISO(valor) {
  if (valor instanceof Date) {
    return new Date(Date.UTC(valor.getFullYear(), valor.getMonth(), valor.getDate()));
  }
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(valor ?? "").trim());
  if (!m) return null;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (
    data.getUTCFullYear() !== ano ||
    data.getUTCMonth() !== mes - 1 ||
    data.getUTCDate() !== dia
  ) {
    return null;
  }
  return data;
}

export function dataISOHoje(hoje = new Date()) {
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export function calcularIdade(dataNascimento, hoje = new Date()) {
  const nasc = parseDataISO(dataNascimento);
  if (!nasc) return null;
  let idade = hoje.getFullYear() - nasc.getUTCFullYear();
  const m = hoje.getMonth() - nasc.getUTCMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nasc.getUTCDate())) idade -= 1;
  return idade;
}

export function ehMenorDeIdade(dataNascimento, hoje = new Date()) {
  const idade = calcularIdade(dataNascimento, hoje);
  return idade !== null && idade < 18;
}

export function formatarDataBR(valor) {
  if (!valor) return "";
  if (valor instanceof Date) {
    return valor.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  }
  const iso = parseDataISO(valor);
  if (iso) {
    return `${String(iso.getUTCDate()).padStart(2, "0")}/${String(
      iso.getUTCMonth() + 1
    ).padStart(2, "0")}/${iso.getUTCFullYear()}`;
  }
  return String(valor);
}

export function formatarDataHoraBR(valor, timeZone = "America/Sao_Paulo") {
  const data = valor instanceof Date ? valor : new Date(valor);
  if (Number.isNaN(data.getTime())) return "";
  return data.toLocaleString("pt-BR", { timeZone });
}
