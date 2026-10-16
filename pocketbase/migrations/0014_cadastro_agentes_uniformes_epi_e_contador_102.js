/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const munCol = app.findCollectionByNameOrId('municipalities')
    const munColId = munCol.id
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const usersColId = usersCol.id

    // 1. Coleção agent_profiles (Ficha Funcional e Medidas de Uniforme/EPI)
    // Dados vazios por padrão; preenchidos pelos usuários.
    let agentProfilesCol = null
    try {
      agentProfilesCol = app.findCollectionByNameOrId('agent_profiles')
    } catch (_) {
      agentProfilesCol = new Collection({
        name: 'agent_profiles',
        type: 'base',
        listRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        viewRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        createRule:
          "@request.auth.id != '' && municipality = @request.auth.municipality && (@request.auth.role = 'administrador' || @request.auth.role = 'coordenador')",
        updateRule:
          "@request.auth.id != '' && municipality = @request.auth.municipality && (user = @request.auth.id || @request.auth.role = 'administrador' || @request.auth.role = 'coordenador')",
        deleteRule:
          "@request.auth.id != '' && municipality = @request.auth.municipality && (@request.auth.role = 'administrador' || @request.auth.role = 'coordenador')",
        fields: [
          {
            name: 'municipality',
            type: 'relation',
            collectionId: munColId,
            cascadeDelete: true,
            maxSelect: 1,
            required: true,
          },
          {
            name: 'user',
            type: 'relation',
            collectionId: usersColId,
            cascadeDelete: true,
            maxSelect: 1,
            required: true,
          },
          // Dados Funcionais e Vínculo
          { name: 'registration_number', type: 'text' }, // Matrícula funcional
          { name: 'full_name', type: 'text', required: true },
          { name: 'cpf', type: 'text' },
          { name: 'rg', type: 'text' },
          { name: 'blood_type', type: 'text' }, // A+, O-, etc.
          { name: 'emergency_contact', type: 'text' },
          { name: 'emergency_phone', type: 'text' },
          { name: 'admission_date', type: 'date' },
          {
            name: 'employment_type',
            type: 'select',
            values: ['concursado', 'comissionado', 'temporario', 'voluntario', 'outro'],
            maxSelect: 1,
          },
          { name: 'operational_role', type: 'text' }, // Cargo/Atribuição (Agente de Campo, Piloto de Bote, Coordenador, etc.)
          {
            name: 'status',
            type: 'select',
            values: ['ativo', 'afastado', 'ferias', 'desligado'],
            maxSelect: 1,
          },
          // Medidas de Uniforme e Vestuário
          { name: 'tshirt_size', type: 'text' }, // PP, P, M, G, GG, XG, etc.
          { name: 'shirt_size', type: 'text' }, // Camisa operacional / gandola
          { name: 'pants_size', type: 'text' }, // Calça tática (38, 40, 42, 44...)
          { name: 'jacket_size', type: 'text' }, // Jaqueta / Colete / Capa de chuva
          { name: 'boot_size', type: 'text' }, // Botas / calçados de segurança (37, 38, 39, 40...)
          { name: 'additional_measurements', type: 'text' }, // Luva, capacete, observações antropométricas
          { name: 'notes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_agent_prof_user ON agent_profiles (user)',
          'CREATE INDEX idx_agent_prof_mun_status ON agent_profiles (municipality, status)',
        ],
      })
      app.save(agentProfilesCol)
    }

    // 2. Coleção epi_items (Itens de EPI e Uniforme Catalogados / Controle de Estoque)
    let epiItemsCol = null
    try {
      epiItemsCol = app.findCollectionByNameOrId('epi_items')
    } catch (_) {
      epiItemsCol = new Collection({
        name: 'epi_items',
        type: 'base',
        listRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        viewRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        createRule:
          "@request.auth.id != '' && municipality = @request.auth.municipality && (@request.auth.role = 'administrador' || @request.auth.role = 'coordenador')",
        updateRule:
          "@request.auth.id != '' && municipality = @request.auth.municipality && (@request.auth.role = 'administrador' || @request.auth.role = 'coordenador')",
        deleteRule:
          "@request.auth.id != '' && municipality = @request.auth.municipality && (@request.auth.role = 'administrador' || @request.auth.role = 'coordenador')",
        fields: [
          {
            name: 'municipality',
            type: 'relation',
            collectionId: munColId,
            cascadeDelete: true,
            maxSelect: 1,
            required: true,
          },
          { name: 'name', type: 'text', required: true }, // Ex: Capacete de Salvamento, Capa de Chuva, Bota Tática
          {
            name: 'category',
            type: 'select',
            values: [
              'epi_cabeca',
              'epi_respiratorio',
              'epi_maos',
              'epi_pes',
              'uniforme',
              'altura_resgate',
              'aquatico',
              'outro',
            ],
            maxSelect: 1,
            required: true,
          },
          { name: 'ca_number', type: 'text' }, // Certificado de Aprovação do Ministério do Trabalho
          { name: 'specification', type: 'text' }, // Detalhamento técnico / norma
          { name: 'size', type: 'text' }, // Tamanho específico se aplicável
          { name: 'stock_quantity', type: 'number', onlyInt: true }, // Estoque atual
          { name: 'min_stock_alert', type: 'number', onlyInt: true },
          { name: 'unit', type: 'text' }, // un, par, kit
          { name: 'required_for_roles', type: 'text' }, // Funções que exigem este EPI
          { name: 'is_active', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_epi_mun_cat ON epi_items (municipality, category)'],
      })
      app.save(epiItemsCol)
    }

    // 3. Coleção epi_deliveries (Entregas, Histórico de Substituições, Devoluções e Baixas de EPI)
    let epiDeliveriesCol = null
    try {
      epiDeliveriesCol = app.findCollectionByNameOrId('epi_deliveries')
    } catch (_) {
      epiDeliveriesCol = new Collection({
        name: 'epi_deliveries',
        type: 'base',
        listRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        viewRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        createRule:
          "@request.auth.id != '' && municipality = @request.auth.municipality && (@request.auth.role = 'administrador' || @request.auth.role = 'coordenador')",
        updateRule:
          "@request.auth.id != '' && municipality = @request.auth.municipality && (@request.auth.role = 'administrador' || @request.auth.role = 'coordenador')",
        deleteRule:
          "@request.auth.id != '' && municipality = @request.auth.municipality && (@request.auth.role = 'administrador' || @request.auth.role = 'coordenador')",
        fields: [
          {
            name: 'municipality',
            type: 'relation',
            collectionId: munColId,
            cascadeDelete: true,
            maxSelect: 1,
            required: true,
          },
          {
            name: 'agent',
            type: 'relation',
            collectionId: usersColId,
            cascadeDelete: false,
            maxSelect: 1,
            required: true,
          },
          {
            name: 'item',
            type: 'relation',
            collectionId: epiItemsCol.id,
            cascadeDelete: false,
            maxSelect: 1,
            required: true,
          },
          {
            name: 'action_type',
            type: 'select',
            values: [
              'entrega_inicial',
              'substituicao_desgaste',
              'substituicao_dano',
              'devolucao_baixa',
              'emprestimo_temporario',
            ],
            maxSelect: 1,
            required: true,
          },
          { name: 'quantity', type: 'number', required: true, onlyInt: true, min: 1 },
          { name: 'delivery_date', type: 'date', required: true },
          { name: 'item_size', type: 'text' },
          { name: 'item_specification', type: 'text' },
          { name: 'reason', type: 'text' }, // Justificativa de substituição ou devolução
          { name: 'receipt_signed', type: 'bool' }, // Comprovante assinado/confirmado
          { name: 'receipt_signature_date', type: 'date' },
          { name: 'receipt_document_number', type: 'text' }, // Número do termo de entrega / recibo
          {
            name: 'delivered_by',
            type: 'relation',
            collectionId: usersColId,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'delivered_by_name', type: 'text' },
          { name: 'notes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_epi_del_mun_agent ON epi_deliveries (municipality, agent)',
          'CREATE INDEX idx_epi_del_date ON epi_deliveries (delivery_date DESC)',
        ],
      })
      app.save(epiDeliveriesCol)
    }

    // 4. Alinhamento de Document Counters: Se não houver contador de 'autorizacao' em 2026 para o Município Inicial,
    // inicializar com last_number = 101, de forma que o próximo emitido seja o AUT-2026-00102
    // Conforme especificado: não colide porque tree_authorizations tem 0 registros e document_counters tem 0 registros!
    try {
      const currentYear = new Date().getFullYear()
      const existingCounter = app.findFirstRecordByFilter(
        'document_counters',
        "municipality = '" + munColId + "' && type = 'autorizacao' && year = " + currentYear,
      )
      // Se já existe e for menor que 101, elevar para 101 sem quebrar
      if (existingCounter && existingCounter.getInt('last_number') < 101) {
        existingCounter.set('last_number', 101)
        app.save(existingCounter)
      }
    } catch (_) {
      // Cria o contador inicial com last_number = 101 (próximo atômico será 102)
      try {
        const docCountersCol = app.findCollectionByNameOrId('document_counters')
        const currentYear = new Date().getFullYear()
        const newCounter = new Record(docCountersCol)
        newCounter.set('municipality', munCol.id)
        newCounter.set('type', 'autorizacao')
        newCounter.set('year', currentYear)
        newCounter.set('last_number', 101)
        app.save(newCounter)
      } catch (cntErr) {
        console.log('Alinhamento contador 102:', cntErr.message)
      }
    }
  },
  (app) => {
    const cols = ['epi_deliveries', 'epi_items', 'agent_profiles']
    for (let i = 0; i < cols.length; i++) {
      try {
        const c = app.findCollectionByNameOrId(cols[i])
        app.delete(c)
      } catch (_) {}
    }
  },
)
