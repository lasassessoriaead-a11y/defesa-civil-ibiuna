/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. Criar coleção municipalities
    const municipalities = new Collection({
      name: 'municipalities',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != '' && @request.auth.role = 'administrador'",
      updateRule:
        "@request.auth.id != '' && @request.auth.role = 'administrador' && @request.auth.municipality = id",
      deleteRule: null, // Proteger deleção acidental de municípios
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'city', type: 'text', required: true },
        { name: 'state', type: 'text', required: true }, // UF: SP, RJ, etc.
        {
          name: 'logo',
          type: 'file',
          maxSelect: 1,
          maxSize: 5242880,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'],
        },
        { name: 'doc_header', type: 'text' },
        { name: 'doc_footer', type: 'text' },
        { name: 'settings', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_mun_name ON municipalities (name)',
        'CREATE INDEX idx_mun_city_state ON municipalities (city, state)',
      ],
    })
    app.save(municipalities)
    const munColId = municipalities.id

    // Seed Município Inicial garantindo idempotência
    let initialMunId = ''
    try {
      const existingMun = app.findFirstRecordByData('municipalities', 'name', 'Município Inicial')
      initialMunId = existingMun.id
    } catch (_) {
      const munRecord = new Record(municipalities)
      munRecord.set('name', 'Município Inicial')
      munRecord.set('city', 'Ibiúna')
      munRecord.set('state', 'SP')
      munRecord.set('doc_header', 'PREFEITURA MUNICIPAL - COORDENADORIA MUNICIPAL DE DEFESA CIVIL')
      munRecord.set('doc_footer', 'Defesa Civil Municipal — Atendimento de Emergência 199')
      app.save(munRecord)
      initialMunId = munRecord.id
    }

    // 2. Criar coleção occurrence_counters (para numeração atômica por município + ano)
    const counters = new Collection({
      name: 'occurrence_counters',
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
        { name: 'year', type: 'number', required: true, onlyInt: true },
        { name: 'last_number', type: 'number', required: true, onlyInt: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_occ_counter_mun_year ON occurrence_counters (municipality, year)',
      ],
    })
    app.save(counters)

    // 3. Criar coleção requesters (Requerentes PF/PJ)
    const requesters = new Collection({
      name: 'requesters',
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
          cascadeDelete: false,
          maxSelect: 1,
          required: true,
        },
        { name: 'name', type: 'text', required: true },
        {
          name: 'type',
          type: 'select',
          required: true,
          values: ['pf', 'pj'],
          maxSelect: 1,
        },
        { name: 'document', type: 'text', required: true }, // CPF ou CNPJ formatado ou numérico
        { name: 'rg', type: 'text' },
        { name: 'phone', type: 'text' },
        { name: 'email', type: 'email' },
        { name: 'address', type: 'text' },
        { name: 'notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_requester_doc_mun ON requesters (municipality, document)',
        'CREATE INDEX idx_requester_name ON requesters (name)',
      ],
    })
    app.save(requesters)
    const reqColId = requesters.id

    // 4. Modificar users: adicionar role e municipality
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!usersCol.fields.getByName('role')) {
      usersCol.fields.add(
        new SelectField({
          name: 'role',
          required: true,
          values: ['administrador', 'coordenador', 'agente'],
          maxSelect: 1,
        }),
      )
    }
    if (!usersCol.fields.getByName('municipality')) {
      usersCol.fields.add(
        new RelationField({
          name: 'municipality',
          collectionId: munColId,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }
    app.save(usersCol)

    // Backfill users para initialMunId e role administrador
    app
      .db()
      .newQuery(
        "UPDATE users SET role = 'administrador', municipality = {:mun} WHERE municipality IS NULL OR municipality = ''",
      )
      .bind({ mun: initialMunId })
      .execute()

    // 5. Modificar occurrences: adicionar municipality, code, origin, requester
    const occCol = app.findCollectionByNameOrId('occurrences')
    const occId = occCol.id

    if (!occCol.fields.getByName('municipality')) {
      occCol.fields.add(
        new RelationField({
          name: 'municipality',
          collectionId: munColId,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }
    if (!occCol.fields.getByName('code')) {
      occCol.fields.add(
        new TextField({
          name: 'code',
          required: false,
        }),
      )
    }
    if (!occCol.fields.getByName('origin')) {
      occCol.fields.add(
        new SelectField({
          name: 'origin',
          required: false,
          values: [
            '199',
            'denuncia',
            'telefone',
            'redes_sociais',
            'processo_administrativo',
            'outro',
          ],
          maxSelect: 1,
        }),
      )
    }
    if (!occCol.fields.getByName('requester')) {
      occCol.fields.add(
        new RelationField({
          name: 'requester',
          collectionId: reqColId,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }
    app.save(occCol)

    // Backfill occurrences
    app
      .db()
      .newQuery(
        "UPDATE occurrences SET municipality = {:mun} WHERE municipality IS NULL OR municipality = ''",
      )
      .bind({ mun: initialMunId })
      .execute()
    app
      .db()
      .newQuery("UPDATE occurrences SET origin = '199' WHERE origin IS NULL OR origin = ''")
      .execute()

    // Atribuir code sequencial para ocorrências existentes: OC-2026-00001, OC-2026-00002, etc.
    const existingOccs = app.findRecordsByFilter(
      'occurrences',
      "municipality = '" + initialMunId + "'",
      'created',
      100,
      0,
    )
    let seq = 0
    for (let i = 0; i < existingOccs.length; i++) {
      const occ = existingOccs[i]
      if (!occ.getString('code')) {
        seq++
        const padded = ('00000' + seq).slice(-5)
        const code = 'OC-2026-' + padded
        occ.set('code', code)
        app.save(occ)
      }
    }
    // Inicializar o contador para 2026 com o valor seq
    if (seq > 0) {
      const counterRec = new Record(counters)
      counterRec.set('municipality', initialMunId)
      counterRec.set('year', 2026)
      counterRec.set('last_number', seq)
      app.save(counterRec)
    }

    // Adicionar índice de code único por município na coleção occurrences
    try {
      occCol.addIndex('idx_occ_code_mun', true, 'municipality, code', "code != ''")
      app.save(occCol)
    } catch (_) {}

    // 6. Modificar shelters, teams, supplies, alerts, affected_areas, whatsapp_messages: adicionar municipality
    const operationalCols = [
      'shelters',
      'teams',
      'supplies',
      'alerts',
      'affected_areas',
      'whatsapp_messages',
    ]
    for (let i = 0; i < operationalCols.length; i++) {
      const colName = operationalCols[i]
      try {
        const col = app.findCollectionByNameOrId(colName)
        if (!col.fields.getByName('municipality')) {
          col.fields.add(
            new RelationField({
              name: 'municipality',
              collectionId: munColId,
              cascadeDelete: false,
              maxSelect: 1,
            }),
          )
          app.save(col)
        }
        app
          .db()
          .newQuery(
            'UPDATE ' +
              colName +
              " SET municipality = {:mun} WHERE municipality IS NULL OR municipality = ''",
          )
          .bind({ mun: initialMunId })
          .execute()
      } catch (e) {
        console.log('Erro ao adicionar municipality em ' + colName + ':', e.message)
      }
    }

    // 7. Criar coleção occurrence_files (Anexos de ocorrências)
    const occFiles = new Collection({
      name: 'occurrence_files',
      type: 'base',
      listRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
      viewRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
      createRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
      updateRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
      deleteRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
      fields: [
        {
          name: 'municipality',
          type: 'relation',
          collectionId: munColId,
          cascadeDelete: false,
          maxSelect: 1,
          required: true,
        },
        {
          name: 'occurrence',
          type: 'relation',
          collectionId: occId,
          cascadeDelete: true,
          maxSelect: 1,
          required: true,
        },
        {
          name: 'file',
          type: 'file',
          maxSelect: 1,
          maxSize: 20971520, // 20 MB
          required: true,
        },
        {
          name: 'file_type',
          type: 'select',
          required: true,
          values: ['foto', 'documento', 'outro'],
          maxSelect: 1,
        },
        { name: 'caption', type: 'text' },
        {
          name: 'uploaded_by',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_occ_files_occ ON occurrence_files (occurrence)',
        'CREATE INDEX idx_occ_files_mun ON occurrence_files (municipality)',
      ],
    })
    app.save(occFiles)

    // 8. Criar coleção audit_log (Trilha de auditoria sem dados sensíveis)
    const auditLog = new Collection({
      name: 'audit_log',
      type: 'base',
      listRule:
        "@request.auth.id != '' && municipality = @request.auth.municipality && (@request.auth.role = 'administrador' || @request.auth.role = 'coordenador')",
      viewRule:
        "@request.auth.id != '' && municipality = @request.auth.municipality && (@request.auth.role = 'administrador' || @request.auth.role = 'coordenador')",
      createRule: null, // Apenas hooks de servidor geram registros de auditoria
      updateRule: null, // Imutável
      deleteRule: null, // Imutável
      fields: [
        {
          name: 'municipality',
          type: 'relation',
          collectionId: munColId,
          cascadeDelete: false,
          maxSelect: 1,
          required: true,
        },
        {
          name: 'user',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'user_name', type: 'text' },
        { name: 'user_email', type: 'text' },
        { name: 'action', type: 'text', required: true }, // create, update, conclude, reopen, delete
        { name: 'collection', type: 'text', required: true },
        { name: 'record_id', type: 'text', required: true },
        { name: 'details', type: 'text' }, // Resumo amigável
        { name: 'data_before', type: 'json' },
        { name: 'data_after', type: 'json' },
        {
          name: 'origin',
          type: 'select',
          values: ['online', 'offline'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_audit_mun_created ON audit_log (municipality, created DESC)',
        'CREATE INDEX idx_audit_action ON audit_log (action)',
        'CREATE INDEX idx_audit_record ON audit_log (collection, record_id)',
      ],
    })
    app.save(auditLog)
  },
  (app) => {
    // Reverter coleções criadas se necessário
    const cols = [
      'audit_log',
      'occurrence_files',
      'requesters',
      'occurrence_counters',
      'municipalities',
    ]
    for (let i = 0; i < cols.length; i++) {
      try {
        const c = app.findCollectionByNameOrId(cols[i])
        app.delete(c)
      } catch (_) {}
    }
  },
)
