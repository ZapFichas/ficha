import { describe, expect, it } from "vitest";
import {
  calcularIdade,
  ehMenorDeIdade,
  mascararCPF,
  validarCPF,
} from "../src/index.js";

describe("CPF", () => {
  it("valida CPF com dígitos verificadores corretos", () => {
    expect(validarCPF("111.444.777-35")).toBe(true);
    expect(validarCPF("52998224725")).toBe(true);
  });

  it("rejeita CPF inválido, repetido ou incompleto", () => {
    expect(validarCPF("111.444.777-36")).toBe(false);
    expect(validarCPF("111.111.111-11")).toBe(false);
    expect(validarCPF("123")).toBe(false);
    expect(validarCPF("")).toBe(false);
  });

  it("mascara progressivamente", () => {
    expect(mascararCPF("11144477735")).toBe("111.444.777-35");
    expect(mascararCPF("111444")).toBe("111.444");
  });
});

describe("idade", () => {
  it("calcula idade considerando mês e dia", () => {
    expect(calcularIdade("2008-11-06", new Date("2026-11-05T12:00:00"))).toBe(17);
    expect(calcularIdade("2008-11-05", new Date("2026-11-05T12:00:00"))).toBe(18);
  });

  it("identifica menor de idade", () => {
    expect(ehMenorDeIdade("2010-01-01", new Date("2026-11-05T12:00:00"))).toBe(true);
    expect(ehMenorDeIdade("2000-01-01", new Date("2026-11-05T12:00:00"))).toBe(false);
  });

  it("rejeita data impossível", () => {
    expect(calcularIdade("2024-02-31")).toBeNull();
  });
});
