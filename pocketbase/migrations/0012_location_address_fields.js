/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const occCol = app.findCollectionByNameOrId('occurrences')

    // Campos de estruturação de endereço
    if (!occCol.fields.getByName('street')) {
      occCol.fields.add(
        new TextField({
          name: 'street',
          required: false,
        }),
      )
    }

    if (!occCol.fields.getByName('number')) {
      occCol.fields.add(
        new TextField({
          name: 'number',
          required: false,
        }),
      )
    }

    if (!occCol.fields.getByName('neighborhood')) {
      occCol.fields.add(
        new TextField({
          name: 'neighborhood',
          required: false,
        }),
      )
    }

    if (!occCol.fields.getByName('city')) {
      occCol.fields.add(
        new TextField({
          name: 'city',
          required: false,
        }),
      )
    }

    if (!occCol.fields.getByName('state')) {
      occCol.fields.add(
        new TextField({
          name: 'state',
          required: false,
        }),
      )
    }

    if (!occCol.fields.getByName('postal_code')) {
      occCol.fields.add(
        new TextField({
          name: 'postal_code',
          required: false,
        }),
      )
    }

    if (!occCol.fields.getByName('complement')) {
      occCol.fields.add(
        new TextField({
          name: 'complement',
          required: false,
        }),
      )
    }

    if (!occCol.fields.getByName('reference_point')) {
      occCol.fields.add(
        new TextField({
          name: 'reference_point',
          required: false,
        }),
      )
    }

    // Origem da localização capturada
    if (!occCol.fields.getByName('location_origin')) {
      occCol.fields.add(
        new SelectField({
          name: 'location_origin',
          values: ['gps', 'mapa', 'manual', 'cep', 'geocoding', 'importacao'],
          maxSelect: 1,
          required: false,
        }),
      )
    }

    // Precisão estimada do GPS em metros (accuracy)
    if (!occCol.fields.getByName('location_accuracy')) {
      occCol.fields.add(
        new NumberField({
          name: 'location_accuracy',
          required: false,
        }),
      )
    }

    // Situação de confirmação do endereço
    if (!occCol.fields.getByName('address_confirmed')) {
      occCol.fields.add(
        new BoolField({
          name: 'address_confirmed',
          required: false,
        }),
      )
    }

    app.save(occCol)
  },
  (app) => {
    try {
      const occCol = app.findCollectionByNameOrId('occurrences')
      occCol.fields.removeByName('street')
      occCol.fields.removeByName('number')
      occCol.fields.removeByName('neighborhood')
      occCol.fields.removeByName('city')
      occCol.fields.removeByName('state')
      occCol.fields.removeByName('postal_code')
      occCol.fields.removeByName('complement')
      occCol.fields.removeByName('reference_point')
      occCol.fields.removeByName('location_origin')
      occCol.fields.removeByName('location_accuracy')
      occCol.fields.removeByName('address_confirmed')
      app.save(occCol)
    } catch (_) {}
  },
)
