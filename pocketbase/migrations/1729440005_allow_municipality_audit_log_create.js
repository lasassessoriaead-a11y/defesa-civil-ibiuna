migrate(
  (app) => {
    // Atualizar regra createRule de audit_log para permitir gravação por usuários autenticados da própria prefeitura
    const auditCol = app.findCollectionByNameOrId('audit_log')
    auditCol.createRule = '@request.auth.id != "" && municipality = @request.auth.municipality'
    app.save(auditCol)
  },
  (app) => {
    const auditCol = app.findCollectionByNameOrId('audit_log')
    auditCol.createRule = null
    app.save(auditCol)
  },
)
