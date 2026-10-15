// pb_hooks: Ocorrências - Numeração Atômica, Auditoria e Regras de Permissão
// OBS: Toda lógica e funções auxiliares ficam estritamente INLINE dentro de cada callback (regra do goja pool do PocketBase)

// 1. Hook onRecordCreate: Gerar código sequencial atômico para ocorrências por município + ano
onRecordCreate((e) => {
  if (e.collection.name !== 'occurrences') {
    e.next()
    return
  }

  const record = e.record
  const authRecord = e.auth

  // Garantir municipality da ocorrência
  let munId = record.getString('municipality')
  if (!munId && authRecord) {
    munId = authRecord.getString('municipality')
    record.set('municipality', munId)
  }

  if (!munId) {
    try {
      const defaultMun = $app.findFirstRecordByData('municipalities', 'name', 'Município Inicial')
      munId = defaultMun.id
      record.set('municipality', munId)
    } catch (_) {}
  }

  // Origem padrão se vazia
  if (!record.getString('origin')) {
    record.set('origin', '199')
  }

  // Gera código sequencial se ainda não possuir
  if (!record.getString('code') && munId) {
    const year = new Date().getFullYear()

    $app.runInTransaction((txApp) => {
      let counterRec = null
      try {
        counterRec = txApp.findFirstRecordByFilter(
          'occurrence_counters',
          "municipality = '" + munId + "' && year = " + year,
        )
      } catch (_) {
        const countersCol = txApp.findCollectionByNameOrId('occurrence_counters')
        counterRec = new Record(countersCol)
        counterRec.set('municipality', munId)
        counterRec.set('year', year)
        counterRec.set('last_number', 0)
      }

      const nextNum = (counterRec.getInt('last_number') || 0) + 1
      counterRec.set('last_number', nextNum)
      txApp.save(counterRec)

      const padded = ('00000' + nextNum).slice(-5)
      const code = 'OC-' + year + '-' + padded
      record.set('code', code)
    })
  }

  e.next()

  // Auditoria pós-criação inline
  try {
    const authUser = e.auth
    const auditCol = $app.findCollectionByNameOrId('audit_log')
    const auditRec = new Record(auditCol)
    auditRec.set('municipality', record.getString('municipality'))
    if (authUser) {
      auditRec.set('user', authUser.id)
      auditRec.set('user_name', authUser.getString('name') || authUser.getString('email'))
      auditRec.set('user_email', authUser.getString('email'))
    } else if (record.getString('reported_by')) {
      auditRec.set('user', record.getString('reported_by'))
      auditRec.set('user_name', 'Operador')
    }
    auditRec.set('action', 'create')
    auditRec.set('collection', 'occurrences')
    auditRec.set('record_id', record.id)
    auditRec.set(
      'details',
      'Criação da ocorrência ' +
        (record.getString('code') || record.id) +
        ': ' +
        record.getString('title'),
    )
    auditRec.set('origin', 'online')

    const safeAfter = {
      id: record.id,
      code: record.getString('code'),
      title: record.getString('title'),
      type: record.getString('type'),
      severity: record.getString('severity'),
      status: record.getString('status'),
      origin: record.getString('origin'),
      address: record.getString('address'),
    }
    auditRec.set('data_after', JSON.stringify(safeAfter))
    $app.save(auditRec)
  } catch (err) {
    console.log('[Audit Create Error]', err.message)
  }
}, 'occurrences')

// 2. Hook onRecordUpdate: Validação de perfis (agente não reabre) + Auditoria
onRecordUpdate((e) => {
  if (e.collection.name !== 'occurrences') {
    e.next()
    return
  }

  const record = e.record
  const original = record.original()
  const authUser = e.auth

  const oldStatus = original.getString('status')
  const newStatus = record.getString('status')

  // Regra de perfil: Agente não pode reabrir ocorrência concluída ou cancelada
  const isReopening =
    (oldStatus === 'concluida' || oldStatus === 'cancelada') &&
    (newStatus === 'reportada' || newStatus === 'em_andamento')

  if (isReopening && authUser) {
    const role = authUser.getString('role') || 'agente'
    if (role === 'agente') {
      throw new BadRequestError(
        'Apenas coordenadores ou administradores podem reabrir ocorrências finalizadas.',
      )
    }
  }

  // Se concluída agora, preencher resolved_at se ausente
  if (newStatus === 'concluida' && !record.getString('resolved_at')) {
    record.set('resolved_at', new Date().toISOString())
  }

  // Capturar dados antes da persistência
  const safeBefore = {
    id: original.id,
    code: original.getString('code'),
    title: original.getString('title'),
    type: original.getString('type'),
    severity: original.getString('severity'),
    status: oldStatus,
    origin: original.getString('origin'),
    address: original.getString('address'),
  }

  e.next()

  // Auditoria pós-atualização inline
  try {
    let action = 'update'
    let detail = 'Atualização da ocorrência ' + (record.getString('code') || record.id)

    if (isReopening) {
      action = 'reopen'
      detail =
        'Reabertura da ocorrência ' +
        (record.getString('code') || record.id) +
        ' por ' +
        (authUser ? authUser.getString('name') : 'coordenador')
    } else if (newStatus === 'concluida' && oldStatus !== 'concluida') {
      action = 'conclude'
      detail = 'Conclusão da ocorrência ' + (record.getString('code') || record.id)
    }

    const safeAfter = {
      id: record.id,
      code: record.getString('code'),
      title: record.getString('title'),
      type: record.getString('type'),
      severity: record.getString('severity'),
      status: newStatus,
      origin: record.getString('origin'),
      address: record.getString('address'),
    }

    const auditCol = $app.findCollectionByNameOrId('audit_log')
    const auditRec = new Record(auditCol)
    auditRec.set('municipality', record.getString('municipality'))
    if (authUser) {
      auditRec.set('user', authUser.id)
      auditRec.set('user_name', authUser.getString('name') || authUser.getString('email'))
      auditRec.set('user_email', authUser.getString('email'))
    }
    auditRec.set('action', action)
    auditRec.set('collection', 'occurrences')
    auditRec.set('record_id', record.id)
    auditRec.set('details', detail)
    auditRec.set('origin', 'online')
    auditRec.set('data_before', JSON.stringify(safeBefore))
    auditRec.set('data_after', JSON.stringify(safeAfter))
    $app.save(auditRec)
  } catch (err) {
    console.log('[Audit Update Error]', err.message)
  }
}, 'occurrences')

// 3. Hook onRecordDelete: Auditoria de exclusão de ocorrências
onRecordDelete((e) => {
  if (e.collection.name !== 'occurrences') {
    e.next()
    return
  }

  const record = e.record
  const authUser = e.auth

  const safeBefore = {
    id: record.id,
    code: record.getString('code'),
    title: record.getString('title'),
    type: record.getString('type'),
    severity: record.getString('severity'),
    status: record.getString('status'),
  }
  const munId = record.getString('municipality')
  const recId = record.id
  const code = record.getString('code')

  e.next()

  try {
    const auditCol = $app.findCollectionByNameOrId('audit_log')
    const auditRec = new Record(auditCol)
    auditRec.set('municipality', munId)
    if (authUser) {
      auditRec.set('user', authUser.id)
      auditRec.set('user_name', authUser.getString('name') || authUser.getString('email'))
      auditRec.set('user_email', authUser.getString('email'))
    }
    auditRec.set('action', 'delete')
    auditRec.set('collection', 'occurrences')
    auditRec.set('record_id', recId)
    auditRec.set('details', 'Exclusão da ocorrência ' + (code || recId))
    auditRec.set('origin', 'online')
    auditRec.set('data_before', JSON.stringify(safeBefore))
    $app.save(auditRec)
  } catch (err) {
    console.log('[Audit Delete Error]', err.message)
  }
}, 'occurrences')
