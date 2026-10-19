migrate(
  (app) => {
    // 1. Coleção universal de anexos (fotos, vídeos, documentos técnicos)
    let attachmentsCol = null
    try {
      attachmentsCol = app.findCollectionByNameOrId('record_attachments')
    } catch (_) {
      const munId = app.findCollectionByNameOrId('municipalities').id
      const usersId = '_pb_users_auth_'

      attachmentsCol = new Collection({
        name: 'record_attachments',
        type: 'base',
        listRule: '@request.auth.id != "" && municipality = @request.auth.municipality',
        viewRule: '@request.auth.id != "" && municipality = @request.auth.municipality',
        createRule: '@request.auth.id != "" && municipality = @request.auth.municipality',
        updateRule: '@request.auth.id != "" && municipality = @request.auth.municipality',
        deleteRule:
          '@request.auth.id != "" && municipality = @request.auth.municipality && (@request.auth.role = "administrador" || @request.auth.role = "coordenador" || uploaded_by = @request.auth.id)',
        fields: [
          {
            name: 'municipality',
            type: 'relation',
            required: true,
            collectionId: munId,
            maxSelect: 1,
          },
          { name: 'target_collection', type: 'text', required: true },
          { name: 'target_id', type: 'text', required: true },
          {
            name: 'file',
            type: 'file',
            required: true,
            maxSelect: 1,
            maxSize: 104857600, // 100MB para vídeos MP4/MOV e PDFs técnicos
            mimeTypes: [
              'image/jpeg',
              'image/png',
              'image/webp',
              'image/gif',
              'video/mp4',
              'video/quicktime',
              'application/pdf',
            ],
          },
          { name: 'title', type: 'text' },
          { name: 'description', type: 'text' },
          { name: 'capture_date', type: 'date' },
          { name: 'author_name', type: 'text' },
          {
            name: 'category',
            type: 'select',
            required: true,
            values: [
              'vistoria',
              'situacao_inicial',
              'antes_intervencao',
              'durante_obra',
              'depois_conclusao',
              'outros',
            ],
            maxSelect: 1,
          },
          {
            name: 'media_type',
            type: 'select',
            values: ['foto', 'video', 'documento', 'outro'],
            maxSelect: 1,
          },
          { name: 'file_size', type: 'number' },
          { name: 'uploaded_by', type: 'relation', collectionId: usersId, maxSelect: 1 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_rec_att_target ON record_attachments (municipality, target_collection, target_id)',
          'CREATE INDEX idx_rec_att_cat ON record_attachments (municipality, category)',
        ],
      })
      app.save(attachmentsCol)
    }

    // 2. Coleção de ajustes municipais de geometria (Preservando estudo oficial IPT intacto)
    let geoAdjustCol = null
    try {
      geoAdjustCol = app.findCollectionByNameOrId('municipal_geo_adjustments')
    } catch (_) {
      const munId = app.findCollectionByNameOrId('municipalities').id
      const usersId = '_pb_users_auth_'

      geoAdjustCol = new Collection({
        name: 'municipal_geo_adjustments',
        type: 'base',
        listRule: '@request.auth.id != "" && municipality = @request.auth.municipality',
        viewRule: '@request.auth.id != "" && municipality = @request.auth.municipality',
        createRule: '@request.auth.id != "" && municipality = @request.auth.municipality',
        updateRule: '@request.auth.id != "" && municipality = @request.auth.municipality',
        deleteRule:
          '@request.auth.id != "" && municipality = @request.auth.municipality && (@request.auth.role = "administrador" || @request.auth.role = "coordenador")',
        fields: [
          {
            name: 'municipality',
            type: 'relation',
            required: true,
            collectionId: munId,
            maxSelect: 1,
          },
          { name: 'target_collection', type: 'text', required: true },
          { name: 'target_id', type: 'text', required: true },
          { name: 'code', type: 'text' },
          {
            name: 'version_type',
            type: 'select',
            required: true,
            values: ['ajuste_municipal', 'pendente_validacao', 'restaurado_original'],
            maxSelect: 1,
          },
          { name: 'original_geometry_geojson', type: 'text' },
          { name: 'adjusted_geometry_geojson', type: 'text' },
          { name: 'original_risk_level', type: 'text' },
          { name: 'adjusted_risk_level', type: 'text' },
          { name: 'justification', type: 'text', required: true },
          { name: 'author', type: 'relation', collectionId: usersId, maxSelect: 1 },
          { name: 'author_name', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_mga_target ON municipal_geo_adjustments (municipality, target_collection, target_id)',
          'CREATE INDEX idx_mga_code ON municipal_geo_adjustments (municipality, code)',
        ],
      })
      app.save(geoAdjustCol)
    }
  },
  (app) => {
    try {
      const c1 = app.findCollectionByNameOrId('record_attachments')
      app.delete(c1)
    } catch (_) {}
    try {
      const c2 = app.findCollectionByNameOrId('municipal_geo_adjustments')
      app.delete(c2)
    } catch (_) {}
  },
)
