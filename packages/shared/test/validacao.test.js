import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  montarContexto,
  sanitizarRespostas,
  validarRespostas,
} from "../src/index.js";

const templateTatuagem = JSON.parse(
  readFileSync(resolve("templates/tatuagem.json"), "utf8")
);
const templateFitness = JSON.parse(
  readFileSync(resolve("templates/fitness.json"), "utf8")
);

const baseTatuagem = {
  nome: "João da Silva",
  data_nascimento: "1990-05-12",
  cpf: "111.444.777-35",
  rg: "1234567",
  telefone: "(61) 98765-4321",
  endereco: "Rua das Flores, 42, Centro, Brasília-DF",
  contato_emergencia: "Maria Silva - (61) 98888-7777",
  tratamento_medico: "Não",
  cirurgia_recente: "Não",
  alergia: "Não",
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
  alcool_drogas: "Não",
  alimentacao: "Sim",
  local_tatuagem: "Antebraço direito",
  profissional: "Ana Ribeiro",
  data_procedimento: "2026-11-10",
};

describe("validação por template", () => {
  it("aceita ficha de tatuagem completa para adulto", () => {
    const resultado = validarRespostas(templateTatuagem, baseTatuagem, {
      hoje: new Date("2026-11-05T12:00:00"),
    });
    expect(resultado.valido).toBe(true);
    expect(resultado.erros).toEqual({});
  });

  it("exige CPF válido e campos obrigatórios", () => {
    const resultado = validarRespostas(
      templateTatuagem,
      { ...baseTatuagem, cpf: "111.111.111-11", nome: "" },
      { hoje: new Date("2026-11-05T12:00:00") }
    );
    expect(resultado.valido).toBe(false);
    expect(resultado.erros.cpf).toMatch(/CPF inválido/);
    expect(resultado.erros.nome).toMatch(/obrigatório/);
  });

  it("exige a seção do responsável quando o cliente é menor", () => {
    const dados = { ...baseTatuagem, data_nascimento: "2010-01-01" };
    const resultado = validarRespostas(templateTatuagem, dados, {
      hoje: new Date("2026-11-05T12:00:00"),
    });
    expect(resultado.valido).toBe(false);
    expect(resultado.erros.responsavel_nome).toBeDefined();
    expect(resultado.erros.autorizacao_upload).toBeDefined();

    const ctx = montarContexto(templateTatuagem, dados, new Date("2026-11-05T12:00:00"));
    expect(ctx.menorIdade).toBe(true);
  });

  it("não exige a seção do responsável para adulto", () => {
    const resultado = validarRespostas(templateTatuagem, baseTatuagem, {
      hoje: new Date("2026-11-05T12:00:00"),
    });
    expect(resultado.erros.responsavel_nome).toBeUndefined();
  });

  it("remove campos desconhecidos e de seções ocultas", () => {
    const limpos = sanitizarRespostas(
      templateTatuagem,
      { ...baseTatuagem, campo_inventado: "x", responsavel_nome: "Não deveria" },
      { hoje: new Date("2026-11-05T12:00:00") }
    );
    expect(limpos.campo_inventado).toBeUndefined();
    expect(limpos.responsavel_nome).toBeUndefined();
    expect(limpos.nome).toBe("João da Silva");
  });
});

describe("condicional PAR-Q", () => {
  const baseFitness = {
    nome: "Aluno Teste",
    data_nascimento: "1995-02-10",
    cpf: "529.982.247-25",
    telefone: "(11) 99999-8888",
    contato_emergencia: "Contato - (11) 99999-7777",
    parq_cardiaco: "Não",
    parq_dor_peito: "Não",
    parq_tontura: "Não",
    parq_osseo: "Não",
    parq_pressao: "Não",
    parq_outra_razao: "Não",
    parq_gestante: "Não",
    objetivo: ["Condicionamento"],
    nivel_atividade: "Leve (1-2x/semana)",
    profissional: "Rafael Costa",
    data_inicio: "2026-11-10",
    frequencia_semanal: "3x",
  };

  it("não exige liberação médica quando o PAR-Q é negativo", () => {
    const resultado = validarRespostas(templateFitness, baseFitness, {
      hoje: new Date("2026-11-05T12:00:00"),
    });
    expect(resultado.erros.liberacao_medica).toBeUndefined();
    expect(resultado.valido).toBe(true);
  });

  it("exige liberação médica quando qualquer PAR-Q é Sim", () => {
    const resultado = validarRespostas(
      templateFitness,
      { ...baseFitness, parq_cardiaco: "Sim" },
      { hoje: new Date("2026-11-05T12:00:00") }
    );
    expect(resultado.valido).toBe(false);
    expect(resultado.erros.liberacao_medica).toMatch(/obrigatório/);
  });
});
