import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PDFDocument } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { gerarPdfFicha } from "../src/services/pdf.js";

const template = JSON.parse(
  readFileSync(resolve("templates/tatuagem.json"), "utf8")
);

// PNG 1x1 transparente — suficiente para exercitar o embed de imagem.
const ASSINATURA_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

describe("geração de PDF", () => {
  it("gera um PDF válido com assinatura e trilha de auditoria", async () => {
    const resultado = await gerarPdfFicha({
      tenant: {
        nome_negocio: "Estúdio Exemplo",
        branding: { cor_primaria: "#4F7963" },
        email_contato: "contato@exemplo.com",
        retencao_anos: 5,
      },
      template,
      ficha: {
        protocolo: "F261105-ABC123",
        cliente_nome: "João da Silva Teste",
        cliente_cpf_ultimos4: "7735",
        timestamp_assinatura: "2026-11-05T14:30:00.000Z",
        ip_assinatura: "203.0.113.10",
        user_agent_assinatura: "Mozilla/5.0 (teste)",
        hash_conteudo: "a".repeat(64),
      },
      dados: {
        nome: "João da Silva Teste",
        data_nascimento: "1990-05-12",
        cpf: "111.444.777-35",
        rg: "1234567",
        telefone: "(61) 98765-4321",
        endereco: "Rua das Flores, 42, Centro, Brasília-DF",
        contato_emergencia: "Maria Silva - (61) 98888-7777",
        tratamento_medico: "Não",
        cirurgia_recente: "Não",
        alergia: "Sim",
        convulsoes: "Não",
        doenca_transmissivel: "Não",
        diabetes: "Não",
        hipertensao: "Não",
        problema_pele: "Não",
        queloide: "Não",
        cicatrizacao: "Não",
        gestante: "Não",
        marcapasso: "Não",
        cancer: "Não",
        detalhamento: "Alergia a látex.",
        alcool_drogas: "Não",
        alimentacao: "Sim",
        local_tatuagem: "Antebraço direito",
        profissional: "Ana Ribeiro",
        estilo: ["Fine line"],
        valor: 350,
        data_procedimento: "2026-11-10",
      },
      consentimentos: [
        {
          tipo: "termo",
          aceito: true,
          timestamp: "2026-11-05T14:30:00.000Z",
          ip: "203.0.113.10",
        },
        {
          tipo: "lgpd",
          aceito: true,
          timestamp: "2026-11-05T14:30:00.000Z",
          ip: "203.0.113.10",
        },
        {
          tipo: "extra:autorizo_imagens",
          aceito: true,
          timestamp: "2026-11-05T14:30:00.000Z",
        },
      ],
      assinaturas: [
        {
          papel: "cliente",
          imagem_base64: ASSINATURA_PNG,
          timestamp: "2026-11-05T14:30:00.000Z",
          ip: "203.0.113.10",
          user_agent: "Mozilla/5.0 (teste)",
          hash_conteudo: "a".repeat(64),
        },
      ],
      anexos: [],
      geradoEm: new Date("2026-11-05T14:31:00.000Z"),
    });

    const texto = Buffer.from(resultado.bytes).toString("latin1");
    expect(texto.startsWith("%PDF-")).toBe(true);
    expect(resultado.bytes.length).toBeGreaterThan(5000);
    expect(resultado.paginas).toBeGreaterThanOrEqual(1);
    expect(resultado.hash).toMatch(/^[a-f0-9]{64}$/);

    const doc = await PDFDocument.load(resultado.bytes);
    expect(doc.getPageCount()).toBe(resultado.paginas);
    expect(doc.getTitle()).toContain("Ficha de Anamnese");
    expect(doc.getAuthor()).toBe("Estúdio Exemplo");
  });
});
