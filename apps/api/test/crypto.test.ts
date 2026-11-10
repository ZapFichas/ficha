import { describe, expect, it } from "vitest";
import {
  base64ParaBytes,
  bytesParaBase64,
} from "@fichapro/shared";
import { criptografarJson, descriptografarJson } from "../src/lib/crypto.js";

function novaChave(): string {
  return bytesParaBase64(crypto.getRandomValues(new Uint8Array(32)));
}

describe("criptografia de dados sensíveis", () => {
  it("faz round-trip de JSON com AES-256-GCM", async () => {
    const chave = novaChave();
    const original = {
      nome: "João",
      cpf: "111.444.777-35",
      saude: { alergia: "Não", observacao: "acentuação ção" },
    };
    const envelope = await criptografarJson(original, chave);
    expect(envelope.startsWith("v1.")).toBe(true);
    expect(envelope).not.toContain("João");
    expect(envelope).not.toContain("111.444");

    const decifrado = await descriptografarJson<typeof original>(envelope, chave);
    expect(decifrado).toEqual(original);
  });

  it("rejeita chave diferente", async () => {
    const envelope = await criptografarJson({ segredo: "x" }, novaChave());
    await expect(descriptografarJson(envelope, novaChave())).rejects.toBeTruthy();
  });

  it("rejeita envelope adulterado", async () => {
    const chave = novaChave();
    const envelope = await criptografarJson({ segredo: "x" }, chave);
    const partes = envelope.split(".");
    const bytes = base64ParaBytes(partes[2]);
    bytes[0] ^= 0xff;
    partes[2] = bytesParaBase64(bytes);
    await expect(descriptografarJson(partes.join("."), chave)).rejects.toBeTruthy();
  });

  it("rejeita chave com tamanho inválido", async () => {
    await expect(
      criptografarJson({ x: 1 }, bytesParaBase64(new Uint8Array(16)))
    ).rejects.toThrow(/32 bytes/);
  });
});
