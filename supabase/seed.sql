-- GERADO AUTOMATICAMENTE por scripts/build-seed.mjs
-- Não edite à mão. Altere templates/*.json e rode: npm run templates:seed
begin;

insert into public.templates
  (nicho_slug, nome, nome_comercial, dominio, publico, dor_principal,
   campos_json, termo_texto, consentimento_lgpd, landing_copy, versao, ativo)
values
  ($txt$estetica$txt$, $txt$Ficha de Anamnese e Termo de Consentimento — Estética$txt$, $txt$FichaPro Estética$txt$, $txt$fichadeestetica.com.br$txt$,
   $txt$Clínicas de estética e profissionais de procedimentos estéticos$txt$, $txt$Anamnese incompleta, termo genérico, fotos antes/depois desorganizadas e risco de intercorrência sem registro.$txt$,
   $json${
  "secoes": [
    {
      "id": "identificacao",
      "titulo": "Dados de identificação",
      "rotulo_curto": "Dados",
      "descricao": "Informações pessoais da cliente para registro do atendimento.",
      "campos": [
        {
          "id": "nome",
          "label": "Nome completo",
          "tipo": "text",
          "obrigatorio": true,
          "min": 3,
          "max": 120,
          "autocomplete": "name"
        },
        {
          "id": "data_nascimento",
          "label": "Data de nascimento",
          "tipo": "date",
          "obrigatorio": true,
          "regra": "data_passada"
        },
        {
          "id": "cpf",
          "label": "CPF",
          "tipo": "cpf",
          "obrigatorio": true,
          "placeholder": "000.000.000-00"
        },
        {
          "id": "rg",
          "label": "RG / documento",
          "tipo": "text",
          "obrigatorio": true,
          "max": 30
        },
        {
          "id": "telefone",
          "label": "Telefone / WhatsApp",
          "tipo": "tel",
          "obrigatorio": true,
          "autocomplete": "tel"
        },
        {
          "id": "email",
          "label": "E-mail",
          "tipo": "email",
          "obrigatorio": false,
          "autocomplete": "email"
        },
        {
          "id": "endereco",
          "label": "Endereço completo",
          "tipo": "textarea",
          "obrigatorio": true,
          "min": 10,
          "max": 300
        },
        {
          "id": "contato_emergencia",
          "label": "Contato de emergência",
          "tipo": "text",
          "obrigatorio": true,
          "max": 160
        },
        {
          "id": "documento",
          "label": "Documento de identificação com foto",
          "tipo": "upload",
          "obrigatorio": false,
          "max_mb": 10,
          "aceita": [
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/pdf"
          ]
        }
      ]
    },
    {
      "id": "saude",
      "titulo": "Histórico de saúde",
      "rotulo_curto": "Saúde",
      "descricao": "Algumas condições e medicamentos contraindicam ou exigem adaptação do procedimento.",
      "layout": "grade",
      "campos": [
        {
          "id": "tratamento_medico",
          "label": "Está em tratamento médico?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "gestante",
          "label": "Está gestante?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "lactante",
          "label": "Está amamentando?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "alergia_anestesico",
          "label": "Alergia a anestésico ou lidocaína?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "alergia_latex",
          "label": "Alergia a látex?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "herpes_recorrente",
          "label": "Herpes labial recorrente?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "diabetes",
          "label": "Diabetes?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "hipertensao",
          "label": "Hipertensão?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "anticoagulante",
          "label": "Usa anticoagulante ou antiagregante?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "isotretinoina",
          "label": "Usou isotretinoína nos últimos 6 meses?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "fotossensibilidade",
          "label": "Tem fotossensibilidade ou usa medicamento fotossensibilizante?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "imunossupressao",
          "label": "Imunidade baixa ou uso de imunossupressor?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "cancer",
          "label": "Já teve ou trata câncer?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "queloide",
          "label": "Histórico de queloide?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "problema_pele",
          "label": "Problema de pele ativo na área?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "epilepsia",
          "label": "Epilepsia ou convulsões?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "detalhamento",
          "label": "Detalhamento",
          "tipo": "textarea",
          "obrigatorio": false,
          "placeholder": "Descreva condições, medicamentos em uso, cirurgias e alergias.",
          "max": 800
        }
      ]
    },
    {
      "id": "procedimento",
      "titulo": "Procedimento",
      "rotulo_curto": "Procedimento",
      "descricao": "Dados do procedimento estético a ser realizado.",
      "campos": [
        {
          "id": "procedimentos",
          "label": "Procedimentos",
          "tipo": "checkbox",
          "obrigatorio": true,
          "opcoes": [
            "Toxina botulínica",
            "Preenchimento com ácido hialurônico",
            "Bioestimulador de colágeno",
            "Laser / IPL",
            "Peeling químico",
            "Microagulhamento",
            "Limpeza de pele",
            "Outro"
          ]
        },
        {
          "id": "areas_tratadas",
          "label": "Áreas tratadas",
          "tipo": "text",
          "obrigatorio": true,
          "placeholder": "Ex.: terço superior da face, região periorbital",
          "max": 200
        },
        {
          "id": "profissional",
          "label": "Profissional responsável",
          "tipo": "select",
          "obrigatorio": true,
          "opcoes_fonte": "profissionais"
        },
        {
          "id": "data_procedimento",
          "label": "Data do procedimento",
          "tipo": "date",
          "obrigatorio": true
        },
        {
          "id": "valor",
          "label": "Valor do procedimento (R$)",
          "tipo": "number",
          "obrigatorio": false,
          "min": 0
        },
        {
          "id": "foto_antes",
          "label": "Foto antes do procedimento",
          "tipo": "upload",
          "obrigatorio": false,
          "hint": "Opcional. A foto é comprimida no celular antes do envio.",
          "max_mb": 15,
          "aceita": [
            "image/jpeg",
            "image/png",
            "image/webp"
          ]
        },
        {
          "id": "observacoes",
          "label": "Observações e expectativas",
          "tipo": "textarea",
          "obrigatorio": false,
          "placeholder": "Expectativas da cliente, histórico de procedimentos e orientações.",
          "max": 800
        }
      ]
    },
    {
      "id": "responsavel_menor",
      "titulo": "Autorização do responsável legal",
      "rotulo_curto": "Responsável",
      "descricao": "Obrigatório para clientes menores de 18 anos.",
      "condicional": {
        "tipo": "menor_idade"
      },
      "campos": [
        {
          "id": "responsavel_nome",
          "label": "Nome completo do responsável",
          "tipo": "text",
          "obrigatorio": true,
          "max": 120
        },
        {
          "id": "responsavel_cpf",
          "label": "CPF do responsável",
          "tipo": "cpf",
          "obrigatorio": true
        },
        {
          "id": "responsavel_rg",
          "label": "RG / documento do responsável",
          "tipo": "text",
          "obrigatorio": true,
          "max": 30
        },
        {
          "id": "parentesco",
          "label": "Parentesco",
          "tipo": "select",
          "obrigatorio": true,
          "opcoes": [
            "Mãe",
            "Pai",
            "Tutor(a) legal",
            "Avó / Avô",
            "Outro"
          ]
        },
        {
          "id": "responsavel_telefone",
          "label": "Telefone do responsável",
          "tipo": "tel",
          "obrigatorio": true
        },
        {
          "id": "responsavel_presente",
          "label": "O responsável está presente no local?",
          "tipo": "sim_nao",
          "obrigatorio": true
        },
        {
          "id": "autorizacao_upload",
          "label": "Autorização assinada + documento com foto",
          "tipo": "upload",
          "obrigatorio": true,
          "max_mb": 10,
          "aceita": [
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/pdf"
          ]
        }
      ]
    }
  ],
  "consentimentos_extras": [
    {
      "id": "autorizo_imagens",
      "label": "Autorizo o registro fotográfico antes, durante e depois para documentação clínica. Autorizo também o uso das imagens no portfólio do estabelecimento.",
      "obrigatorio": false
    },
    {
      "id": "ciencia_resultados",
      "label": "Estou ciente de que os resultados variam conforme a resposta individual e não há garantia de resultado idêntico ao de fotos ou exemplos.",
      "obrigatorio": true
    }
  ]
}$json$::jsonb, $txt$Eu autorizo a realização do procedimento estético descrito nesta ficha, executado por profissional habilitado, e declaro que recebi informações claras sobre o procedimento, seus benefícios, limitações, riscos e cuidados.

Estou ciente de que podem ocorrer efeitos esperados e adversos, incluindo dor, edema, equimose, vermelhidão, sensibilidade, hematomas, infecção, reação alérgica, hiperpigmentação, hipopigmentação, assimetria, nódulos, necrose, cicatrizes e, em procedimentos com laser ou peelings, alterações temporárias de textura e cor da pele. Sei que resultados variam de pessoa para pessoa e que podem ser necessárias sessões adicionais.

Comprometo-me a seguir as orientações de cuidado, incluindo fotoproteção, hidratação, evitar exposição solar, calor e atividades intensas pelo período indicado, e a retornar para avaliação conforme combinado. Comprometo-me a informar imediatamente qualquer sinal de complicação.

Declaro que forneci informações verdadeiras sobre minha saúde, medicamentos, alergias e procedimentos anteriores. Se eu for menor de 18 anos, declaro que estou acompanhada do responsável legal, que autoriza o procedimento e assina este documento.

Reconheço a validade da assinatura eletrônica como manifestação de vontade, com trilha de auditoria contendo hash do conteúdo, data e hora, IP e dispositivo.$txt$, $txt$Li e concordo com o tratamento dos meus dados pessoais e dados sensíveis de saúde, incluindo imagens clínicas, nos termos da LGPD (Lei 13.709/2018), para fins de registro do atendimento, acompanhamento, cumprimento de obrigações legais e exercício regular de direitos.

Os dados serão armazenados por até {{retencao_anos}} anos, ou pelo prazo legal aplicável, e poderei solicitar acesso, correção ou exclusão pelo e-mail {{email_contato}}. A exclusão pode ser limitada por obrigação legal de guarda. As imagens serão usadas apenas para as finalidades informadas e não serão compartilhadas com terceiros sem consentimento, salvo obrigação legal.$txt$,
   $json${
  "headline": "Ficha de anamnese digital para clínicas de estética",
  "subheadline": "Termo, foto antes/depois e assinatura em um fluxo só. O PDF chega organizado no seu Drive.",
  "cta_primario": "Testar grátis por 7 dias",
  "cta_secundario": "Ver demonstração",
  "secoes": [
    "Problema: anamnese incompleta e termo genérico",
    "Solução: ficha no celular, termo por procedimento e PDF organizado",
    "Diferenciais: foto antes/depois, autorização de imagem e trilha de assinatura",
    "Planos e preços",
    "Perguntas frequentes"
  ],
  "seo_keywords": [
    "ficha de anamnese estética",
    "termo de consentimento estética",
    "ficha digital clínica de estética",
    "anamnese botox preenchimento"
  ],
  "faq": [
    {
      "pergunta": "O termo serve para botox e preenchimento?",
      "resposta": "Sim. O template cobre os procedimentos mais comuns e você pode ativar os campos que usa."
    },
    {
      "pergunta": "Consigo anexar a foto antes do procedimento?",
      "resposta": "Sim. A cliente ou o profissional pode enviar a foto, que é comprimida e anexada ao registro."
    },
    {
      "pergunta": "A cliente assina no celular?",
      "resposta": "Sim. A assinatura é capturada na tela e vinculada à trilha de auditoria da ficha."
    },
    {
      "pergunta": "Posso personalizar o termo?",
      "resposta": "Você escolhe o template e pode adaptar os campos ativos no painel, sem código."
    },
    {
      "pergunta": "Onde ficam as fichas?",
      "resposta": "Na sua conta do Google Drive, organizadas por profissional, mês e cliente."
    }
  ]
}$json$::jsonb, 1, true)
on conflict (nicho_slug) do update set
  nome = excluded.nome,
  nome_comercial = excluded.nome_comercial,
  dominio = excluded.dominio,
  publico = excluded.publico,
  dor_principal = excluded.dor_principal,
  campos_json = excluded.campos_json,
  termo_texto = excluded.termo_texto,
  consentimento_lgpd = excluded.consentimento_lgpd,
  landing_copy = excluded.landing_copy,
  versao = excluded.versao,
  ativo = excluded.ativo,
  atualizado_em = now();

insert into public.templates
  (nicho_slug, nome, nome_comercial, dominio, publico, dor_principal,
   campos_json, termo_texto, consentimento_lgpd, landing_copy, versao, ativo)
values
  ($txt$fitness$txt$, $txt$Anamnese, PAR-Q e Termo de Responsabilidade — Treinamento$txt$, $txt$FichaPro Fitness$txt$, $txt$fichadepersonal.com.br$txt$,
   $txt$Personal trainers, estúdios de treinamento e nutricionistas$txt$, $txt$PAR-Q em papel, aluno sem liberação médica registrada e termo de responsabilidade frágil.$txt$,
   $json${
  "secoes": [
    {
      "id": "identificacao",
      "titulo": "Dados de identificação",
      "rotulo_curto": "Dados",
      "descricao": "Informações do aluno para o registro do acompanhamento.",
      "campos": [
        {
          "id": "nome",
          "label": "Nome completo",
          "tipo": "text",
          "obrigatorio": true,
          "min": 3,
          "max": 120,
          "autocomplete": "name"
        },
        {
          "id": "data_nascimento",
          "label": "Data de nascimento",
          "tipo": "date",
          "obrigatorio": true,
          "regra": "data_passada"
        },
        {
          "id": "cpf",
          "label": "CPF",
          "tipo": "cpf",
          "obrigatorio": true,
          "placeholder": "000.000.000-00"
        },
        {
          "id": "rg",
          "label": "RG / documento",
          "tipo": "text",
          "obrigatorio": false,
          "max": 30
        },
        {
          "id": "telefone",
          "label": "Telefone / WhatsApp",
          "tipo": "tel",
          "obrigatorio": true,
          "autocomplete": "tel"
        },
        {
          "id": "email",
          "label": "E-mail",
          "tipo": "email",
          "obrigatorio": false,
          "autocomplete": "email"
        },
        {
          "id": "endereco",
          "label": "Endereço",
          "tipo": "textarea",
          "obrigatorio": false,
          "max": 300
        },
        {
          "id": "contato_emergencia",
          "label": "Contato de emergência",
          "tipo": "text",
          "obrigatorio": true,
          "placeholder": "Nome e telefone",
          "max": 160
        },
        {
          "id": "documento",
          "label": "Documento de identificação",
          "tipo": "upload",
          "obrigatorio": false,
          "max_mb": 10,
          "aceita": [
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/pdf"
          ]
        }
      ]
    },
    {
      "id": "parq",
      "titulo": "Triagem PAR-Q",
      "rotulo_curto": "PAR-Q",
      "descricao": "Responda com sinceridade. Qualquer resposta “Sim” exige liberação médica antes do treino.",
      "layout": "grade",
      "campos": [
        {
          "id": "parq_cardiaco",
          "label": "Algum médico já disse que você tem problema cardíaco?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true,
          "parq": true
        },
        {
          "id": "parq_dor_peito",
          "label": "Sente dor no peito durante exercício?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true,
          "parq": true
        },
        {
          "id": "parq_tontura",
          "label": "Sente tontura, desmaio ou perda de equilíbrio?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true,
          "parq": true
        },
        {
          "id": "parq_osseo",
          "label": "Tem problema ósseo, articular ou de coluna que possa piorar?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true,
          "parq": true
        },
        {
          "id": "parq_pressao",
          "label": "Toma medicamento para pressão arterial ou coração?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true,
          "parq": true
        },
        {
          "id": "parq_outra_razao",
          "label": "Existe outra razão médica para não praticar exercício?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true,
          "parq": true
        },
        {
          "id": "parq_gestante",
          "label": "Está gestante ou amamentando?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true,
          "parq": true
        },
        {
          "id": "liberacao_medica",
          "label": "Liberação médica",
          "tipo": "upload",
          "obrigatorio": true,
          "hint": "Obrigatória quando qualquer resposta do PAR-Q for “Sim”. Anexe o atestado ou liberação médica.",
          "max_mb": 10,
          "aceita": [
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/pdf"
          ],
          "condicional": {
            "tipo": "parq_positivo"
          }
        },
        {
          "id": "parq_detalhamento",
          "label": "Detalhamento das respostas “Sim”",
          "tipo": "textarea",
          "obrigatorio": false,
          "placeholder": "Descreva a condição, o medicamento e a orientação médica recebida.",
          "max": 800
        }
      ]
    },
    {
      "id": "saude",
      "titulo": "Histórico e objetivos",
      "rotulo_curto": "Histórico",
      "descricao": "Informações para personalizar o treino com segurança.",
      "campos": [
        {
          "id": "objetivo",
          "label": "Objetivo principal",
          "tipo": "checkbox",
          "obrigatorio": true,
          "opcoes": [
            "Emagrecimento",
            "Hipertrofia",
            "Condicionamento",
            "Reabilitação",
            "Saúde e bem-estar",
            "Performance esportiva"
          ]
        },
        {
          "id": "nivel_atividade",
          "label": "Nível de atividade atual",
          "tipo": "select",
          "obrigatorio": true,
          "opcoes": [
            "Sedentário",
            "Leve (1-2x/semana)",
            "Moderado (3-4x/semana)",
            "Intenso (5x ou mais)"
          ]
        },
        {
          "id": "peso",
          "label": "Peso (kg)",
          "tipo": "number",
          "obrigatorio": false,
          "min": 20,
          "max": 400
        },
        {
          "id": "altura",
          "label": "Altura (cm)",
          "tipo": "number",
          "obrigatorio": false,
          "min": 80,
          "max": 260
        },
        {
          "id": "circunferencia_cintura",
          "label": "Circunferência da cintura (cm)",
          "tipo": "number",
          "obrigatorio": false,
          "min": 30,
          "max": 250
        },
        {
          "id": "restricoes",
          "label": "Restrições ou lesões",
          "tipo": "textarea",
          "obrigatorio": false,
          "placeholder": "Lesões, dores, cirurgias, limitações de movimento.",
          "max": 800
        },
        {
          "id": "medicamentos",
          "label": "Medicamentos em uso",
          "tipo": "textarea",
          "obrigatorio": false,
          "max": 600
        },
        {
          "id": "fumante",
          "label": "Fuma?",
          "tipo": "sim_nao",
          "obrigatorio": false
        },
        {
          "id": "alcool",
          "label": "Consome bebida alcoólica com frequência?",
          "tipo": "sim_nao",
          "obrigatorio": false
        }
      ]
    },
    {
      "id": "acompanhamento",
      "titulo": "Acompanhamento",
      "rotulo_curto": "Treino",
      "descricao": "Dados do plano e do profissional responsável.",
      "campos": [
        {
          "id": "profissional",
          "label": "Profissional responsável",
          "tipo": "select",
          "obrigatorio": true,
          "opcoes_fonte": "profissionais"
        },
        {
          "id": "data_inicio",
          "label": "Data de início",
          "tipo": "date",
          "obrigatorio": true
        },
        {
          "id": "frequencia_semanal",
          "label": "Frequência semanal",
          "tipo": "select",
          "obrigatorio": true,
          "opcoes": [
            "1x",
            "2x",
            "3x",
            "4x",
            "5x",
            "6x ou mais"
          ]
        },
        {
          "id": "valor",
          "label": "Valor do acompanhamento (R$)",
          "tipo": "number",
          "obrigatorio": false,
          "min": 0
        },
        {
          "id": "observacoes",
          "label": "Observações",
          "tipo": "textarea",
          "obrigatorio": false,
          "max": 600
        }
      ]
    },
    {
      "id": "responsavel_menor",
      "titulo": "Autorização do responsável legal",
      "rotulo_curto": "Responsável",
      "descricao": "Obrigatório para alunos menores de 18 anos.",
      "condicional": {
        "tipo": "menor_idade"
      },
      "campos": [
        {
          "id": "responsavel_nome",
          "label": "Nome completo do responsável",
          "tipo": "text",
          "obrigatorio": true,
          "max": 120
        },
        {
          "id": "responsavel_cpf",
          "label": "CPF do responsável",
          "tipo": "cpf",
          "obrigatorio": true
        },
        {
          "id": "responsavel_rg",
          "label": "RG / documento do responsável",
          "tipo": "text",
          "obrigatorio": true,
          "max": 30
        },
        {
          "id": "parentesco",
          "label": "Parentesco",
          "tipo": "select",
          "obrigatorio": true,
          "opcoes": [
            "Mãe",
            "Pai",
            "Tutor(a) legal",
            "Avó / Avô",
            "Outro"
          ]
        },
        {
          "id": "responsavel_telefone",
          "label": "Telefone do responsável",
          "tipo": "tel",
          "obrigatorio": true
        },
        {
          "id": "responsavel_presente",
          "label": "O responsável está presente no local?",
          "tipo": "sim_nao",
          "obrigatorio": true
        },
        {
          "id": "autorizacao_upload",
          "label": "Autorização assinada + documento com foto",
          "tipo": "upload",
          "obrigatorio": true,
          "max_mb": 10,
          "aceita": [
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/pdf"
          ]
        }
      ]
    }
  ],
  "consentimentos_extras": [
    {
      "id": "ciencia_nao_medico",
      "label": "Estou ciente de que a avaliação e o treinamento não substituem consulta, diagnóstico ou tratamento médico.",
      "obrigatorio": true
    },
    {
      "id": "autorizo_imagens",
      "label": "Autorizo o registro fotográfico da evolução física para acompanhamento e portfólio do profissional.",
      "obrigatorio": false
    }
  ]
}$json$::jsonb, $txt$Eu declaro que as informações fornecidas nesta anamnese e no PAR-Q são verdadeiras e completas, e que informei ao profissional todas as condições de saúde, lesões, medicamentos e restrições conhecidas.

Estou ciente de que a prática de exercício físico envolve riscos, incluindo lesões musculares, articulares e cardiovasculares, e que a avaliação realizada não substitui consulta, diagnóstico ou tratamento médico. Comprometo-me a interromper o exercício e procurar orientação se sentir dor no peito, tontura, falta de ar anormal, desmaio ou qualquer sinal de mal-estar.

Comprometo-me a seguir as orientações do profissional, respeitar meus limites e comunicar qualquer mudança no meu estado de saúde. Se qualquer resposta do PAR-Q for “Sim”, declaro que apresentei liberação médica antes de iniciar o treinamento.

Se eu for menor de 18 anos, declaro que estou acompanhado(a) do responsável legal, que autoriza a prática de exercícios e assina este documento.

Reconheço a validade da assinatura eletrônica como manifestação de vontade, com trilha de auditoria contendo hash do conteúdo, data e hora, IP e dispositivo.$txt$, $txt$Li e concordo com o tratamento dos meus dados pessoais e dados sensíveis de saúde, nos termos da LGPD (Lei 13.709/2018), para fins de avaliação, prescrição e acompanhamento do treinamento, cumprimento de obrigações legais e exercício regular de direitos.

Os dados serão armazenados por até {{retencao_anos}} anos, ou pelo prazo legal aplicável, e poderei solicitar acesso, correção ou exclusão pelo e-mail {{email_contato}}. A exclusão pode ser limitada por obrigação legal de guarda. Imagens e documentos serão usados apenas para as finalidades informadas e não serão compartilhados com terceiros sem consentimento, salvo obrigação legal.$txt$,
   $json${
  "headline": "PAR-Q e anamnese digital para personal trainers",
  "subheadline": "O aluno preenche e assina no celular. Você recebe o PDF organizado, com liberação médica quando necessário.",
  "cta_primario": "Testar grátis por 7 dias",
  "cta_secundario": "Ver demonstração",
  "secoes": [
    "Problema: PAR-Q em papel e termo frágil",
    "Solução: ficha no celular, PAR-Q automático e PDF no Drive",
    "Diferenciais: liberação médica condicional e assinatura com trilha",
    "Planos e preços",
    "Perguntas frequentes"
  ],
  "seo_keywords": [
    "ficha de anamnese personal trainer",
    "PAR-Q digital",
    "termo de responsabilidade academia",
    "anamnese fitness pdf"
  ],
  "faq": [
    {
      "pergunta": "O que acontece se o aluno responder “Sim” no PAR-Q?",
      "resposta": "O sistema exibe e exige o envio da liberação médica antes de concluir a ficha."
    },
    {
      "pergunta": "Serve para nutricionistas?",
      "resposta": "Sim. Você pode adaptar os campos ativos no painel para avaliação nutricional."
    },
    {
      "pergunta": "O aluno assina no celular?",
      "resposta": "Sim. A assinatura é capturada na tela e vinculada ao hash do conteúdo."
    },
    {
      "pergunta": "Posso registrar medidas e evolução?",
      "resposta": "Sim. Peso, altura e circunferência podem ser ativados no template e aparecem no PDF."
    },
    {
      "pergunta": "Onde ficam as fichas?",
      "resposta": "Na sua conta do Google Drive, organizadas por profissional, mês e aluno."
    }
  ]
}$json$::jsonb, 1, true)
on conflict (nicho_slug) do update set
  nome = excluded.nome,
  nome_comercial = excluded.nome_comercial,
  dominio = excluded.dominio,
  publico = excluded.publico,
  dor_principal = excluded.dor_principal,
  campos_json = excluded.campos_json,
  termo_texto = excluded.termo_texto,
  consentimento_lgpd = excluded.consentimento_lgpd,
  landing_copy = excluded.landing_copy,
  versao = excluded.versao,
  ativo = excluded.ativo,
  atualizado_em = now();

insert into public.templates
  (nicho_slug, nome, nome_comercial, dominio, publico, dor_principal,
   campos_json, termo_texto, consentimento_lgpd, landing_copy, versao, ativo)
values
  ($txt$piercing$txt$, $txt$Ficha de Anamnese e Termo de Consentimento — Piercing$txt$, $txt$FichaPro Piercing$txt$, $txt$fichadepiercing.com.br$txt$,
   $txt$Estúdios de piercing e micropigmentação$txt$, $txt$Ficha em papel, termo desatualizado, autorização de menor perdida e falta de histórico do cliente.$txt$,
   $json${
  "secoes": [
    {
      "id": "identificacao",
      "titulo": "Dados de identificação",
      "rotulo_curto": "Dados",
      "descricao": "Informações pessoais do cliente para registro do procedimento.",
      "campos": [
        {
          "id": "nome",
          "label": "Nome completo",
          "tipo": "text",
          "obrigatorio": true,
          "min": 3,
          "max": 120,
          "autocomplete": "name"
        },
        {
          "id": "data_nascimento",
          "label": "Data de nascimento",
          "tipo": "date",
          "obrigatorio": true,
          "regra": "data_passada"
        },
        {
          "id": "cpf",
          "label": "CPF",
          "tipo": "cpf",
          "obrigatorio": true,
          "placeholder": "000.000.000-00"
        },
        {
          "id": "rg",
          "label": "RG / documento",
          "tipo": "text",
          "obrigatorio": true,
          "max": 30
        },
        {
          "id": "telefone",
          "label": "Telefone / WhatsApp",
          "tipo": "tel",
          "obrigatorio": true,
          "placeholder": "(00) 00000-0000",
          "autocomplete": "tel"
        },
        {
          "id": "email",
          "label": "E-mail",
          "tipo": "email",
          "obrigatorio": false,
          "autocomplete": "email"
        },
        {
          "id": "endereco",
          "label": "Endereço completo",
          "tipo": "textarea",
          "obrigatorio": true,
          "min": 10,
          "max": 300
        },
        {
          "id": "contato_emergencia",
          "label": "Contato de emergência",
          "tipo": "text",
          "obrigatorio": true,
          "placeholder": "Nome e telefone",
          "max": 160
        },
        {
          "id": "documento",
          "label": "Documento de identificação com foto",
          "tipo": "upload",
          "obrigatorio": false,
          "max_mb": 10,
          "aceita": [
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/pdf"
          ]
        }
      ]
    },
    {
      "id": "saude",
      "titulo": "Histórico de saúde",
      "rotulo_curto": "Saúde",
      "descricao": "Algumas condições aumentam o risco de complicações na perfuração. Responda com sinceridade.",
      "layout": "grade",
      "campos": [
        {
          "id": "tratamento_medico",
          "label": "Está em tratamento médico?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "alergia_metal",
          "label": "Alergia a metal (níquel, aço, prata)?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "alergia_latex",
          "label": "Alergia a látex ou anestésico?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "diabetes",
          "label": "Diabetes?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "hemofilia",
          "label": "Problema de coagulação ou hemofilia?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "anticoagulante",
          "label": "Usa anticoagulante ou antiagregante?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "imunossupressao",
          "label": "Tem imunidade baixa ou usa imunossupressor?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "cardio_congenita",
          "label": "Doença cardíaca congênita ou válvula artificial?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "epilepsia",
          "label": "Epilepsia ou convulsões?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "problema_pele",
          "label": "Problema de pele ativo no local?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "queloide",
          "label": "Histórico de queloide?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "gestante",
          "label": "Está gestante ou amamentando?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "alcool_drogas",
          "label": "Sob efeito de álcool ou drogas?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "alimentacao",
          "label": "Alimentou-se nas últimas 12 horas?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true
        },
        {
          "id": "detalhamento",
          "label": "Detalhamento",
          "tipo": "textarea",
          "obrigatorio": false,
          "placeholder": "Descreva condições, medicamentos e alergias que o profissional deve saber.",
          "max": 800
        }
      ]
    },
    {
      "id": "procedimento",
      "titulo": "Detalhes do procedimento",
      "rotulo_curto": "Procedimento",
      "descricao": "Dados da perfuração e da joia utilizada.",
      "campos": [
        {
          "id": "local_piercing",
          "label": "Local da perfuração",
          "tipo": "checkbox",
          "obrigatorio": true,
          "opcoes": [
            "Lóbulo",
            "Hélice",
            "Tragus",
            "Septo",
            "Narina",
            "Sobrancelha",
            "Língua",
            "Umbigo",
            "Mamilo",
            "Outro"
          ]
        },
        {
          "id": "lado",
          "label": "Lado",
          "tipo": "select",
          "obrigatorio": true,
          "opcoes": [
            "Direito",
            "Esquerdo",
            "Central",
            "Ambos"
          ]
        },
        {
          "id": "primeira_perfuracao",
          "label": "É a primeira perfuração neste local?",
          "tipo": "sim_nao",
          "obrigatorio": true
        },
        {
          "id": "joia_material",
          "label": "Material da joia",
          "tipo": "select",
          "obrigatorio": true,
          "opcoes": [
            "Titânio grau implante",
            "Aço cirúrgico",
            "Nióbio",
            "Ouro 18k",
            "Outro"
          ]
        },
        {
          "id": "joia_modelo",
          "label": "Modelo / tamanho da joia",
          "tipo": "text",
          "obrigatorio": false,
          "placeholder": "Ex.: argola 8 mm, 1,2 mm de espessura",
          "max": 120
        },
        {
          "id": "profissional",
          "label": "Profissional responsável",
          "tipo": "select",
          "obrigatorio": true,
          "opcoes_fonte": "profissionais"
        },
        {
          "id": "data_procedimento",
          "label": "Data do procedimento",
          "tipo": "date",
          "obrigatorio": true
        },
        {
          "id": "valor",
          "label": "Valor do procedimento (R$)",
          "tipo": "number",
          "obrigatorio": false,
          "min": 0
        },
        {
          "id": "observacoes",
          "label": "Observações",
          "tipo": "textarea",
          "obrigatorio": false,
          "max": 600
        }
      ]
    },
    {
      "id": "responsavel_menor",
      "titulo": "Autorização do responsável legal",
      "rotulo_curto": "Responsável",
      "descricao": "Obrigatório para clientes menores de 18 anos. O responsável deve estar presente e apresentar documento.",
      "condicional": {
        "tipo": "menor_idade"
      },
      "campos": [
        {
          "id": "responsavel_nome",
          "label": "Nome completo do responsável",
          "tipo": "text",
          "obrigatorio": true,
          "max": 120
        },
        {
          "id": "responsavel_cpf",
          "label": "CPF do responsável",
          "tipo": "cpf",
          "obrigatorio": true
        },
        {
          "id": "responsavel_rg",
          "label": "RG / documento do responsável",
          "tipo": "text",
          "obrigatorio": true,
          "max": 30
        },
        {
          "id": "parentesco",
          "label": "Parentesco",
          "tipo": "select",
          "obrigatorio": true,
          "opcoes": [
            "Mãe",
            "Pai",
            "Tutor(a) legal",
            "Avó / Avô",
            "Outro"
          ]
        },
        {
          "id": "responsavel_telefone",
          "label": "Telefone do responsável",
          "tipo": "tel",
          "obrigatorio": true
        },
        {
          "id": "responsavel_presente",
          "label": "O responsável está presente no local?",
          "tipo": "sim_nao",
          "obrigatorio": true
        },
        {
          "id": "autorizacao_upload",
          "label": "Autorização assinada + documento com foto",
          "tipo": "upload",
          "obrigatorio": true,
          "max_mb": 10,
          "aceita": [
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/pdf"
          ]
        }
      ]
    }
  ],
  "consentimentos_extras": [
    {
      "id": "autorizo_imagens",
      "label": "Autorizo o registro fotográfico da perfuração para documentação do procedimento e portfólio do estúdio.",
      "obrigatorio": true
    }
  ]
}$json$::jsonb, $txt$Eu autorizo a realização da perfuração corporal descrita nesta ficha, bem como a colocação da joia indicada. Declaro que recebi orientações sobre o procedimento, os riscos e os cuidados de cicatrização.

Estou ciente de que a perfuração é um procedimento invasivo e pode apresentar complicações como dor, edema, sangramento, infecção, rejeição, migração da joia, queloides, cicatrizes e reação alérgica ao metal. Sei que a cicatrização varia de pessoa para pessoa e que o tempo estimado pode não ser cumprido.

Comprometo-me a higienizar a região conforme orientação, não manusear a joia com as mãos sujas, não trocar a joia antes do prazo indicado e procurar atendimento médico em caso de sinais de infecção, febre ou dor intensa. Estou ciente de que a remoção da joia pode deixar cicatriz permanente.

Declaro que as informações de saúde fornecidas são verdadeiras e completas. Se eu for menor de 18 anos, declaro que estou acompanhado(a) do responsável legal, que autoriza a realização do procedimento e assina este documento.

Reconheço a validade da assinatura eletrônica como manifestação de vontade, com trilha de auditoria contendo hash do conteúdo, data e hora, IP e dispositivo.$txt$, $txt$Li e concordo com o tratamento dos meus dados pessoais e dados sensíveis de saúde, nos termos da LGPD (Lei 13.709/2018), para registro do procedimento, cumprimento de obrigações legais e exercício regular de direitos.

Os dados serão armazenados por até {{retencao_anos}} anos, ou pelo prazo legal aplicável, e poderei solicitar acesso, correção ou exclusão pelo e-mail {{email_contato}}. A exclusão pode ser limitada por obrigação legal de guarda. Documentos e imagens serão usados apenas para as finalidades informadas e não serão compartilhados com terceiros sem consentimento, salvo obrigação legal.$txt$,
   $json${
  "headline": "Ficha digital de piercing com autorização de menor inclusa",
  "subheadline": "O cliente preenche no celular, assina e o PDF cai organizado no seu Drive. Menos papel, mais segurança.",
  "cta_primario": "Testar grátis por 7 dias",
  "cta_secundario": "Ver demonstração",
  "secoes": [
    "Problema: fichas em papel e autorizações perdidas",
    "Solução: QR code, ficha no celular e PDF no Drive",
    "Diferenciais: termo específico para piercing e fluxo de menor",
    "Planos e preços",
    "Perguntas frequentes"
  ],
  "seo_keywords": [
    "ficha de anamnese piercing",
    "termo de consentimento piercing",
    "ficha digital piercing",
    "autorização menor piercing"
  ],
  "faq": [
    {
      "pergunta": "A ficha serve para micropigmentação?",
      "resposta": "Sim. Você pode ativar ou desativar campos no painel e adaptar o procedimento para micropigmentação."
    },
    {
      "pergunta": "Como funciona a autorização para menor de idade?",
      "resposta": "A ficha calcula a idade e libera a seção do responsável legal, com CPF, parentesco, documento e assinatura do responsável."
    },
    {
      "pergunta": "O termo é específico para piercing?",
      "resposta": "Sim. Ele cobre riscos como rejeição, migração, infecção e reação alérgica ao metal."
    },
    {
      "pergunta": "O cliente precisa baixar aplicativo?",
      "resposta": "Não. A ficha abre direto no navegador do celular."
    },
    {
      "pergunta": "Posso usar a minha logo?",
      "resposta": "Sim. A ficha e o PDF saem com a identidade do seu estúdio."
    },
    {
      "pergunta": "Onde ficam os arquivos?",
      "resposta": "Na sua conta do Google Drive, organizados por profissional, mês e cliente."
    }
  ]
}$json$::jsonb, 1, true)
on conflict (nicho_slug) do update set
  nome = excluded.nome,
  nome_comercial = excluded.nome_comercial,
  dominio = excluded.dominio,
  publico = excluded.publico,
  dor_principal = excluded.dor_principal,
  campos_json = excluded.campos_json,
  termo_texto = excluded.termo_texto,
  consentimento_lgpd = excluded.consentimento_lgpd,
  landing_copy = excluded.landing_copy,
  versao = excluded.versao,
  ativo = excluded.ativo,
  atualizado_em = now();

insert into public.templates
  (nicho_slug, nome, nome_comercial, dominio, publico, dor_principal,
   campos_json, termo_texto, consentimento_lgpd, landing_copy, versao, ativo)
values
  ($txt$tatuagem$txt$, $txt$Ficha de Anamnese e Termo de Consentimento — Tatuagem$txt$, $txt$FichaPro Tattoo$txt$, $txt$fichadetatuador.com.br$txt$,
   $txt$Estúdios de tatuagem de 1 a 5 tatuadores$txt$, $txt$Papel, impressão, espaço físico, fichas perdidas e ausência de prova jurídica organizada.$txt$,
   $json${
  "secoes": [
    {
      "id": "identificacao",
      "titulo": "Dados de identificação",
      "rotulo_curto": "Dados",
      "descricao": "Informações pessoais do cliente para registro do procedimento.",
      "campos": [
        {
          "id": "nome",
          "label": "Nome completo",
          "tipo": "text",
          "obrigatorio": true,
          "placeholder": "Como consta no documento",
          "min": 3,
          "max": 120,
          "autocomplete": "name"
        },
        {
          "id": "data_nascimento",
          "label": "Data de nascimento",
          "tipo": "date",
          "obrigatorio": true,
          "regra": "data_passada"
        },
        {
          "id": "cpf",
          "label": "CPF",
          "tipo": "cpf",
          "obrigatorio": true,
          "placeholder": "000.000.000-00"
        },
        {
          "id": "rg",
          "label": "RG / documento",
          "tipo": "text",
          "obrigatorio": true,
          "placeholder": "Número do documento",
          "max": 30
        },
        {
          "id": "telefone",
          "label": "Telefone / WhatsApp",
          "tipo": "tel",
          "obrigatorio": true,
          "placeholder": "(00) 00000-0000",
          "autocomplete": "tel"
        },
        {
          "id": "email",
          "label": "E-mail",
          "tipo": "email",
          "obrigatorio": false,
          "placeholder": "voce@email.com",
          "autocomplete": "email"
        },
        {
          "id": "endereco",
          "label": "Endereço completo",
          "tipo": "textarea",
          "obrigatorio": true,
          "placeholder": "Rua, número, bairro, cidade — UF",
          "min": 10,
          "max": 300
        },
        {
          "id": "contato_emergencia",
          "label": "Contato de emergência",
          "tipo": "text",
          "obrigatorio": true,
          "placeholder": "Nome e telefone de quem avisar em caso de necessidade",
          "max": 160
        },
        {
          "id": "documento",
          "label": "Documento de identificação com foto",
          "tipo": "upload",
          "obrigatorio": false,
          "hint": "RG, CNH ou outro documento com foto. A imagem é comprimida antes do envio.",
          "max_mb": 10,
          "aceita": [
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/pdf"
          ]
        }
      ]
    },
    {
      "id": "saude",
      "titulo": "Histórico de saúde",
      "rotulo_curto": "Saúde",
      "descricao": "Respostas verdadeiras protegem você e ajudam o profissional a decidir com segurança.",
      "layout": "grade",
      "campos": [
        {
          "id": "tratamento_medico",
          "label": "Está em tratamento médico?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "cirurgia_recente",
          "label": "Cirurgia recente no local da tatuagem?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "alergia",
          "label": "Possui alergia (tinta, metal, látex, anestésico)?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "convulsoes",
          "label": "Histórico de convulsões?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "doenca_transmissivel",
          "label": "Possui doença transmissível?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "diabetes",
          "label": "Diabetes?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "hipertensao",
          "label": "Hipertensão?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "problema_pele",
          "label": "Problema de pele (eczema, psoríase, dermatite)?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "queloide",
          "label": "Histórico de queloide?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "cicatrizacao",
          "label": "Dificuldade de cicatrização?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "gestante",
          "label": "Está gestante ou amamentando?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "marcapasso",
          "label": "Usa marcapasso?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "cancer",
          "label": "Já teve ou trata câncer?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "compacto": true,
          "alerta_sim": true
        },
        {
          "id": "outras_condicoes",
          "label": "Outras condições",
          "tipo": "checkbox",
          "obrigatorio": false,
          "hint": "Marque todas que se aplicam.",
          "opcoes": [
            "Hepatite",
            "Anemia",
            "Vitiligo",
            "Nenhuma das anteriores"
          ],
          "exclusivo": "Nenhuma das anteriores"
        },
        {
          "id": "detalhamento",
          "label": "Detalhamento",
          "tipo": "textarea",
          "obrigatorio": false,
          "placeholder": "Se respondeu Sim a algum item, descreva a condição, medicamentos em uso e cuidados.",
          "max": 800
        }
      ]
    },
    {
      "id": "triagem",
      "titulo": "Triagem imediata",
      "rotulo_curto": "Triagem",
      "descricao": "Informações sobre o seu estado neste momento, antes do procedimento.",
      "campos": [
        {
          "id": "alcool_drogas",
          "label": "Está sob efeito de álcool ou drogas?",
          "tipo": "sim_nao",
          "obrigatorio": true,
          "alerta_sim": true
        },
        {
          "id": "alimentacao",
          "label": "Alimentou-se nas últimas 12 horas?",
          "tipo": "sim_nao",
          "obrigatorio": true
        },
        {
          "id": "outras_info",
          "label": "Outras informações importantes",
          "tipo": "textarea",
          "obrigatorio": false,
          "placeholder": "Algo que o profissional deva saber antes do procedimento?",
          "max": 600
        }
      ]
    },
    {
      "id": "procedimento",
      "titulo": "Detalhes do procedimento",
      "rotulo_curto": "Procedimento",
      "descricao": "Dados da sessão que serão vinculados ao registro.",
      "campos": [
        {
          "id": "local_tatuagem",
          "label": "Local da tatuagem",
          "tipo": "text",
          "obrigatorio": true,
          "placeholder": "Ex.: antebraço direito, costela, tornozelo esquerdo",
          "max": 120
        },
        {
          "id": "profissional",
          "label": "Profissional responsável",
          "tipo": "select",
          "obrigatorio": true,
          "opcoes_fonte": "profissionais"
        },
        {
          "id": "estilo",
          "label": "Estilo",
          "tipo": "checkbox",
          "obrigatorio": false,
          "opcoes": [
            "Fine line",
            "Blackwork",
            "Colorida",
            "Realismo",
            "Cobertura",
            "Retoque",
            "Outro"
          ]
        },
        {
          "id": "valor",
          "label": "Valor do procedimento (R$)",
          "tipo": "number",
          "obrigatorio": false,
          "min": 0
        },
        {
          "id": "data_procedimento",
          "label": "Data do procedimento",
          "tipo": "date",
          "obrigatorio": true
        },
        {
          "id": "observacoes",
          "label": "Observações",
          "tipo": "textarea",
          "obrigatorio": false,
          "max": 600
        }
      ]
    },
    {
      "id": "responsavel_menor",
      "titulo": "Autorização do responsável legal",
      "rotulo_curto": "Responsável",
      "descricao": "Obrigatório para clientes menores de 18 anos. O responsável deve estar presente e apresentar documento.",
      "condicional": {
        "tipo": "menor_idade"
      },
      "campos": [
        {
          "id": "responsavel_nome",
          "label": "Nome completo do responsável",
          "tipo": "text",
          "obrigatorio": true,
          "max": 120
        },
        {
          "id": "responsavel_cpf",
          "label": "CPF do responsável",
          "tipo": "cpf",
          "obrigatorio": true
        },
        {
          "id": "responsavel_rg",
          "label": "RG / documento do responsável",
          "tipo": "text",
          "obrigatorio": true,
          "max": 30
        },
        {
          "id": "parentesco",
          "label": "Parentesco",
          "tipo": "select",
          "obrigatorio": true,
          "opcoes": [
            "Mãe",
            "Pai",
            "Tutor(a) legal",
            "Avó / Avô",
            "Outro"
          ]
        },
        {
          "id": "responsavel_telefone",
          "label": "Telefone do responsável",
          "tipo": "tel",
          "obrigatorio": true
        },
        {
          "id": "responsavel_presente",
          "label": "O responsável está presente no local?",
          "tipo": "sim_nao",
          "obrigatorio": true
        },
        {
          "id": "autorizacao_upload",
          "label": "Autorização assinada + documento com foto",
          "tipo": "upload",
          "obrigatorio": true,
          "hint": "Anexe a autorização assinada pelo responsável e um documento com foto.",
          "max_mb": 10,
          "aceita": [
            "image/jpeg",
            "image/png",
            "image/webp",
            "application/pdf"
          ]
        }
      ]
    }
  ],
  "consentimentos_extras": [
    {
      "id": "autorizo_imagens",
      "label": "Autorizo o registro fotográfico (antes, durante e depois) para fins de documentação do procedimento e portfólio do estúdio.",
      "obrigatorio": true
    }
  ]
}$json$::jsonb, $txt$Eu, na qualidade de cliente, autorizo a realização do procedimento de tatuagem descrito nesta ficha. Declaro que compareci de forma voluntária, tive a oportunidade de esclarecer dúvidas e recebi orientações sobre o procedimento, seus riscos e cuidados.

Estou ciente de que a tatuagem é permanente, pode exigir retoques e que os resultados variam conforme a cicatrização de cada pessoa. Declaro que informei de forma verdadeira e completa meu histórico de saúde, alergias, medicamentos e condições médicas, e que não ocultei informações relevantes.

Estou ciente dos riscos inerentes ao procedimento, incluindo dor, edema, sangramento, infecção, reação alérgica à tinta ou aos materiais, queloides, cicatrização irregular, alterações de pigmentação e necessidade de retoque. Comprometo-me a seguir as orientações de pós-procedimento, manter a higiene local, não expor a área ao sol sem proteção e procurar atendimento médico em caso de sinais de infecção ou reação adversa.

Declaro que o profissional pode recusar ou adiar o procedimento caso identifique risco à minha saúde. Se eu for menor de 18 anos, declaro que estou acompanhado(a) do responsável legal, que autoriza o procedimento e assina este documento.

Reconheço que a assinatura eletrônica deste documento é válida como manifestação de vontade, nos termos do art. 10 da MP 2.200-2/2001 e da Lei 13.709/2018 (LGPD), e que a trilha de auditoria registra hash do conteúdo, data e hora, endereço IP e dispositivo utilizado.$txt$, $txt$Li e concordo com o tratamento dos meus dados pessoais e dados sensíveis de saúde, nos termos da Lei 13.709/2018 (LGPD), para fins de registro do procedimento, cumprimento de obrigações legais e exercício regular de direitos do estabelecimento.

Os dados serão armazenados por até {{retencao_anos}} anos, ou pelo prazo legal aplicável, e poderão ser acessados, corrigidos ou excluídos mediante solicitação ao titular pelo e-mail {{email_contato}}. Estou ciente de que a exclusão pode ser limitada por obrigação legal de guarda. As imagens e o documento de identificação serão utilizados exclusivamente para as finalidades informadas nesta ficha e não serão compartilhados com terceiros sem consentimento, salvo obrigação legal.$txt$,
   $json${
  "headline": "A ficha de anamnese digital feita para tatuadores",
  "subheadline": "Elimine o papel, organize as fichas por cliente e tenha prova jurídica com assinatura digital. Pronto em 10 minutos.",
  "cta_primario": "Testar grátis por 7 dias",
  "cta_secundario": "Ver demonstração",
  "secoes": [
    "Problema: papel, impressão, espaço e fichas perdidas",
    "Solução: QR code, cliente preenche no celular, PDF vai para o seu Drive",
    "Diferenciais: feito para tatuador, assinatura com hash, autorização de menor",
    "Depoimentos",
    "Planos e preços",
    "Perguntas frequentes"
  ],
  "seo_keywords": [
    "ficha de anamnese tatuagem",
    "ficha digital tatuador",
    "termo de consentimento tatuagem",
    "app ficha anamnese estúdio",
    "ficha de anamnese para tatuagem pdf"
  ],
  "faq": [
    {
      "pergunta": "O cliente precisa instalar algum aplicativo?",
      "resposta": "Não. Ele aponta a câmera para o QR code, abre a ficha no navegador do celular, preenche, assina com o dedo e pronto."
    },
    {
      "pergunta": "Onde as fichas ficam salvas?",
      "resposta": "Por padrão, na sua própria conta do Google Drive, em pastas organizadas por profissional, mês e cliente. Você continua dono dos arquivos."
    },
    {
      "pergunta": "A assinatura digital tem validade jurídica?",
      "resposta": "A assinatura eletrônica é uma manifestação de vontade válida. Cada ficha registra hash SHA-256 do conteúdo, data e hora, IP e dispositivo, formando uma trilha de auditoria que reforça a prova."
    },
    {
      "pergunta": "Como funciona para cliente menor de idade?",
      "resposta": "A ficha identifica a idade pela data de nascimento e libera automaticamente a seção do responsável legal, com CPF, parentesco, documento de autorização e assinatura do responsável."
    },
    {
      "pergunta": "Preciso imprimir alguma coisa?",
      "resposta": "Só o QR code, se quiser deixar na recepção. A ficha inteira é preenchida e assinada no celular."
    },
    {
      "pergunta": "Posso personalizar com a logo e as cores do meu estúdio?",
      "resposta": "Sim. No painel você envia a logo e escolhe as cores. A ficha do cliente já abre com a identidade do seu estúdio."
    },
    {
      "pergunta": "E se o cliente não tiver celular ou internet?",
      "resposta": "Você pode abrir a ficha em um tablet do estúdio. Se a conexão cair, o preenchimento permanece no dispositivo até o envio."
    },
    {
      "pergunta": "O sistema substitui o meu ERP ou sistema de gestão?",
      "resposta": "Não. Ele faz uma coisa muito bem: ficha, termo, assinatura e organização dos documentos. É mais simples e barato que um ERP completo."
    },
    {
      "pergunta": "Consigo exportar todas as fichas?",
      "resposta": "Sim. Você pode baixar os PDFs individualmente ou solicitar um backup em ZIP a qualquer momento."
    },
    {
      "pergunta": "Posso cancelar quando quiser?",
      "resposta": "Sim. A assinatura é mensal, sem fidelidade. No plano anual você ganha dois meses de desconto."
    }
  ]
}$json$::jsonb, 1, true)
on conflict (nicho_slug) do update set
  nome = excluded.nome,
  nome_comercial = excluded.nome_comercial,
  dominio = excluded.dominio,
  publico = excluded.publico,
  dor_principal = excluded.dor_principal,
  campos_json = excluded.campos_json,
  termo_texto = excluded.termo_texto,
  consentimento_lgpd = excluded.consentimento_lgpd,
  landing_copy = excluded.landing_copy,
  versao = excluded.versao,
  ativo = excluded.ativo,
  atualizado_em = now();

commit;
