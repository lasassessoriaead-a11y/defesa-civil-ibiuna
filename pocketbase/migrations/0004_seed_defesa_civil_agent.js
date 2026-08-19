/// <reference path="../pb_data/types.d.ts" />

// Cria a conta do primeiro agente da Defesa Civil.
// Collection de auth (`users`) -> senha definida via setPassword() (hasheada),
// nunca em plain text. Usuario fica verificado/ativo para entrar imediatamente.
// Observacao: a troca de senha no primeiro login e uma orientacao operacional
// (o PocketBase nao possui flag nativo de "forcar troca de senha").
migrate(
  (app) => {
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const email = 'luis.gustavo@defesacivil.gov.br'

    // Idempotente: se o usuario ja existe, nao recria.
    try {
      app.findAuthRecordByEmail('_pb_users_auth_', email)
      return
    } catch (_) {
      // nao existe -> prossegue para criacao
    }

    const record = new Record(usersCol)
    record.set('name', 'Luis Gustavo')
    record.setEmail(email)
    record.setPassword('Defesa@2025')
    record.setVerified(true)
    app.save(record)
  },
  (app) => {
    // down: remove o usuario criado
    try {
      const record = app.findAuthRecordByEmail('_pb_users_auth_', 'luis.gustavo@defesacivil.gov.br')
      app.delete(record)
    } catch (_) {
      // ja removido
    }
  },
)
