/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const munCol = app.findCollectionByNameOrId('municipalities')
    const munColId = munCol.id
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const usersColId = usersCol.id
    const reqCol = app.findCollectionByNameOrId('requesters')
    const reqColId = reqCol.id

    // 1. Adicionar campo authorized_issuer em municipalities (somente 1 usuário designado por município para emissão de autorizações)
    if (!munCol.fields.getByName('authorized_issuer')) {
      munCol.fields.add(
        new RelationField({
          name: 'authorized_issuer',
          collectionId: usersColId,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
      app.save(munCol)
    }

    // 2. Coleção document_counters (para contagem atômica de OF e AUT por município e ano)
    let docCountersCol = null
    try {
      docCountersCol = app.findCollectionByNameOrId('document_counters')
    } catch (_) {
      docCountersCol = new Collection({
        name: 'document_counters',
        type: 'base',
        listRule: null,
        viewRule: null,
        createRule: null,
        updateRule: null,
        deleteRule: null,
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
            name: 'type',
            type: 'select',
            required: true,
            values: ['oficio', 'autorizacao'],
            maxSelect: 1,
          },
          { name: 'year', type: 'number', required: true, onlyInt: true },
          { name: 'last_number', type: 'number', required: true, onlyInt: true },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_doc_counter_mun_type_year ON document_counters (municipality, type, year)',
        ],
      })
      app.save(docCountersCol)
    }

    // 3. Coleção doc_templates (Modelos oficiais reutilizáveis por município)
    let templatesCol = null
    try {
      templatesCol = app.findCollectionByNameOrId('doc_templates')
    } catch (_) {
      templatesCol = new Collection({
        name: 'doc_templates',
        type: 'base',
        listRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        viewRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        createRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        updateRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
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
          { name: 'title', type: 'text', required: true },
          {
            name: 'category',
            type: 'select',
            values: ['oficio', 'notificacao', 'solicitacao', 'laudo', 'outro'],
            maxSelect: 1,
            required: true,
          },
          { name: 'subject', type: 'text' },
          { name: 'content', type: 'editor' },
          { name: 'is_default', type: 'bool' },
          {
            name: 'created_by',
            type: 'relation',
            collectionId: usersColId,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_templates_mun ON doc_templates (municipality)',
          'CREATE INDEX idx_templates_cat ON doc_templates (category)',
        ],
      })
      app.save(templatesCol)
    }

    // 4. Coleção official_documents (Ofícios e Documentos Oficiais)
    let officialDocsCol = null
    try {
      officialDocsCol = app.findCollectionByNameOrId('official_documents')
    } catch (_) {
      officialDocsCol = new Collection({
        name: 'official_documents',
        type: 'base',
        listRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        viewRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        createRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        // Agentes e coordenadores podem atualizar apenas enquanto rascunho; após emitido, bloqueado ou controlado
        updateRule:
          "@request.auth.id != '' && municipality = @request.auth.municipality && (status = 'rascunho' || (@request.auth.role = 'administrador' || @request.auth.role = 'coordenador'))",
        deleteRule:
          "@request.auth.id != '' && municipality = @request.auth.municipality && status = 'rascunho' && (@request.auth.role = 'administrador' || @request.auth.role = 'coordenador')",
        fields: [
          {
            name: 'municipality',
            type: 'relation',
            collectionId: munColId,
            cascadeDelete: false,
            maxSelect: 1,
            required: true,
          },
          { name: 'number', type: 'text' }, // Ex.: OF-2026-00001 (gerado na emissão atômica)
          { name: 'year', type: 'number', onlyInt: true },
          { name: 'sequential', type: 'number', onlyInt: true },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['rascunho', 'emitido', 'cancelado'],
            maxSelect: 1,
          },
          { name: 'recipient_name', type: 'text', required: true },
          { name: 'recipient_role', type: 'text' },
          { name: 'recipient_institution', type: 'text' },
          { name: 'recipient_address', type: 'text' },
          { name: 'subject', type: 'text', required: true },
          { name: 'content', type: 'editor', required: true },
          {
            name: 'signatory_user',
            type: 'relation',
            collectionId: usersColId,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'signatory_name', type: 'text' },
          { name: 'signatory_role', type: 'text' },
          { name: 'issue_date', type: 'date' },
          {
            name: 'template',
            type: 'relation',
            collectionId: templatesCol.id,
            cascadeDelete: false,
            maxSelect: 1,
          },
          {
            name: 'created_by',
            type: 'relation',
            collectionId: usersColId,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_doc_num_mun ON official_documents (municipality, number) WHERE number != ""',
          'CREATE INDEX idx_doc_mun_status ON official_documents (municipality, status)',
          'CREATE INDEX idx_doc_created ON official_documents (created DESC)',
        ],
      })
      app.save(officialDocsCol)
    }

    // 5. Coleção tree_authorizations (Autorizações de Corte e Poda)
    let treeAuthsCol = null
    try {
      treeAuthsCol = app.findCollectionByNameOrId('tree_authorizations')
    } catch (_) {
      treeAuthsCol = new Collection({
        name: 'tree_authorizations',
        type: 'base',
        listRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        viewRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        createRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        updateRule:
          "@request.auth.id != '' && municipality = @request.auth.municipality && (status = 'rascunho' || (@request.auth.role = 'administrador' || @request.auth.role = 'coordenador'))",
        deleteRule:
          "@request.auth.id != '' && municipality = @request.auth.municipality && status = 'rascunho' && (@request.auth.role = 'administrador' || @request.auth.role = 'coordenador')",
        fields: [
          {
            name: 'municipality',
            type: 'relation',
            collectionId: munColId,
            cascadeDelete: false,
            maxSelect: 1,
            required: true,
          },
          { name: 'number', type: 'text' }, // Ex.: AUT-2026-00001
          { name: 'year', type: 'number', onlyInt: true },
          { name: 'sequential', type: 'number', onlyInt: true },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['rascunho', 'emitida', 'cancelada'],
            maxSelect: 1,
          },
          {
            name: 'type',
            type: 'select',
            required: true,
            values: ['corte', 'poda', 'corte_e_poda'],
            maxSelect: 1,
          },
          {
            name: 'requester',
            type: 'relation',
            collectionId: reqColId,
            cascadeDelete: false,
            maxSelect: 1,
            required: true,
          },
          { name: 'tree_quantity', type: 'number', required: true, onlyInt: true, min: 1 },
          { name: 'tree_species', type: 'text' }, // Espécie ou descrição arbórea
          { name: 'address', type: 'text', required: true },
          { name: 'neighborhood', type: 'text' },
          { name: 'risk_reason', type: 'text' }, // Risco de queda, fiação elétrica, abalo estrutural etc.
          { name: 'technical_report', type: 'editor', required: true }, // Parecer / relato técnico padronizado
          { name: 'compensatory_measures', type: 'text' }, // Plantio compensatório de mudas se aplicável
          { name: 'issue_date', type: 'date' },
          { name: 'expiration_date', type: 'date' }, // 90 dias a partir da data de emissão
          {
            name: 'authorized_by',
            type: 'relation',
            collectionId: usersColId,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'authorized_by_name', type: 'text' },
          { name: 'authorized_by_role', type: 'text' },
          {
            name: 'created_by',
            type: 'relation',
            collectionId: usersColId,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_tree_auth_num_mun ON tree_authorizations (municipality, number) WHERE number != ""',
          'CREATE INDEX idx_tree_auth_mun_status ON tree_authorizations (municipality, status)',
          'CREATE INDEX idx_tree_auth_req ON tree_authorizations (requester)',
          'CREATE INDEX idx_tree_auth_exp ON tree_authorizations (expiration_date)',
        ],
      })
      app.save(treeAuthsCol)
    }

    // 6. Inserir alguns modelos padrão de ofício para o Município Inicial (se não existirem)
    try {
      const existingTpl = app.findFirstRecordByData(
        'doc_templates',
        'title',
        'Ofício de Solicitação Padrão',
      )
    } catch (_) {
      try {
        const adminUser = app.findFirstRecordByData('users', 'email', 'luka2510@hotmail.com')
        const tpl1 = new Record(templatesCol)
        tpl1.set('municipality', munColId)
        tpl1.set('title', 'Ofício de Solicitação Padrão')
        tpl1.set('category', 'solicitacao')
        tpl1.set(
          'subject',
          'Solicitação de apoio institucional em ações preventivas de Defesa Civil',
        )
        tpl1.set(
          'content',
          '<p>Cumprimentando-o cordialmente, venho por meio deste solicitar apoio institucional e disponibilização de recursos técnicos e operacionais para suporte nas ações de monitoramento e pronta resposta da Coordenadoria Municipal de Defesa Civil.</p><p>Certos de contar com vossa costumeira colaboração e apreço, renovamos nossos votos de elevada consideração.</p>',
        )
        tpl1.set('is_default', true)
        tpl1.set('created_by', adminUser.id)
        app.save(tpl1)

        const tpl2 = new Record(templatesCol)
        tpl2.set('municipality', munColId)
        tpl2.set('title', 'Ofício de Notificação Preventiva')
        tpl2.set('category', 'notificacao')
        tpl2.set('subject', 'Notificação de risco iminente e orientações preventivas')
        tpl2.set(
          'content',
          '<p>Pelo presente instrumento, NOTIFICAMOS V. Sa. quanto à constatação técnica de condições de risco nas proximidades do imóvel sob vossa responsabilidade, conforme vistoria realizada por equipe técnica desta Coordenadoria.</p><p>Solicitamos a adoção imediata das medidas mitigadoras cabíveis no prazo regulamentar, visando salvaguardar a integridade de vidas e patrimônios.</p>',
        )
        tpl2.set('is_default', false)
        tpl2.set('created_by', adminUser.id)
        app.save(tpl2)
      } catch (errTpl) {
        console.log('Templates seed ignorado:', errTpl.message)
      }
    }
  },
  (app) => {
    const cols = ['tree_authorizations', 'official_documents', 'doc_templates', 'document_counters']
    for (let i = 0; i < cols.length; i++) {
      try {
        const c = app.findCollectionByNameOrId(cols[i])
        app.delete(c)
      } catch (_) {}
    }
    try {
      const munCol = app.findCollectionByNameOrId('municipalities')
      if (munCol.fields.getByName('authorized_issuer')) {
        munCol.fields.removeByName('authorized_issuer')
        app.save(munCol)
      }
    } catch (_) {}
  },
)
