/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. occurrences: Adicionar client_uuid, sync_status e prov_code
    const occCol = app.findCollectionByNameOrId('occurrences')
    if (!occCol.fields.getByName('client_uuid')) {
      occCol.fields.add(
        new TextField({
          name: 'client_uuid',
          required: false,
        }),
      )
    }
    if (!occCol.fields.getByName('prov_code')) {
      occCol.fields.add(
        new TextField({
          name: 'prov_code',
          required: false,
        }),
      )
    }
    if (!occCol.fields.getByName('sync_status')) {
      occCol.fields.add(
        new SelectField({
          name: 'sync_status',
          values: ['synced', 'pending'],
          maxSelect: 1,
          required: false,
        }),
      )
    }
    app.save(occCol)

    // Índice único parcial para deduplicação idempotente de ocorrências
    try {
      occCol.addIndex(
        'idx_occ_client_uuid_mun',
        true,
        'client_uuid, municipality',
        'client_uuid != "" AND client_uuid IS NOT NULL',
      )
      app.save(occCol)
    } catch (eIdx) {
      console.log('[Migration 0011 Index Error occ]:', eIdx.message)
    }

    // 2. requesters: Adicionar client_uuid para idempotência na sincronização offline
    const reqCol = app.findCollectionByNameOrId('requesters')
    if (!reqCol.fields.getByName('client_uuid')) {
      reqCol.fields.add(
        new TextField({
          name: 'client_uuid',
          required: false,
        }),
      )
      app.save(reqCol)
    }

    // 3. occurrence_files: Adicionar client_uuid para upload de foto idempotente
    const filesCol = app.findCollectionByNameOrId('occurrence_files')
    if (!filesCol.fields.getByName('client_uuid')) {
      filesCol.fields.add(
        new TextField({
          name: 'client_uuid',
          required: false,
        }),
      )
      app.save(filesCol)
    }

    // 4. tree_authorizations: Adicionar client_uuid e prov_code
    const treeCol = app.findCollectionByNameOrId('tree_authorizations')
    if (!treeCol.fields.getByName('client_uuid')) {
      treeCol.fields.add(
        new TextField({
          name: 'client_uuid',
          required: false,
        }),
      )
    }
    if (!treeCol.fields.getByName('prov_code')) {
      treeCol.fields.add(
        new TextField({
          name: 'prov_code',
          required: false,
        }),
      )
    }
    app.save(treeCol)

    // 5. official_documents: Adicionar client_uuid
    const docCol = app.findCollectionByNameOrId('official_documents')
    if (!docCol.fields.getByName('client_uuid')) {
      docCol.fields.add(
        new TextField({
          name: 'client_uuid',
          required: false,
        }),
      )
      app.save(docCol)
    }
  },
  (app) => {
    try {
      const occCol = app.findCollectionByNameOrId('occurrences')
      occCol.removeIndex('idx_occ_client_uuid_mun')
      occCol.fields.removeByName('client_uuid')
      occCol.fields.removeByName('prov_code')
      occCol.fields.removeByName('sync_status')
      app.save(occCol)
    } catch (_) {}

    try {
      const reqCol = app.findCollectionByNameOrId('requesters')
      reqCol.fields.removeByName('client_uuid')
      app.save(reqCol)
    } catch (_) {}

    try {
      const filesCol = app.findCollectionByNameOrId('occurrence_files')
      filesCol.fields.removeByName('client_uuid')
      app.save(filesCol)
    } catch (_) {}

    try {
      const treeCol = app.findCollectionByNameOrId('tree_authorizations')
      treeCol.fields.removeByName('client_uuid')
      treeCol.fields.removeByName('prov_code')
      app.save(treeCol)
    } catch (_) {}

    try {
      const docCol = app.findCollectionByNameOrId('official_documents')
      docCol.fields.removeByName('client_uuid')
      app.save(docCol)
    } catch (_) {}
  },
)
