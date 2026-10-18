/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const munId = 'cw9b6e2pqv89i3p'

    // Deduplicação cirúrgica e segura na coleção strategic_infrastructures para o município de Ibiúna
    // Regra:
    // 1. Grupos idênticos com mesma chave composta: (municipality + source_document + source_page + original_code)
    // 2. Coordenadas idênticas
    // 3. Mantém SEMPRE o registro mais antigo (MIN(created) / id mais antigo do lote original 23:07:20)
    // 4. Remove cirurgicamente apenas os IDs duplicados criados na reexecução (23:10:10)
    // 5. Preserva todos os códigos distintos (P117-A/B, P201-A/B, P158 vs P158/2 vs P158', P145 vs P145', etc.)
    // 6. Atualiza verification_notes no registro preservado documentando a auditoria

    const duplicateIds = ['139l315lnkmfnky', '4vepk2hz47c7fnw', 's80ehz6cuf1fkn3']
    const preservedMapping = [
      {
        id: 'v0t946o7qg7t4nd',
        code: "P145'",
        note: 'Deduplicação auditada: duplicata 139l315lnkmfnky removida com sucesso. Registro original v0t946o7qg7t4nd preservado.',
      },
      {
        id: '2ms2vung6mmud28',
        code: "P158'",
        note: 'Deduplicação auditada: duplicata 4vepk2hz47c7fnw removida com sucesso. Registro original 2ms2vung6mmud28 preservado.',
      },
      {
        id: '6vakmkw7wbt5rc2',
        code: "P191'",
        note: 'Deduplicação auditada: duplicata s80ehz6cuf1fkn3 removida com sucesso. Registro original 6vakmkw7wbt5rc2 preservado.',
      },
    ]

    // 1. Remover cirurgicamente apenas os duplicados verificados de Ibiúna
    for (let i = 0; i < duplicateIds.length; i++) {
      const dupId = duplicateIds[i]
      try {
        const dupRecord = app.findRecordById('strategic_infrastructures', dupId)
        if (
          dupRecord &&
          dupRecord.getString('municipality') === munId &&
          dupRecord.getString('source_document') === 'Pontes e aduelas-21295.pdf'
        ) {
          app.delete(dupRecord)
        }
      } catch (_) {
        // Se já não existir, segue normalmente de forma idempotente
      }
    }

    // 2. Anotar no campo verification_notes dos registros originais preservados
    for (let i = 0; i < preservedMapping.length; i++) {
      const item = preservedMapping[i]
      try {
        const origRecord = app.findRecordById('strategic_infrastructures', item.id)
        if (origRecord && origRecord.getString('municipality') === munId) {
          origRecord.set('verification_notes', item.note)
          app.save(origRecord)
        }
      } catch (_) {}
    }
  },
  (app) => {
    // Reversibilidade: recria os 3 registros excluídos caso seja necessário reverter a migração
    const munId = 'cw9b6e2pqv89i3p'
    let col = null
    try {
      col = app.findCollectionByNameOrId('strategic_infrastructures')
    } catch (_) {
      return
    }

    const restoreRecords = [
      {
        id: '139l315lnkmfnky',
        original_code: "P145'",
        source_document: 'Pontes e aduelas-21295.pdf',
        source_page: 4,
        lat_dms: '23°37\'6.15"S',
        lon_dms: '47°13\'6.95"O',
        latitude: -23.618375,
        longitude: -47.218597,
        coordinate_status: 'valida',
        validation_status: 'pendente_conferencia',
        type: 'pendente_classificacao',
        neighborhood: 'Il Córregos',
        notes: "Notação P145' com apóstrofo no original",
        is_handwritten_transcription: true,
        structural_condition: 'nao_avaliado',
        administrative_priority: 'media',
        inspection_status: 'necessita_vistoria',
      },
      {
        id: '4vepk2hz47c7fnw',
        original_code: "P158'",
        source_document: 'Pontes e aduelas-21295.pdf',
        source_page: 4,
        lat_dms: '23°40\'50.56"S',
        lon_dms: '47°11\'29.51"O',
        latitude: -23.680711,
        longitude: -47.191531,
        coordinate_status: 'valida',
        validation_status: 'pendente_conferencia',
        type: 'pendente_classificacao',
        neighborhood: 'Tavares',
        notes: "P158' com apóstrofo",
        is_handwritten_transcription: true,
        structural_condition: 'nao_avaliado',
        administrative_priority: 'media',
        inspection_status: 'necessita_vistoria',
      },
      {
        id: 's80ehz6cuf1fkn3',
        original_code: "P191'",
        source_document: 'Pontes e aduelas-21295.pdf',
        source_page: 4,
        lat_dms: '23°38\'33.13"S',
        lon_dms: '47°9\'12.99"O',
        latitude: -23.642536,
        longitude: -47.153608,
        coordinate_status: 'valida',
        validation_status: 'pendente_conferencia',
        type: 'pendente_classificacao',
        neighborhood: '',
        dimensions: 'L.P. 645 Comp. 1600mg / 2-R. 720g/4P330',
        notes: 'Anotações manuscritas de vão e ferragem',
        is_handwritten_transcription: true,
        structural_condition: 'nao_avaliado',
        administrative_priority: 'media',
        inspection_status: 'necessita_vistoria',
      },
    ]

    for (let i = 0; i < restoreRecords.length; i++) {
      const row = restoreRecords[i]
      try {
        const record = new Record(col)
        record.set('id', row.id)
        record.set('municipality', munId)
        record.set('original_code', row.original_code)
        record.set('source_document', row.source_document)
        record.set('source_page', row.source_page)
        record.set('lat_dms', row.lat_dms)
        record.set('lon_dms', row.lon_dms)
        record.set('latitude', row.latitude)
        record.set('longitude', row.longitude)
        record.set('coordinate_status', row.coordinate_status)
        record.set('validation_status', row.validation_status)
        record.set('type', row.type)
        record.set('neighborhood', row.neighborhood)
        if (row.dimensions) record.set('dimensions', row.dimensions)
        if (row.notes) record.set('notes', row.notes)
        record.set('is_handwritten_transcription', row.is_handwritten_transcription)
        record.set('structural_condition', row.structural_condition)
        record.set('administrative_priority', row.administrative_priority)
        record.set('inspection_status', row.inspection_status)
        app.save(record)
      } catch (_) {}
    }
  },
)
