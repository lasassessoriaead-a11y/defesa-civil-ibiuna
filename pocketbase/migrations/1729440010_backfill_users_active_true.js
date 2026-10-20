migrate(
  (app) => {
    // Definir is_active = true para os registros existentes
    try {
      app
        .db()
        .newQuery('UPDATE users SET is_active = 1 WHERE is_active = 0 OR is_active IS NULL')
        .execute()
    } catch (err) {
      console.log('[Backfill is_active error]', err.message)
    }
  },
  (app) => {},
)
