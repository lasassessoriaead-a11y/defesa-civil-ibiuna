/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    // 1. users:
    // Administrador do mesmo município pode listar usuários do município.
    // Usuário pode ver/atualizar o seu próprio perfil, mas NÃO pode alterar seu próprio role ou municipality.
    // Administrador pode atualizar usuários do seu município.
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    usersCol.listRule =
      "@request.auth.id != '' && (id = @request.auth.id || (municipality = @request.auth.municipality && (@request.auth.role = 'administrador' || @request.auth.role = 'coordenador')))"
    usersCol.viewRule =
      "@request.auth.id != '' && (id = @request.auth.id || (municipality = @request.auth.municipality && (@request.auth.role = 'administrador' || @request.auth.role = 'coordenador')))"
    // Atualização: se for o próprio usuário, não pode alterar role nem municipality. Se for administrador do mesmo município, pode alterar.
    usersCol.updateRule =
      "@request.auth.id != '' && ((id = @request.auth.id && @request.body.role:changed = false && @request.body.municipality:changed = false) || (@request.auth.role = 'administrador' && municipality = @request.auth.municipality))"
    usersCol.deleteRule =
      "@request.auth.id != '' && @request.auth.role = 'administrador' && municipality = @request.auth.municipality && id != @request.auth.id"
    app.save(usersCol)

    // 2. occurrences:
    // Isolamento por municipality.
    // Todos do município podem listar, ver e criar ocorrências.
    // Atualização: agente pode atualizar (exceto reabertura — tratada também via hook e rule), coordenador e administrador têm privilégios completos.
    const occCol = app.findCollectionByNameOrId('occurrences')
    occCol.listRule = "@request.auth.id != '' && municipality = @request.auth.municipality"
    occCol.viewRule = "@request.auth.id != '' && municipality = @request.auth.municipality"
    occCol.createRule = "@request.auth.id != '' && municipality = @request.auth.municipality"
    occCol.updateRule = "@request.auth.id != '' && municipality = @request.auth.municipality"
    occCol.deleteRule =
      "@request.auth.id != '' && municipality = @request.auth.municipality && (@request.auth.role = 'administrador' || @request.auth.role = 'coordenador')"
    app.save(occCol)

    // 3. shelters, teams, supplies, alerts, affected_areas, whatsapp_messages
    const operationalCols = [
      'shelters',
      'teams',
      'supplies',
      'alerts',
      'affected_areas',
      'whatsapp_messages',
    ]
    for (let i = 0; i < operationalCols.length; i++) {
      const colName = operationalCols[i]
      try {
        const col = app.findCollectionByNameOrId(colName)
        col.listRule = "@request.auth.id != '' && municipality = @request.auth.municipality"
        col.viewRule = "@request.auth.id != '' && municipality = @request.auth.municipality"
        col.createRule = "@request.auth.id != '' && municipality = @request.auth.municipality"
        col.updateRule = "@request.auth.id != '' && municipality = @request.auth.municipality"
        col.deleteRule =
          "@request.auth.id != '' && municipality = @request.auth.municipality && (@request.auth.role = 'administrador' || @request.auth.role = 'coordenador')"
        app.save(col)
      } catch (err) {
        console.log('Erro ao atualizar regras de ' + colName + ':', err.message)
      }
    }
  },
  (app) => {
    // Reverter regras se necessário
  },
)
