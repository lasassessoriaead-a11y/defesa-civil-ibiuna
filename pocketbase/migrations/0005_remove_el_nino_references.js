/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Atualizar registros no banco de dados que contenham menção a "El Niño"
    app
      .db()
      .newQuery(`
      UPDATE occurrences
      SET description = REPLACE(description, 'do El Niño', 'climáticas intensas')
      WHERE description LIKE '%El Niño%' OR description LIKE '%El Nino%'
    `)
      .execute()

    app
      .db()
      .newQuery(`
      UPDATE occurrences
      SET description = REPLACE(description, 'El Niño', 'evento climático extremo')
      WHERE description LIKE '%El Niño%' OR description LIKE '%El Nino%'
    `)
      .execute()

    // 2. Redefinir o agente da Defesa Civil com prompt e memórias genéricos (sem El Niño)
    $ai.agents.define(app, {
      slug: 'defesa-civil-assistente',
      name: 'Assistente da Defesa Civil',
      description:
        'Assistente operacional inteligente para equipes de Defesa Civil Municipal focado em eventos climáticos extremos e gestão de riscos.',
      systemPrompt:
        'Você é o Assistente Operacional da Defesa Civil Municipal do Brasil, especializado em gestão de riscos e resposta a desastres associados a eventos climáticos extremos (enchentes, deslizamentos, secas severas, tempestades, granizo e queimadas). Responda sempre em português brasileiro (pt-BR), de forma clara, técnica, objetiva e com prioridade máxima à segurança de vidas humanas.\n\nSuas responsabilidades:\n1. Oferecer protocolos operacionais padronizados de resposta a desastres (enchentes, deslizamentos, secas, vendavais).\n2. Consultar dados do sistema (ocorrências, abrigos, equipes, suprimentos e alertas) e orientar alocação tática de recursos.\n3. Redigir ou aprimorar mensagens de alerta para a população civil com linguagem direta, verbos de ação e rotas de segurança.\n4. Explicar níveis de severidade/risco (baixo, médio, alto, crítico) e critérios de evacuação.\n5. Recusar categoricamente fornecer conselhos médicos prescritivos ou aconselhamento jurídico complexo, direcionando sempre para órgãos competentes.\n\nSempre que basear sua resposta em diretrizes e protocolos de sua base de conhecimento, cite a fonte de memória utilizada de forma sucinta ao final.',
      tier: 'fast',
      tools: [
        { collection: 'occurrences', perms: { read: true, list: true } },
        { collection: 'shelters', perms: { read: true, list: true } },
        { collection: 'supplies', perms: { read: true, list: true } },
        { collection: 'teams', perms: { read: true, list: true } },
        { collection: 'affected_areas', perms: { read: true, list: true } },
        { collection: 'alerts', perms: { read: true, list: true, create: true } },
      ],
      memory: [
        {
          type: 'text',
          payload: {
            text: 'PROTOCOLO DE ENCHENTES E ALAGAMENTOS:\n1. Monitorar réguas telemétricas e cotas de alerta dos rios e córregos municipais.\n2. Chuvas acumuladas > 30mm/h ou > 80mm/24h exigem prontidão nível AMARELO/LARANJA.\n3. Em cota de transbordamento (nível VERMELHO): acionar sirenes comunitárias e emissão de alerta SMS/WhatsApp.\n4. Evacuação prioritária: idosos, pessoas com deficiência, crianças e gestantes para abrigos pré-cadastrados.\n5. Desligar chaves gerais de energia elétrica e registros de gás nas áreas alagadas.\n6. Não atravessar pontes submersas ou correntezas (correntes de 30cm arrastam veículos).',
          },
        },
        {
          type: 'text',
          payload: {
            text: 'PROTOCOLO DE DESLIZAMENTOS DE TERRA (ENCÔSTAS):\n1. Limiar pluviométrico crítico: acumulado de 100mm a 150mm em 72 horas em solo inclinado.\n2. Sinais de risco iminente: trincas no solo ou paredes, inclinação de postes e árvores, água turva brotando da terra, estalos na estrutura.\n3. Ação imediata: interdição e evacuação de raio mínimo de 50 metros da linha de ruptura.\n4. Mobilização de equipes de engenharia/geotécnica para vistoria e corpo de bombeiros para resgate.',
          },
        },
        {
          type: 'text',
          payload: {
            text: "PROTOCOLO DE ESTIAGEM E SECA SEVERA:\n1. Decretar situação de emergência se índice pluviométrico < 40% da média histórica por 30+ dias.\n2. Operação Carro-Pipa: mapear rotas rurais prioritárias, escolas e postos de saúde.\n3. Distribuição de caixas d'água comunitárias e pastilhas de hipoclorito de sódio para desinfecção.\n4. Monitorar e coibir queimadas em vegetação rasteira com brigadas voluntárias.",
          },
        },
        {
          type: 'text',
          payload: {
            text: "GUIA DE REDAÇÃO DE ALERTAS À POPULAÇÃO:\n- Estrutura recomendada: [EMISSOR] + [NÍVEL DE AMEAÇA] + [ÁREA AFETADA] + [AÇÃO RECOMENDADA] + [CANAL DE EMERGÊNCIA].\n- Exemplo: 'DEFESA CIVIL ALERTA: Risco CRÍTICO de deslizamento no Morro Verde. Evacue imediatamente sua residência e dirija-se ao Abrigo Escola Pe. Anchieta. Ligue 199 em perigo.'\n- Usar verbos de ação imperativos: Evacue, Procure abrigo, Evite trafegar, Desligue a energia.",
          },
        },
        {
          type: 'text',
          payload: {
            text: 'CHECKLIST OPERACIONAL DE ABRIGOS TEMPORÁRIOS:\n1. Espaço mínimo: 3,5m² por pessoa em alojamentos coletivos.\n2. Suprimentos essenciais por pessoa/dia: 3L de água potável, 1 kit de higiene pessoal, 1 cobertor térmico e 1 colchonete.\n3. Instalações mínimas: 1 sanitário para cada 20 pessoas, separação de banheiros por gênero.\n4. Registro nominal de todos os acolhidos na entrada (nome, CPF, endereço de origem, necessidades médicas).\n5. Ponto de triagem de saúde para primeiros socorros e distribuição de medicamentos contínuos.',
          },
        },
        {
          type: 'faq',
          payload: {
            qa: [
              {
                question: 'Quando deve ser ordenada a evacuação preventiva de uma área?',
                answer:
                  'A evacuação preventiva deve ser deflagrada quando os pluviômetros atingirem cotas de emergência (ex: 100mm/72h em encostas ou rios atingindo a cota de extravasamento), quando surgirem trincas no solo/imóveis ou quando houver recomendação expressa dos laudos da Defesa Civil/Geologia.',
              },
              {
                question: 'Quais são os contatos de emergência padrão do sistema?',
                answer:
                  'Defesa Civil Municipal: 199; Corpo de Bombeiros Militar: 193; SAMU (Emergência Médica): 192; Polícia Militar: 190.',
              },
              {
                question: 'O que fazer quando a ocupação do abrigo ultrapassa 90%?',
                answer:
                  'Quando a ocupação atinge 90%, o status deve ser colocado em atenção e o plano de contingência municipal deve abrir o próximo abrigo da lista sequencial de prontidão, solicitando reforço imediato de colchonetes e alimentação à Brigada de Logística.',
              },
            ],
          },
        },
      ],
    })
  },
  (app) => {
    // down migration: no need to revert
  },
)
