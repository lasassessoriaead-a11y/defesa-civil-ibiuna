/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const munId = 'cw9b6e2pqv89i3p'

    // 1. Ampliar regras de API para usuários autenticados da própria prefeitura
    // (evita que operadores e técnicos sejam bloqueados ao vincular geometrias ou gravar auditoria)
    const collectionsToUpdate = [
      'risk_sectors',
      'danger_stretches',
      'geo_layers',
      'geo_imports',
      'strategic_infrastructures',
    ]

    for (let i = 0; i < collectionsToUpdate.length; i++) {
      try {
        const col = app.findCollectionByNameOrId(collectionsToUpdate[i])
        if (col) {
          // Permite que qualquer usuário autenticado da mesma prefeitura possa consultar e atualizar
          col.listRule = '@request.auth.id != "" && municipality = @request.auth.municipality'
          col.viewRule = '@request.auth.id != "" && municipality = @request.auth.municipality'
          col.createRule = '@request.auth.id != "" && municipality = @request.auth.municipality'
          col.updateRule = '@request.auth.id != "" && municipality = @request.auth.municipality'
          app.save(col)
        }
      } catch (err) {
        console.log('Aviso ao ajustar regras da colecao ' + collectionsToUpdate[i] + ':', err)
      }
    }

    // 2. ITEM 1: Cadastrar a ponte na Estrada Municipal Ciro Conceição Vieira de Pontes
    // Coordenadas: lat -23.78428, lon -47.22237
    // Verifica primeiro se já existe por coordenadas próximas ou código
    let existingBridge = null
    try {
      const records = app.findRecordsByFilter(
        'strategic_infrastructures',
        'municipality = "' +
          munId +
          '" && (original_code = "PM-001" || (latitude >= -23.78435 && latitude <= -23.78420 && longitude >= -47.22245 && longitude <= -47.22230))',
        '-created',
        1,
      )
      if (records && records.length > 0) {
        existingBridge = records[0]
      }
    } catch (_) {}

    if (!existingBridge) {
      try {
        const infraCol = app.findCollectionByNameOrId('strategic_infrastructures')
        const newRecord = new Record(infraCol)
        newRecord.set('municipality', munId)
        newRecord.set('original_code', 'PM-001')
        newRecord.set('structure_type', 'ponte')
        newRecord.set('type', 'ponte')
        newRecord.set('latitude', -23.78428)
        newRecord.set('longitude', -47.22237)
        newRecord.set('lat_dms', '23°47\'03.4"S')
        newRecord.set('lon_dms', '47°13\'20.5"O')
        newRecord.set('coordinate_status', 'valida')
        newRecord.set('validation_status', 'pendente_conferencia')
        newRecord.set('structural_condition', 'nao_avaliado')
        newRecord.set('inspection_status', 'necessita_vistoria')
        newRecord.set('administrative_priority', 'media')
        newRecord.set('neighborhood', 'Estrada Municipal Ciro Conceição Vieira de Pontes')
        newRecord.set(
          'reference_point',
          'Estrada Municipal Ciro Conceição Vieira de Pontes, Ibiúna-SP, CEP 18150-000',
        )
        newRecord.set('source_document', 'Levantamento Municipal — Cadastro Externo')
        newRecord.set('source_page', 1)
        newRecord.set(
          'notes',
          'Cadastro municipal de travessia informado via coordenadas externas (-23.78428, -47.22237). Dimensões e condição estrutural pendentes de vistoria.',
        )
        app.save(newRecord)
      } catch (err) {
        console.log('Erro ao cadastrar ponte PM-001:', err)
      }
    }

    // 3. ITEM 2: Gravação idempotente das geometrias IPT no banco
    // Baixar o arquivo GeoJSON oficial do URL anexado e vincular aos registros de risk_sectors e danger_stretches
    try {
      const geoUrl =
        'https://dagtlwojkqyivnjgveda.supabase.co/storage/v1/object/public/message-attachments/d7da4d7c-f633-4746-92db-82122756b9e1/ibiunaiptsetoresetrechosgeojson-bad52.json'

      const res = $http.send({
        url: geoUrl,
        method: 'GET',
        timeout: 90,
      })

      if (res && res.statusCode === 200 && res.raw) {
        const parsed = JSON.parse(res.raw)
        const features = parsed.features || []
        console.log('GeoJSON IPT baixado com sucesso no servidor. Feições:', features.length)

        // Normalizador de código
        const normalizeCode = (c) => {
          if (!c) return ''
          return c
            .trim()
            .toUpperCase()
            .replace(/\s+/g, '')
            .replace(/–/g, '-')
            .replace(/—/g, '-')
            .replace(/_+/g, '-')
        }

        // Cache de setores e trechos do município
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

        const sectorMap = {}
        for (let s = 0; s < sectorRecords.length; s++) {
          const rec = sectorRecords[s]
          const code = normalizeCode(rec.getString('code'))
          if (code) sectorMap[code] = rec
        }

        const stretchMap = {}
        for (let st = 0; st < stretchRecords.length; st++) {
          const rec = stretchRecords[st]
          const code = normalizeCode(rec.getString('code'))
          if (code) {
            // Se já existir (caso T01 com 2 registros), guarda lista
            if (!stretchMap[code]) stretchMap[code] = []
            stretchMap[code].push(rec)
          }
        }

        let sectorsLinked = 0
        let stretchesLinked = 0

        for (let f = 0; f < features.length; f++) {
          const feat = features[f]
          const props = feat.properties || {}
          const geom = feat.geometry
          if (!geom) continue

          const geomStr = JSON.stringify(geom)
          const kind = props.kind || (props.process === 'ENX' ? 'trecho' : 'setor')
          const rawCode =
            props.code ||
            props.codigo ||
            props.CD_SETOR ||
            props.cd_setor ||
            props.COD_TRECHO ||
            props.cod_trecho ||
            props.id ||
            ''
          const normCode = normalizeCode(rawCode)

          if (kind === 'setor' || geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
            const match = sectorMap[normCode]
            if (match) {
              match.set('geometry_geojson', geomStr)
              match.set('geometry_status', 'vinculada')
              match.set('geometry_source', 'ipt_geojson_oficial')
              app.save(match)
              sectorsLinked++
            }
          } else {
            const matches = stretchMap[normCode]
            if (matches && matches.length > 0) {
              for (let m = 0; m < matches.length; m++) {
                const stretchRec = matches[m]
                stretchRec.set('geometry_geojson', geomStr)
                stretchRec.set('geometry_status', 'vinculada')
                stretchRec.set('geometry_source', 'ipt_geojson_oficial')
                app.save(stretchRec)
              }
              stretchesLinked++
            }
          }
        }

        console.log(
          'Vínculo de geometrias IPT concluído: ' +
            sectorsLinked +
            ' setores e ' +
            stretchesLinked +
            ' trechos vinculados.',
        )
      } else {
        console.log(
          'Falha ao baixar GeoJSON pelo servidor. Status:',
          res ? res.statusCode : 'sem resposta',
        )
      }
    } catch (geoErr) {
      console.log('Aviso ao processar GeoJSON no servidor:', geoErr)
    }
  },
  (app) => {
    // Reversão
    try {
      const records = app.findRecordsByFilter(
        'strategic_infrastructures',
        'original_code = "PM-001"',
        '-created',
        1,
      )
      if (records && records.length > 0) {
        app.delete(records[0])
      }
    } catch (_) {}
  },
)
