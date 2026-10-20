migrate(
  (app) => {
    // 1. Atualizar regras de acesso de document_counters para permitir que usuários autenticados da mesma prefeitura consultem e manipulem
    const docCountersCol = app.findCollectionByNameOrId('document_counters')
    docCountersCol.listRule = '@request.auth.id != "" && municipality = @request.auth.municipality'
    docCountersCol.viewRule = '@request.auth.id != "" && municipality = @request.auth.municipality'
    docCountersCol.createRule =
      '@request.auth.id != "" && municipality = @request.auth.municipality'
    docCountersCol.updateRule =
      '@request.auth.id != "" && municipality = @request.auth.municipality'
    docCountersCol.deleteRule =
      '@request.auth.id != "" && municipality = @request.auth.municipality && (@request.auth.role = "administrador" || @request.auth.role = "coordenador")'
    app.save(docCountersCol)

    // 2. Garantir regras de acesso em doc_templates para usuários autenticados da prefeitura
    const docTemplatesCol = app.findCollectionByNameOrId('doc_templates')
    docTemplatesCol.listRule = '@request.auth.id != "" && municipality = @request.auth.municipality'
    docTemplatesCol.viewRule = '@request.auth.id != "" && municipality = @request.auth.municipality'
    docTemplatesCol.createRule =
      '@request.auth.id != "" && municipality = @request.auth.municipality'
    docTemplatesCol.updateRule =
      '@request.auth.id != "" && municipality = @request.auth.municipality'
    docTemplatesCol.deleteRule =
      '@request.auth.id != "" && municipality = @request.auth.municipality && (@request.auth.role = "administrador" || @request.auth.role = "coordenador")'
    app.save(docTemplatesCol)

    // 3. Inicializar contador para tipo 'oficio' (0 ou não existente)
    // Usamos raw SQL INSERT se não existir, evitando a validação de required=true que em PocketBase rejeita 0 numérico no model
    const year = new Date().getFullYear()
    const munRecords = app.findRecordsByFilter('municipalities', "id != ''", 'created', 100, 0)

    for (let i = 0; i < munRecords.length; i++) {
      const munId = munRecords[i].id
      let exists = false
      try {
        const found = app.findFirstRecordByFilter(
          'document_counters',
          "municipality = '" + munId + "' && type = 'oficio' && year = " + year,
        )
        if (found) exists = true
      } catch (_) {
        exists = false
      }

      if (!exists) {
        // Criamos via Record se last_number > 0, ou inserimos via SQL para permitir 0 inicial de forma segura
        const id = $security.randomString(15)
        const now = new Date().toISOString().replace('T', ' ').replace('Z', '')
        app
          .db()
          .newQuery(
            'INSERT INTO document_counters (id, municipality, type, year, last_number, created, updated) VALUES ({:id}, {:mun}, {:type}, {:year}, {:last_num}, {:created}, {:updated})',
          )
          .bind({
            id: id,
            mun: munId,
            type: 'oficio',
            year: year,
            last_num: 0,
            created: now,
            updated: now,
          })
          .execute()
      }
    }
  },
  (app) => {
    try {
      const docCountersCol = app.findCollectionByNameOrId('document_counters')
      docCountersCol.listRule = null
      docCountersCol.viewRule = null
      docCountersCol.createRule = null
      docCountersCol.updateRule = null
      docCountersCol.deleteRule = null
      app.save(docCountersCol)
    } catch (_) {}
  },
)
