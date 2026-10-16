/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    try {
      const geoLayersCol = app.findCollectionByNameOrId('geo_layers')
      const typeField = geoLayersCol.fields.getByName('layer_type')
      if (typeField) {
        let changed = false
        if (!typeField.values.includes('setores_risco')) {
          typeField.values.push('setores_risco')
          changed = true
        }
        if (!typeField.values.includes('trechos_perigo')) {
          typeField.values.push('trechos_perigo')
          changed = true
        }
        if (changed) {
          app.save(geoLayersCol)
        }
      }
    } catch (_) {}
  },
  () => {},
)
