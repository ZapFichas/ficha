import { describe, expect, it } from "vitest";
import { camposAtivosSchema } from "../src/lib/schemas.js";

describe("campos_ativos", () => {
  it("aceita null (todos os campos)", () => {
    expect(camposAtivosSchema.safeParse(null).success).toBe(true);
  });

  it("aceita lista de ids", () => {
    expect(camposAtivosSchema.safeParse(["nome", "cpf"]).success).toBe(true);
  });

  it("aceita o formato por seção", () => {
    expect(
      camposAtivosSchema.safeParse({
        secoes: [
          { id: "identificacao", campos: ["nome", "cpf"] },
          { id: "saude" },
        ],
      }).success
    ).toBe(true);
  });

  it("rejeita número e objeto sem seções", () => {
    expect(camposAtivosSchema.safeParse(123).success).toBe(false);
    expect(camposAtivosSchema.safeParse({ foo: "bar" }).success).toBe(false);
  });
});
