/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const munColId = app.findCollectionByNameOrId('municipalities').id
    const usersColId = '_pb_users_auth_'

    // ----------------------------------------------------
    // 1. risk_sectors (Setores de Risco — cadastro técnico)
    // ----------------------------------------------------
    const riskSectors = new Collection({
      name: 'risk_sectors',
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
        { name: 'code', type: 'text', required: true },
        { name: 'sector_number', type: 'text' },
        { name: 'zone', type: 'text' },
        { name: 'area_number', type: 'text' },
        { name: 'area_name', type: 'text' },
        { name: 'plate_number', type: 'text' },
        { name: 'location', type: 'text' },
        { name: 'process_type', type: 'text' },
        { name: 'danger_grade', type: 'text' },
        { name: 'vulnerability_grade', type: 'text' },
        { name: 'risk_grade', type: 'text' },
        {
          name: 'risk_level',
          type: 'select',
          values: ['R1', 'R2', 'R3', 'R4', 'indefinido'],
          maxSelect: 1,
        },
        { name: 'affected_buildings', type: 'number' },
        { name: 'affected_dwellings', type: 'number' },
        { name: 'affected_residents', type: 'number' },
        { name: 'affected_roads_length', type: 'number' },
        { name: 'disaster_history', type: 'text' },
        { name: 'regional_risk_info', type: 'text' },
        { name: 'expected_processes', type: 'text' },
        { name: 'description', type: 'text' },
        { name: 'recommendations', type: 'text' },
        {
          name: 'validation_status',
          type: 'select',
          values: ['aprovado', 'pendente_conferencia', 'rejeitado', 'incompleto'],
          maxSelect: 1,
        },
        {
          name: 'geometry_status',
          type: 'select',
          values: ['ausente', 'pendente', 'validada', 'invalida'],
          maxSelect: 1,
        },
        { name: 'geometry_geojson', type: 'text' },
        { name: 'import_source', type: 'text' },
        { name: 'import_batch_id', type: 'text' },
        { name: 'raw_attributes', type: 'json' },
        { name: 'notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_rs_code_mun ON risk_sectors (municipality, code)',
        'CREATE INDEX idx_rs_mun_risk ON risk_sectors (municipality, risk_level)',
        'CREATE INDEX idx_rs_area_name ON risk_sectors (municipality, area_name)',
        'CREATE INDEX idx_rs_val_status ON risk_sectors (municipality, validation_status)',
      ],
    })
    app.save(riskSectors)

    // ----------------------------------------------------
    // 2. danger_stretches (Trechos de Perigo de Vias)
    // ----------------------------------------------------
    const dangerStretches = new Collection({
      name: 'danger_stretches',
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
        { name: 'code', type: 'text', required: true },
        { name: 'stretch_number', type: 'text' },
        { name: 'zone', type: 'text' },
        { name: 'area_number', type: 'text' },
        { name: 'area_name', type: 'text' },
        { name: 'location', type: 'text' },
        { name: 'process_type', type: 'text' },
        { name: 'danger_grade', type: 'text' },
        { name: 'vulnerability_grade', type: 'text' },
        { name: 'risk_grade', type: 'text' },
        {
          name: 'risk_level',
          type: 'select',
          values: ['R1', 'R2', 'R3', 'R4', 'indefinido'],
          maxSelect: 1,
        },
        { name: 'affected_roads_length', type: 'number' },
        { name: 'affected_dwellings', type: 'number' },
        { name: 'affected_residents', type: 'number' },
        { name: 'disaster_history', type: 'text' },
        { name: 'description', type: 'text' },
        { name: 'recommendations', type: 'text' },
        {
          name: 'validation_status',
          type: 'select',
          values: ['aprovado', 'pendente_conferencia', 'rejeitado', 'incompleto'],
          maxSelect: 1,
        },
        {
          name: 'geometry_status',
          type: 'select',
          values: ['ausente', 'pendente', 'validada', 'invalida'],
          maxSelect: 1,
        },
        { name: 'geometry_geojson', type: 'text' },
        { name: 'import_source', type: 'text' },
        { name: 'import_batch_id', type: 'text' },
        { name: 'raw_attributes', type: 'json' },
        { name: 'notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_ds_code_mun ON danger_stretches (municipality, code)',
        'CREATE INDEX idx_ds_mun_risk ON danger_stretches (municipality, risk_level)',
        'CREATE INDEX idx_ds_val_status ON danger_stretches (municipality, validation_status)',
      ],
    })
    app.save(dangerStretches)

    // ----------------------------------------------------
    // 3. strategic_infrastructures (Pontes, Aduelas, Bueiros e Drenagem)
    // ----------------------------------------------------
    const stratInfra = new Collection({
      name: 'strategic_infrastructures',
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
        { name: 'original_code', type: 'text', required: true },
        {
          name: 'type',
          type: 'select',
          values: ['ponte', 'aduela', 'bueiro', 'passarela', 'outro', 'pendente_classificacao'],
          maxSelect: 1,
          required: true,
        },
        { name: 'name', type: 'text' },
        { name: 'neighborhood', type: 'text' },
        { name: 'reference_point', type: 'text' },
        { name: 'channel_width', type: 'text' },
        { name: 'dimensions', type: 'text' },
        { name: 'observed_problems', type: 'text' },
        { name: 'notes', type: 'text' },
        { name: 'lat_dms', type: 'text' },
        { name: 'lon_dms', type: 'text' },
        { name: 'latitude', type: 'number' },
        { name: 'longitude', type: 'number' },
        {
          name: 'coordinate_status',
          type: 'select',
          values: ['valida', 'duvidosa', 'ilegivel', 'ausente'],
          maxSelect: 1,
          required: true,
        },
        {
          name: 'validation_status',
          type: 'select',
          values: ['pendente_conferencia', 'conferido', 'divergente', 'rejeitado'],
          maxSelect: 1,
          required: true,
        },
        { name: 'source_document', type: 'text' },
        { name: 'source_page', type: 'number' },
        { name: 'is_handwritten_transcription', type: 'bool' },
        {
          name: 'structural_condition',
          type: 'select',
          values: ['bom', 'regular', 'ruim', 'critico', 'nao_avaliado'],
          maxSelect: 1,
        },
        {
          name: 'administrative_priority',
          type: 'select',
          values: ['baixa', 'media', 'alta', 'urgente'],
          maxSelect: 1,
        },
        {
          name: 'inspection_status',
          type: 'select',
          values: ['em_dia', 'necessita_vistoria', 'em_reforma', 'interditada'],
          maxSelect: 1,
        },
        { name: 'last_inspection_date', type: 'date' },
        {
          name: 'verified_by',
          type: 'relation',
          collectionId: usersColId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'verified_at', type: 'date' },
        { name: 'verification_notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_infra_code_mun ON strategic_infrastructures (municipality, original_code)',
        'CREATE INDEX idx_infra_type ON strategic_infrastructures (municipality, type)',
        'CREATE INDEX idx_infra_val_status ON strategic_infrastructures (municipality, validation_status)',
        'CREATE INDEX idx_infra_insp_status ON strategic_infrastructures (municipality, inspection_status)',
      ],
    })
    app.save(stratInfra)
    const stratInfraSaved = app.findCollectionByNameOrId('strategic_infrastructures')
    const stratInfraId = stratInfraSaved.id

    // ----------------------------------------------------
    // 4. bridge_inspections
    // ----------------------------------------------------
    const bridgeInspections = new Collection({
      name: 'bridge_inspections',
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
        {
          name: 'infrastructure',
          type: 'relation',
          collectionId: stratInfraId,
          cascadeDelete: true,
          maxSelect: 1,
          required: true,
        },
        {
          name: 'inspector',
          type: 'relation',
          collectionId: usersColId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'inspection_date', type: 'date', required: true },
        {
          name: 'structural_condition',
          type: 'select',
          values: ['bom', 'regular', 'ruim', 'critico'],
          maxSelect: 1,
          required: true,
        },
        { name: 'problems_found', type: 'text' },
        { name: 'technical_recommendations', type: 'text' },
        {
          name: 'traffic_condition',
          type: 'select',
          values: ['livre', 'restricao_peso', 'meia_pista', 'interditada'],
          maxSelect: 1,
        },
        {
          name: 'photo',
          type: 'file',
          maxSelect: 5,
          maxSize: 10485760,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_insp_infra ON bridge_inspections (infrastructure, inspection_date DESC)',
      ],
    })
    app.save(bridgeInspections)

    // ----------------------------------------------------
    // 5. external_demands
    // ----------------------------------------------------
    const occColCurrent = app.findCollectionByNameOrId('occurrences')
    const extDemands = new Collection({
      name: 'external_demands',
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
        { name: 'title', type: 'text', required: true },
        { name: 'problem_description', type: 'text', required: true },
        { name: 'location', type: 'text', required: true },
        { name: 'latitude', type: 'number' },
        { name: 'longitude', type: 'number' },
        {
          name: 'target_department',
          type: 'select',
          values: [
            'obras',
            'servicos_municipais',
            'meio_ambiente',
            'assistencia_social',
            'saude',
            'planejamento',
            'transito',
            'outra',
          ],
          maxSelect: 1,
          required: true,
        },
        {
          name: 'priority',
          type: 'select',
          values: ['baixa', 'media', 'alta', 'urgente'],
          maxSelect: 1,
          required: true,
        },
        {
          name: 'status',
          type: 'select',
          values: [
            'identificada',
            'encaminhada',
            'em_analise',
            'em_atendimento',
            'concluida',
            'arquivada',
          ],
          maxSelect: 1,
          required: true,
        },
        { name: 'forwarded_at', type: 'date' },
        { name: 'forwarded_protocol', type: 'text' },
        { name: 'department_response', type: 'text' },
        { name: 'response_date', type: 'date' },
        { name: 'action_history', type: 'text' },
        {
          name: 'related_occurrence',
          type: 'relation',
          collectionId: occColCurrent.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'related_infrastructure',
          type: 'relation',
          collectionId: stratInfraId,
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
        {
          name: 'photos',
          type: 'file',
          maxSelect: 5,
          maxSize: 10485760,
          mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_dem_mun_status ON external_demands (municipality, status)',
        'CREATE INDEX idx_dem_dept ON external_demands (municipality, target_department)',
      ],
    })
    app.save(extDemands)

    // ----------------------------------------------------
    // 6. geo_imports
    // ----------------------------------------------------
    const geoImports = new Collection({
      name: 'geo_imports',
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
        { name: 'filename', type: 'text', required: true },
        { name: 'file_type', type: 'text', required: true },
        {
          name: 'imported_by',
          type: 'relation',
          collectionId: usersColId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'total_records', type: 'number' },
        { name: 'valid_records', type: 'number' },
        { name: 'duplicate_records', type: 'number' },
        { name: 'incomplete_records', type: 'number' },
        { name: 'rejected_records', type: 'number' },
        { name: 'summary', type: 'text' },
        { name: 'rejection_reasons', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_geo_imp_mun_date ON geo_imports (municipality, created DESC)'],
    })
    app.save(geoImports)

    // ----------------------------------------------------
    // 7. Modificar occurrences: adicionar links opcionais
    // ----------------------------------------------------
    const occCol = app.findCollectionByNameOrId('occurrences')
    const riskSectorsSaved = app.findCollectionByNameOrId('risk_sectors')
    const dangerStretchesSaved = app.findCollectionByNameOrId('danger_stretches')

    if (!occCol.fields.getByName('risk_sector')) {
      occCol.fields.add(
        new RelationField({
          name: 'risk_sector',
          collectionId: riskSectorsSaved.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }
    if (!occCol.fields.getByName('danger_stretch')) {
      occCol.fields.add(
        new RelationField({
          name: 'danger_stretch',
          collectionId: dangerStretchesSaved.id,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }
    if (!occCol.fields.getByName('strategic_infrastructure')) {
      occCol.fields.add(
        new RelationField({
          name: 'strategic_infrastructure',
          collectionId: stratInfraId,
          cascadeDelete: false,
          maxSelect: 1,
        }),
      )
    }
    app.save(occCol)
  },
  (app) => {
    try {
      const occCol = app.findCollectionByNameOrId('occurrences')
      occCol.fields.removeByName('risk_sector')
      occCol.fields.removeByName('danger_stretch')
      occCol.fields.removeByName('strategic_infrastructure')
      app.save(occCol)
    } catch (_) {}

    try {
      app.delete(app.findCollectionByNameOrId('geo_imports'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('external_demands'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('bridge_inspections'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('strategic_infrastructures'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('danger_stretches'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('risk_sectors'))
    } catch (_) {}
  },
)
