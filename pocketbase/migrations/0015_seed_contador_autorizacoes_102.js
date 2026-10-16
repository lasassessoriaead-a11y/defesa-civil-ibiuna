/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    try {
      const munCol = app.findCollectionByNameOrId('municipalities')
      const docCountersCol = app.findCollectionByNameOrId('document_counters')
      const currentYear = new Date().getFullYear()

      // Buscar todos os municípios e garantir que o contador de autorizacao inicie em 101 se estiver vazio
      const munRecords = app.findRecordsByFilter('municipalities', "id != ''")
      for (let i = 0; i < munRecords.length; i++) {
        const mId = munRecords[i].id
        try {
          const counter = app.findFirstRecordByFilter(
            'document_counters',
            "municipality = '" + mId + "' && type = 'autorizacao' && year = " + currentYear,
          )
          if (counter && counter.getInt('last_number') < 101) {
            counter.set('last_number', 101)
            app.save(counter)
          }
        } catch (_) {
          const newCounter = new Record(docCountersCol)
          newCounter.set('municipality', mId)
          newCounter.set('type', 'autorizacao')
          newCounter.set('year', currentYear)
          newCounter.set('last_number', 101)
          app.save(newCounter)
        }
      }
    } catch (e) {
      console.log('Seed contador autorizacao 102:', e.message)
    }
  },
  () => {},
)
