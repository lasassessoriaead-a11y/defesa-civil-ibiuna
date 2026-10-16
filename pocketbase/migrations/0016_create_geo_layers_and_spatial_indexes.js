/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const munCol = app.findCollectionByNameOrId('municipalities')
    const munColId = munCol.id
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const usersColId = usersCol.id

    // 1. geo_layers (Camadas geográficas complementares / dados temáticos oficiais de Ibiúna)
    let geoLayersCol = null
    try {
      geoLayersCol = app.findCollectionByNameOrId('geo_layers')
      const typeField = geoLayersCol.fields.getByName('layer_type')
      if (typeField && !typeField.values.includes('setores_risco')) {
        typeField.values.push('setores_risco')
        typeField.values.push('trechos_perigo')
        app.save(geoLayersCol)
      }
    } catch (_) {
      geoLayersCol = new Collection({
        name: 'geo_layers',
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
            name: 'layer_type',
            type: 'select',
            values: [
              'setores_risco',
              'trechos_perigo',
              'areas_inundacao',
              'areas_avaliacao_risco',
              'compdec_sedes',
              'fotos_setores',
              'hidro_principal',
              'curva_nivel',
              'nivel_atingimento',
              'macrozoneamento_plano_diretor',
              'limite_municipal_buffer',
              'utb_territorial',
              'cadev_historico',
              'outros',
            ],
            maxSelect: 1,
            required: true,
          },
          { name: 'name', type: 'text', required: true },
          { name: 'feature_fid', type: 'text' }, // Identificador único da feição no arquivo de origem (fid / id)
          { name: 'source_file', type: 'text', required: true }, // Nome do arquivo GPKG / KMZ
          { name: 'code', type: 'text' }, // Código ou rótulo técnico se houver (ex: IBI-01/A05/S03)
          { name: 'risk_level', type: 'text' }, // R1, R2, R3, R4 ou classificação
          { name: 'process_type', type: 'text' }, // Enchente, escorregamento, etc.
          { name: 'geometry_type', type: 'text' }, // Point, LineString, Polygon, MultiPolygon...
          { name: 'geometry_geojson', type: 'text', required: true }, // GeoJSON EPSG:4326 em texto
          { name: 'min_zoom', type: 'number', onlyInt: true }, // Zoom mínimo para renderização no mapa (ex: 14 para curvas de nível)
          { name: 'bbox_min_lat', type: 'number' },
          { name: 'bbox_max_lat', type: 'number' },
          { name: 'bbox_min_lon', type: 'number' },
          { name: 'bbox_max_lon', type: 'number' },
          { name: 'properties', type: 'json' }, // Atributos fiéis originais da tabela de origem
          { name: 'dedup_key', type: 'text', required: true }, // Chave de idempotência: source_file + '_' + feature_fid
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_geo_layer_dedup ON geo_layers (municipality, dedup_key)',
          'CREATE INDEX idx_geo_layer_mun_type ON geo_layers (municipality, layer_type)',
          'CREATE INDEX idx_geo_layer_source ON geo_layers (municipality, source_file)',
          'CREATE INDEX idx_geo_layer_code ON geo_layers (municipality, code)',
        ],
      })
      app.save(geoLayersCol)
    }

    // 2. Garantir campos adicionais em risk_sectors e danger_stretches caso não existam
    try {
      const rsCol = app.findCollectionByNameOrId('risk_sectors')
      let changed = false
      if (!rsCol.fields.getByName('dedup_key')) {
        rsCol.fields.add(
          new TextField({
            name: 'dedup_key',
          }),
        )
        changed = true
      }
      if (changed) {
        app.save(rsCol)
      }
    } catch (_) {}

    try {
      const dsCol = app.findCollectionByNameOrId('danger_stretches')
      let changedDs = false
      if (!dsCol.fields.getByName('dedup_key')) {
        dsCol.fields.add(
          new TextField({
            name: 'dedup_key',
          }),
        )
        changedDs = true
      }
      if (changedDs) {
        app.save(dsCol)
      }
    } catch (_) {}
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('geo_layers')
      app.delete(col)
    } catch (_) {}
  },
)
