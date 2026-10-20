migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')

    // 1. Adicionar campo 'is_active' (booleano opcional, padrão true)
    // No PocketBase (SQLite), bool fields nunca devem ser 'required' para não rejeitar 'false'
    if (!usersCol.fields.getByName('is_active')) {
      usersCol.fields.add(
        new BoolField({
          name: 'is_active',
          required: false,
        }),
      )
    }

    // 2. Proteger createRule:
    // Nunca permitir criação pública anônima.
    // createRule = null (apenas superusuário / backend hooks autenticados)
    // ou apenas administrador autenticado.
    // O usuário solicitou textualmente:
    // "Não transforme meu usuário em superusuário, não coloque credenciais administrativas no frontend e não libere a coleção publicamente."
    // O hook no backend rodará operações administrativas autenticadas pelo Administrador municipal.
    // Portanto, fechamos a createRule pública da coleção users:
    usersCol.createRule = null

    // 3. Garantir listRule, viewRule, updateRule e deleteRule com isolamento estrito
    usersCol.listRule =
      "@request.auth.id != '' && (id = @request.auth.id || (municipality = @request.auth.municipality && (@request.auth.role = 'administrador' || @request.auth.role = 'coordenador')))"
    usersCol.viewRule =
      "@request.auth.id != '' && (id = @request.auth.id || (municipality = @request.auth.municipality && (@request.auth.role = 'administrador' || @request.auth.role = 'coordenador')))"
    usersCol.updateRule =
      "@request.auth.id != '' && ((id = @request.auth.id && @request.body.role:changed = false && @request.body.municipality:changed = false) || (@request.auth.role = 'administrador' && municipality = @request.auth.municipality))"
    usersCol.deleteRule =
      "@request.auth.id != '' && @request.auth.role = 'administrador' && municipality = @request.auth.municipality && id != @request.auth.id"

    app.save(usersCol)

    // Backfill: marcar usuários existentes como is_active = true
    try {
      app.db().newQuery('UPDATE users SET is_active = 1 WHERE is_active IS NULL').execute()
    } catch (_) {}
  },
  (app) => {
    // Reverter
    try {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      const activeField = usersCol.fields.getByName('is_active')
      if (activeField) {
        usersCol.fields.removeByName('is_active')
        app.save(usersCol)
      }
    } catch (_) {}
  },
)
