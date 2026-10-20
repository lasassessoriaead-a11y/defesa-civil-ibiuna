// pb_hooks/users_admin.js
// Gestão Administrativa de Usuários no Backend
// Regras obrigatórias:
// 1. Quem chama deve ser usuário autenticado com perfil 'administrador'
// 2. Isolamento estrito entre prefeituras: qualquer conta criada nasce com a prefeitura do criador
// 3. Qualquer edição, ativação/desativação e redefinição de senha afeta somente usuários da mesma prefeitura
// 4. Nenhum token administrativo é exposto ao frontend
// 5. Trilha de auditoria em audit_log (sem registrar senha em texto claro)
// 6. Bloqueio de login para contas com is_active === false

// -------------------------------------------------------------
// 1. Bloqueio no login se a conta estiver desativada (is_active === false)
// -------------------------------------------------------------
onRecordAuthWithPasswordRequest((e) => {
  const record = e.record
  if (!record) {
    e.next()
    return
  }

  // Se o campo is_active estiver expressamente false, impedir login
  const isActive = record.getBool('is_active')
  // Se o campo existir e for explicitamente false (0)
  if (record.collection().fields.getByName('is_active') && !isActive) {
    throw new BadRequestError(
      'Esta conta de usuário foi inativada pela administração municipal. Contate o administrador.',
    )
  }

  e.next()
}, 'users')

// -------------------------------------------------------------
// 2. Rota: POST /backend/v1/users/admin-create
// Criar novo usuário na mesma prefeitura do administrador chamador
// -------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/users/admin-create',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser) {
        return e.unauthorizedError('Autenticação necessária.')
      }

      const callerRole = authUser.getString('role')
      if (callerRole !== 'administrador') {
        return e.forbiddenError('Apenas administradores podem cadastrar novos usuários.')
      }

      const callerMun = authUser.getString('municipality')
      if (!callerMun) {
        return e.badRequestError('Administrador não possui município vinculado.')
      }

      const body = e.requestInfo().body || {}
      const name = (body.name || '').trim()
      const email = (body.email || '').trim().toLowerCase()
      const password = (body.password || '').trim()
      const role = (body.role || 'agente').trim()
      const department = (body.department || '').trim()

      if (!name) {
        return e.badRequestError('O nome do usuário é obrigatório.')
      }
      if (!email) {
        return e.badRequestError('O e-mail institucional é obrigatório.')
      }
      if (!password || password.length < 8) {
        return e.badRequestError('A senha inicial deve ter no mínimo 8 caracteres.')
      }

      // Validar role permitido
      const allowedRoles = ['administrador', 'coordenador', 'agente']
      if (allowedRoles.indexOf(role) === -1) {
        return e.badRequestError('Perfil inválido. Deve ser administrador, coordenador ou agente.')
      }

      // Verificar se já existe usuário com este e-mail
      try {
        const existing = $app.findAuthRecordByEmail('_pb_users_auth_', email)
        if (existing && existing.id) {
          return e.badRequestError('Já existe um usuário cadastrado com este e-mail.')
        }
      } catch (_) {
        // Usuário não existe, seguir
      }

      const usersCol = $app.findCollectionByNameOrId('_pb_users_auth_')
      const newRecord = new Record(usersCol)

      newRecord.setEmail(email)
      newRecord.setPassword(password)
      newRecord.setVerified(true)
      newRecord.set('name', name)
      newRecord.set('role', role)
      newRecord.set('municipality', callerMun)
      newRecord.set('is_active', true)
      if (department) {
        newRecord.set('department', department)
      }

      $app.save(newRecord)

      // Registrar auditoria (SEM senha em claro)
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_log')
        const auditRec = new Record(auditCol)
        auditRec.set('municipality', callerMun)
        auditRec.set('user', authUser.id)
        auditRec.set('user_name', authUser.getString('name') || authUser.getString('email'))
        auditRec.set('user_email', authUser.getString('email'))
        auditRec.set('action', 'admin_create_user')
        auditRec.set('collection', 'users')
        auditRec.set('record_id', newRecord.id)
        auditRec.set(
          'details',
          'Criação de usuário "' +
            name +
            '" (' +
            email +
            ') com perfil ' +
            role +
            (department ? ' na secretaria ' + department : '') +
            ' pelo administrador ' +
            (authUser.getString('name') || authUser.getString('email')),
        )
        auditRec.set('origin', 'online')
        auditRec.set(
          'data_after',
          JSON.stringify({
            id: newRecord.id,
            email: email,
            name: name,
            role: role,
            department: department,
            municipality: callerMun,
            is_active: true,
          }),
        )
        $app.save(auditRec)
      } catch (auditErr) {
        console.log('[Audit User Create Error]', auditErr.message)
      }

      return e.json(200, {
        success: true,
        user: {
          id: newRecord.id,
          email: newRecord.getString('email'),
          name: newRecord.getString('name'),
          role: newRecord.getString('role'),
          department: newRecord.getString('department'),
          municipality: newRecord.getString('municipality'),
          is_active: newRecord.getBool('is_active'),
          created: newRecord.getString('created'),
        },
      })
    } catch (err) {
      console.log('[Admin Create User Error]', err.message)
      return e.json(400, { error: err.message || 'Falha ao criar usuário.' })
    }
  },
  $apis.requireAuth(),
)

// -------------------------------------------------------------
// 3. Rota: POST /backend/v1/users/admin-update
// Editar nome, role, department e is_active (ativar/desativar) de um usuário
// -------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/users/admin-update',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser) {
        return e.unauthorizedError('Autenticação necessária.')
      }

      const callerRole = authUser.getString('role')
      if (callerRole !== 'administrador') {
        return e.forbiddenError('Apenas administradores podem atualizar perfis de usuários.')
      }

      const callerMun = authUser.getString('municipality')
      const body = e.requestInfo().body || {}
      const targetUserId = (body.id || '').trim()

      if (!targetUserId) {
        return e.badRequestError('ID do usuário é obrigatório.')
      }

      let targetUser = null
      try {
        targetUser = $app.findRecordById('users', targetUserId)
      } catch (_) {
        return e.notFoundError('Usuário não encontrado.')
      }

      // Validação de isolamento: usuário alvo deve ser da mesma prefeitura
      if (targetUser.getString('municipality') !== callerMun) {
        return e.forbiddenError('Você só pode gerenciar usuários da sua própria prefeitura.')
      }

      // Capturar dados antes
      const dataBefore = {
        id: targetUser.id,
        name: targetUser.getString('name'),
        email: targetUser.getString('email'),
        role: targetUser.getString('role'),
        department: targetUser.getString('department'),
        is_active: targetUser.getBool('is_active'),
      }

      // Regra de segurança: Não permitir que o próprio administrador se auto-desative ou mude seu próprio role para não-admin
      if (targetUser.id === authUser.id) {
        if (body.is_active === false) {
          return e.badRequestError('Você não pode desativar a sua própria conta de administrador.')
        }
        if (body.role && body.role !== 'administrador') {
          return e.badRequestError('Você não pode remover seu próprio perfil de administrador.')
        }
      }

      if (typeof body.name === 'string' && body.name.trim()) {
        targetUser.set('name', body.name.trim())
      }

      if (body.role) {
        const allowedRoles = ['administrador', 'coordenador', 'agente']
        if (allowedRoles.indexOf(body.role) === -1) {
          return e.badRequestError('Perfil inválido.')
        }
        targetUser.set('role', body.role)
      }

      if (typeof body.department === 'string') {
        targetUser.set('department', body.department.trim())
      }

      if (typeof body.is_active === 'boolean') {
        targetUser.set('is_active', body.is_active)
      }

      $app.save(targetUser)

      // Trilha de auditoria
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_log')
        const auditRec = new Record(auditCol)
        auditRec.set('municipality', callerMun)
        auditRec.set('user', authUser.id)
        auditRec.set('user_name', authUser.getString('name') || authUser.getString('email'))
        auditRec.set('user_email', authUser.getString('email'))
        auditRec.set('action', 'admin_update_user')
        auditRec.set('collection', 'users')
        auditRec.set('record_id', targetUser.id)
        auditRec.set(
          'details',
          'Atualização de cadastro do usuário "' +
            targetUser.getString('name') +
            '" (' +
            targetUser.getString('email') +
            ') por ' +
            (authUser.getString('name') || authUser.getString('email')),
        )
        auditRec.set('origin', 'online')
        auditRec.set('data_before', JSON.stringify(dataBefore))
        auditRec.set(
          'data_after',
          JSON.stringify({
            id: targetUser.id,
            name: targetUser.getString('name'),
            email: targetUser.getString('email'),
            role: targetUser.getString('role'),
            department: targetUser.getString('department'),
            is_active: targetUser.getBool('is_active'),
          }),
        )
        $app.save(auditRec)
      } catch (auditErr) {
        console.log('[Audit User Update Error]', auditErr.message)
      }

      return e.json(200, {
        success: true,
        user: {
          id: targetUser.id,
          email: targetUser.getString('email'),
          name: targetUser.getString('name'),
          role: targetUser.getString('role'),
          department: targetUser.getString('department'),
          municipality: targetUser.getString('municipality'),
          is_active: targetUser.getBool('is_active'),
          updated: targetUser.getString('updated'),
        },
      })
    } catch (err) {
      console.log('[Admin Update User Error]', err.message)
      return e.json(400, { error: err.message || 'Falha ao atualizar usuário.' })
    }
  },
  $apis.requireAuth(),
)

// -------------------------------------------------------------
// 4. Rota: POST /backend/v1/users/admin-reset-password
// Redefinir senha de um usuário da mesma prefeitura
// -------------------------------------------------------------
routerAdd(
  'POST',
  '/backend/v1/users/admin-reset-password',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser) {
        return e.unauthorizedError('Autenticação necessária.')
      }

      const callerRole = authUser.getString('role')
      if (callerRole !== 'administrador') {
        return e.forbiddenError('Apenas administradores podem redefinir senhas de contas.')
      }

      const callerMun = authUser.getString('municipality')
      const body = e.requestInfo().body || {}
      const targetUserId = (body.id || '').trim()
      const newPassword = (body.password || '').trim()

      if (!targetUserId) {
        return e.badRequestError('ID do usuário é obrigatório.')
      }
      if (!newPassword || newPassword.length < 8) {
        return e.badRequestError('A nova senha deve ter no mínimo 8 caracteres.')
      }

      let targetUser = null
      try {
        targetUser = $app.findRecordById('users', targetUserId)
      } catch (_) {
        return e.notFoundError('Usuário não encontrado.')
      }

      // Validação de isolamento: usuário alvo deve pertencer à mesma prefeitura
      if (targetUser.getString('municipality') !== callerMun) {
        return e.forbiddenError(
          'Você só pode redefinir senhas de usuários da sua própria prefeitura.',
        )
      }

      // Atualizar senha de forma segura no PocketBase
      targetUser.setPassword(newPassword)
      $app.save(targetUser)

      // Trilha de auditoria (NUNCA registrar senha em texto claro)
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_log')
        const auditRec = new Record(auditCol)
        auditRec.set('municipality', callerMun)
        auditRec.set('user', authUser.id)
        auditRec.set('user_name', authUser.getString('name') || authUser.getString('email'))
        auditRec.set('user_email', authUser.getString('email'))
        auditRec.set('action', 'admin_reset_password')
        auditRec.set('collection', 'users')
        auditRec.set('record_id', targetUser.id)
        auditRec.set(
          'details',
          'Redefinição de senha do usuário "' +
            targetUser.getString('name') +
            '" (' +
            targetUser.getString('email') +
            ') executada pelo administrador ' +
            (authUser.getString('name') || authUser.getString('email')),
        )
        auditRec.set('origin', 'online')
        auditRec.set(
          'data_after',
          JSON.stringify({
            id: targetUser.id,
            email: targetUser.getString('email'),
            password_reset_at: new Date().toISOString(),
          }),
        )
        $app.save(auditRec)
      } catch (auditErr) {
        console.log('[Audit Reset Password Error]', auditErr.message)
      }

      return e.json(200, {
        success: true,
        message: 'Senha do usuário redefinida com sucesso.',
      })
    } catch (err) {
      console.log('[Admin Reset Password Error]', err.message)
      return e.json(400, { error: err.message || 'Falha ao redefinir senha.' })
    }
  },
  $apis.requireAuth(),
)
