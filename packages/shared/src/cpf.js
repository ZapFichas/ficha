/**
 * Utilitários de CPF (compartilhados entre ficha, API e scripts).
 * NUNCA armazene CPF em claro em metadados. Use hash + últimos 4 dígitos.
 */

export function somenteDigitos(valor = "") {
  return String(valor ?? "").replace(/\D+/g, "");
}

export function mascararCPF(valor = "") {
  const c = somenteDigitos(valor).slice(0, 11);
  if (c.length <= 3) return c;
  if (c.length <= 6) return `${c.slice(0, 3)}.${c.slice(3)}`;
  if (c.length <= 9) return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6)}`;
  return `${c.slice(0, 3)}.${c.slice(3, 6)}.${c.slice(6, 9)}-${c.slice(9)}`;
}

export function validarCPF(valor = "") {
  const c = somenteDigitos(valor);
  if (c.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(c)) return false;

  const calcularDigito = (base) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) {
      soma += Number(base[i]) * (base.length + 1 - i);
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  const d1 = calcularDigito(c.slice(0, 9));
  const d2 = calcularDigito(c.slice(0, 10));
  return d1 === Number(c[9]) && d2 === Number(c[10]);
}

export function ultimos4CPF(valor = "") {
  return somenteDigitos(valor).slice(-4);
}
