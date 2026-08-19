/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. occurrences
    const occurrences = new Collection({
      name: 'occurrences',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'title', type: 'text', required: true },
        { name: 'description', type: 'text' },
        {
          name: 'type',
          type: 'select',
          required: true,
          values: [
            'enchente',
            'deslizamento',
            'seca',
            'tempestade',
            'granizo',
            'incendio_florestal',
            'outro',
          ],
          maxSelect: 1,
        },
        {
          name: 'severity',
          type: 'select',
          required: true,
          values: ['baixa', 'media', 'alta', 'critica'],
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['reportada', 'em_andamento', 'concluida', 'cancelada'],
          maxSelect: 1,
        },
        { name: 'latitude', type: 'number' },
        { name: 'longitude', type: 'number' },
        { name: 'address', type: 'text' },
        { name: 'affectable_population', type: 'number' },
        {
          name: 'reported_by',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'resolved_at', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_occ_status ON occurrences (status)',
        'CREATE INDEX idx_occ_type ON occurrences (type)',
        'CREATE INDEX idx_occ_severity ON occurrences (severity)',
        'CREATE INDEX idx_occ_created ON occurrences (created DESC)',
      ],
    })
    app.save(occurrences)

    // 2. shelters
    const shelters = new Collection({
      name: 'shelters',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'address', type: 'text' },
        { name: 'latitude', type: 'number' },
        { name: 'longitude', type: 'number' },
        { name: 'capacity', type: 'number', required: true },
        { name: 'occupancy', type: 'number' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['ativo', 'cheio', 'inativo'],
          maxSelect: 1,
        },
        { name: 'contact', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_shelters_status ON shelters (status)'],
    })
    app.save(shelters)

    // 3. teams (references occurrences)
    const occId = occurrences.id
    const teams = new Collection({
      name: 'teams',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        {
          name: 'type',
          type: 'select',
          required: true,
          values: ['resgate', 'saude', 'logistica', 'comunicacao', 'voluntarios', 'engenharia'],
          maxSelect: 1,
        },
        { name: 'leader_name', type: 'text' },
        { name: 'member_count', type: 'number' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['disponivel', 'em_operacao', 'descanso'],
          maxSelect: 1,
        },
        {
          name: 'current_occurrence',
          type: 'relation',
          collectionId: occId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'latitude', type: 'number' },
        { name: 'longitude', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_teams_status ON teams (status)',
        'CREATE INDEX idx_teams_type ON teams (type)',
      ],
    })
    app.save(teams)

    // 4. supplies
    const supplies = new Collection({
      name: 'supplies',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        {
          name: 'category',
          type: 'select',
          required: true,
          values: [
            'agua',
            'alimentos',
            'medicamentos',
            'roupas_cobertores',
            'equipamentos',
            'higiene',
            'outros',
          ],
          maxSelect: 1,
        },
        { name: 'quantity', type: 'number' },
        {
          name: 'unit',
          type: 'select',
          required: true,
          values: ['unidades', 'litros', 'quilos', 'caixas', 'kits'],
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['disponivel', 'critico', 'esgotado'],
          maxSelect: 1,
        },
        { name: 'location', type: 'text' },
        { name: 'min_threshold', type: 'number' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_supplies_status ON supplies (status)',
        'CREATE INDEX idx_supplies_category ON supplies (category)',
      ],
    })
    app.save(supplies)

    // 5. alerts (references users and occurrences)
    const alerts = new Collection({
      name: 'alerts',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'title', type: 'text', required: true },
        {
          name: 'type',
          type: 'select',
          required: true,
          values: [
            'enchente',
            'deslizamento',
            'seca',
            'tempestade',
            'granizo',
            'incendio_florestal',
            'outro',
          ],
          maxSelect: 1,
        },
        {
          name: 'severity',
          type: 'select',
          required: true,
          values: ['informativo', 'alerta', 'perigo', 'perigo_extremo'],
          maxSelect: 1,
        },
        { name: 'message', type: 'text', required: true },
        { name: 'target_area', type: 'text' },
        {
          name: 'channel',
          type: 'select',
          required: true,
          values: ['sms', 'whatsapp', 'sirene', 'redes_sociais', 'todos'],
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['rascunho', 'enviado', 'agendado'],
          maxSelect: 1,
        },
        { name: 'scheduled_at', type: 'date' },
        {
          name: 'sent_by',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'related_occurrence',
          type: 'relation',
          collectionId: occId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_alerts_status ON alerts (status)',
        'CREATE INDEX idx_alerts_type ON alerts (type)',
        'CREATE INDEX idx_alerts_created ON alerts (created DESC)',
      ],
    })
    app.save(alerts)

    // 6. affected_areas
    const affectedAreas = new Collection({
      name: 'affected_areas',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'name', type: 'text', required: true },
        {
          name: 'hazard_type',
          type: 'select',
          required: true,
          values: ['enchente', 'deslizamento', 'seca', 'tempestade', 'outro'],
          maxSelect: 1,
        },
        {
          name: 'risk_level',
          type: 'select',
          required: true,
          values: ['baixo', 'medio', 'alto', 'critico'],
          maxSelect: 1,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['monitorado', 'evacuado', 'interditado', 'liberado'],
          maxSelect: 1,
        },
        { name: 'area_polygon', type: 'text' }, // JSON string array of [lat, lng]
        { name: 'coordinates', type: 'text' }, // "lat,lng" centroid
        { name: 'affected_population', type: 'number' },
        { name: 'notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_areas_risk ON affected_areas (risk_level)',
        'CREATE INDEX idx_areas_status ON affected_areas (status)',
      ],
    })
    app.save(affectedAreas)
  },
  (app) => {
    const collections = ['affected_areas', 'alerts', 'supplies', 'teams', 'shelters', 'occurrences']
    for (const name of collections) {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (_) {}
    }
  },
)
