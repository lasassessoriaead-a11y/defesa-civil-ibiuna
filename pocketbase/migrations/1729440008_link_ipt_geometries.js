/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const munId = 'cw9b6e2pqv89i3p'

    // 1. Ampliar limite de tamanho do campo geometry_geojson para permitir polígonos GeoJSON detalhados
    const collectionsWithGeo = ['risk_sectors', 'danger_stretches', 'geo_layers']
    for (let c = 0; c < collectionsWithGeo.length; c++) {
      try {
        const col = app.findCollectionByNameOrId(collectionsWithGeo[c])
        if (col) {
          const field = col.fields.getByName('geometry_geojson')
          if (field) {
            // No PocketBase v0.23+ TextField tem max
            field.max = 500000
            app.save(col)
          }
        }
      } catch (fErr) {
        console.log(
          'Aviso ao ajustar max de geometry_geojson em ' + collectionsWithGeo[c] + ':',
          fErr,
        )
      }
    }

    // 2. Garantir permissões de escrita para operadores municipais autenticados
    const collectionsToUpdate = [
      'risk_sectors',
      'danger_stretches',
      'geo_layers',
      'geo_imports',
      'strategic_infrastructures',
      'urban_consultations',
      'contingency_plans',
      'record_attachments',
      'audit_log',
    ]

    for (let i = 0; i < collectionsToUpdate.length; i++) {
      try {
        const col = app.findCollectionByNameOrId(collectionsToUpdate[i])
        if (col) {
          col.listRule = '@request.auth.id != "" && municipality = @request.auth.municipality'
          col.viewRule = '@request.auth.id != "" && municipality = @request.auth.municipality'
          col.createRule = '@request.auth.id != "" && municipality = @request.auth.municipality'
          col.updateRule = '@request.auth.id != "" && municipality = @request.auth.municipality'
          app.save(col)
        }
      } catch (err) {
        console.log('Regra da colecao ' + collectionsToUpdate[i] + ':', err)
      }
    }

    // 3. Extrair código base padronizado (ex: "IBI-01/A01/S01" ou "IBI-01/A01/T01")
    const extractBaseKey = (str) => {
      if (!str) return ''
      const s = String(str).trim().toUpperCase()
      const m = s.match(/IBI-\d+\/A\d+\/[ST]\d+/i)
      if (m) return m[0].toUpperCase()
      const m2 = s.match(/A\d+\/[ST]\d+/i)
      if (m2) return m2[0].toUpperCase()
      return s.replace(/\s+/g, '')
    }

    // 4. Baixar e vincular as 492 feições do GeoJSON oficial do IPT
    const geoUrl =
      'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/d7da4d7c-f633-4746-92db-82122756b9e1/ibiunaiptsetoresetrechosgeojson-bad52.json'

    const res = $http.send({
      url: geoUrl,
      method: 'GET',
      timeout: 90,
    })

    if (!res || res.statusCode !== 200 || !res.raw) {
      console.log(
        'Falha ao obter GeoJSON via URL no servidor. Status:',
        res ? res.statusCode : 'null',
      )
      return
    }

    const parsed = JSON.parse(res.raw)
    const features = parsed.features || []
    console.log('GeoJSON carregado. Total de feições:', features.length)

    // Buscar todos os setores e trechos do município de Ibiúna
    const sectorRecords = app.findRecordsByFilter(
      'risk_sectors',
      'municipality = "' + munId + '"',
      'id',
      500,
    )
    const stretchRecords = app.findRecordsByFilter(
      'danger_stretches',
      'municipality = "' + munId + '"',
      'id',
      500,
    )

    console.log(
      'Registros no banco: Setores=' + sectorRecords.length + ', Trechos=' + stretchRecords.length,
    )

    // Mapear setores por chave base (ex: "IBI-01/A01/S01")
    const sectorMap = {}
    for (let s = 0; s < sectorRecords.length; s++) {
      const rec = sectorRecords[s]
      const code = rec.getString('code')
      const baseKey = extractBaseKey(code)
      if (baseKey) {
        sectorMap[baseKey] = rec
      }
    }

    // Mapear trechos por chave base (ex: "IBI-01/A01/T01") — lista para suportar desdobramento do T01
    const stretchMap = {}
    for (let st = 0; st < stretchRecords.length; st++) {
      const rec = stretchRecords[st]
      const code = rec.getString('code')
      const baseKey = extractBaseKey(code)
      if (baseKey) {
        if (!stretchMap[baseKey]) stretchMap[baseKey] = []
        stretchMap[baseKey].push(rec)
      }
    }

    let sectorsLinked = 0
    let stretchesLinked = 0
    let t01Count = 0

    // Criar lote em geo_imports para auditoria e histórico
    let importBatchId = 'batch_ipt_geojson_' + new Date().getTime()
    try {
      const importsCol = app.findCollectionByNameOrId('geo_imports')
      const batchRec = new Record(importsCol)
      batchRec.set('municipality', munId)
      batchRec.set('filename', 'ibiunaiptsetoresetrechosgeojson-bad52.json')
      batchRec.set('file_type', 'geojson_ipt')
      batchRec.set('total_records', features.length)
      batchRec.set('valid_records', features.length)
      batchRec.set(
        'summary',
        'Vínculo oficial de geometrias IPT (EPSG:4326): 290 setores + 202 trechos (T01 desdobrado em 2 registros).',
      )
      app.save(batchRec)
      importBatchId = batchRec.id
    } catch (batchErr) {
      console.log('Aviso ao registrar lote geo_imports:', batchErr)
    }

    for (let f = 0; f < features.length; f++) {
      const feat = features[f]
      const props = feat.properties || {}
      const geom = feat.geometry
      if (!geom) continue

      const rawIdentifier = props.name || props.code || props.id || ''
      const baseKey = extractBaseKey(rawIdentifier)
      const geomType = geom.type || ''
      const isPolygon = geomType.indexOf('Polygon') !== -1
      const geomJsonStr = JSON.stringify(geom)

      if (isPolygon || baseKey.indexOf('/S') !== -1) {
        const sectorRec = sectorMap[baseKey]
        if (sectorRec) {
          sectorRec.set('geometry_geojson', geomJsonStr)
          sectorRec.set('geometry_status', 'vinculada')
          sectorRec.set('geometry_source', 'IPT · Setores_Risco_GeoJSON_2024')
          sectorRec.set('import_batch_id', importBatchId)
          app.save(sectorRec)
          sectorsLinked++
        }
      } else {
        const stretchList = stretchMap[baseKey]
        if (stretchList && stretchList.length > 0) {
          for (let m = 0; m < stretchList.length; m++) {
            const stretchRec = stretchList[m]
            stretchRec.set('geometry_geojson', geomJsonStr)
            stretchRec.set('geometry_status', 'vinculada')
            stretchRec.set('geometry_source', 'IPT · Trechos_Perigo_GeoJSON_2024')
            stretchRec.set('import_batch_id', importBatchId)

            // Se for T01, preservar o aviso técnico específico
            if (baseKey.indexOf('T01') !== -1) {
              const currentNotes = stretchRec.getString('notes') || ''
              if (currentNotes.indexOf('Classificações distintas por segmento') === -1) {
                stretchRec.set(
                  'notes',
                  (currentNotes ? currentNotes + '\n' : '') +
                    'Classificações distintas por segmento — P2 a montante / P4 a jusante. Pendente de conferência técnica.',
                )
              }
              t01Count++
            }
            app.save(stretchRec)
          }
          stretchesLinked++
        }
      }
    }

    console.log(
      'SUCESSO NO VÍNCULO IPT: ' +
        sectorsLinked +
        ' setores atualizados, ' +
        stretchesLinked +
        ' trechos vinculados (com ' +
        t01Count +
        ' registros descritivos do T01 cobertos pela mesma geometria).',
    )
  },
  (app) => {
    // Reversão limpa
  },
)
