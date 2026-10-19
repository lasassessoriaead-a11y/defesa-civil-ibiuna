/// <reference path="../pb_data/types.d.ts" />

migrate(
  (app) => {
    // Atualiza valores permitidos de geometry_status para incluir 'vinculada' em risk_sectors e danger_stretches
    const updateCollectionStatus = (collectionName) => {
      try {
        const col = app.findCollectionByNameOrId(collectionName)
        const field = col.fields.getByName('geometry_status')
        if (field) {
          const currentVals = field.values || []
          if (!currentVals.includes('vinculada')) {
            field.values = Array.from(new Set([...currentVals, 'vinculada']))
            app.save(col)
          }
        }
      } catch (e) {
        console.log(
          `[migration 0015] Info: collection ${collectionName} geometry_status update:`,
          e,
        )
      }
    }

    updateCollectionStatus('risk_sectors')
    updateCollectionStatus('danger_stretches')
  },
  (app) => {
    // Revert: manter 'ausente', 'pendente', 'validada', 'invalida'
    const revertCollectionStatus = (collectionName) => {
      try {
        const col = app.findCollectionByNameOrId(collectionName)
        const field = col.fields.getByName('geometry_status')
        if (field) {
          field.values = ['ausente', 'pendente', 'validada', 'invalida']
          app.save(col)
        }
      } catch (_) {}
    }
    revertCollectionStatus('risk_sectors')
    revertCollectionStatus('danger_stretches')
  },
)
