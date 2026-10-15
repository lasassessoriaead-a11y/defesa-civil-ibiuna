// pb_hooks: Gestão Documental - Ofícios, Autorizações de Corte/Poda, Numeração Atômica e Auditoria
// OBS: Cada handler contém todo o código inline necessário, conforme regras de isolamento do goja

// ==========================================
// 1. OFFICIAL_DOCUMENTS (OFÍCIOS)
// ==========================================

// Criação de Ofício
onRecordCreate((e) => {
  if (e.collection.name !== 'official_documents') {
    e.next()
    return
  }

  const record = e.record
  const authUser = e.auth

  // Garantir municipality
  let munId = record.getString('municipality')
  if (!munId && authUser) {
    munId = authUser.getString('municipality')
    record.set('municipality', munId)
  }

  // Se o usuário autenticado não for explicitamente setado em created_by
  if (authUser && !record.getString('created_by')) {
    record.set('created_by', authUser.id)
  }

  // Status padrão é rascunho se não informado
  const status = record.getString('status') || 'rascunho'
  record.set('status', status)

  // Se já estiver sendo criado como emitido, gera numeração e data
  if (status === 'emitido' && munId && !record.getString('number')) {
    const year = new Date().getFullYear()
    $app.runInTransaction((txApp) => {
      let counterRec = null
      try {
        counterRec = txApp.findFirstRecordByFilter(
          'document_counters',
          "municipality = '" + munId + "' && type = 'oficio' && year = " + year,
        )
      } catch (_) {
        const cCol = txApp.findCollectionByNameOrId('document_counters')
        counterRec = new Record(cCol)
        counterRec.set('municipality', munId)
        counterRec.set('type', 'oficio')
        counterRec.set('year', year)
        counterRec.set('last_number', 0)
      }

      const nextNum = (counterRec.getInt('last_number') || 0) + 1
      counterRec.set('last_number', nextNum)
      txApp.save(counterRec)

      const padded = ('00000' + nextNum).slice(-5)
      const numCode = 'OF-' + year + '-' + padded
      record.set('number', numCode)
      record.set('year', year)
      record.set('sequential', nextNum)
      if (!record.getString('issue_date')) {
        record.set('issue_date', new Date().toISOString())
      }
    })
  }

  e.next()

  // Auditoria de criação
  try {
    const auditCol = $app.findCollectionByNameOrId('audit_log')
    const auditRec = new Record(auditCol)
    auditRec.set('municipality', record.getString('municipality'))
    if (authUser) {
      auditRec.set('user', authUser.id)
      auditRec.set('user_name', authUser.getString('name') || authUser.getString('email'))
      auditRec.set('user_email', authUser.getString('email'))
    }
    auditRec.set('action', record.getString('status') === 'emitido' ? 'issue' : 'create')
    auditRec.set('collection', 'official_documents')
    auditRec.set('record_id', record.id)
    auditRec.set(
      'details',
      'Criação de ofício ' +
        (record.getString('number') || '[Rascunho]') +
        ': ' +
        record.getString('subject'),
    )
    auditRec.set('origin', 'online')
    const safeAfter = {
      id: record.id,
      number: record.getString('number'),
      status: record.getString('status'),
      recipient: record.getString('recipient_name'),
      subject: record.getString('subject'),
      issue_date: record.getString('issue_date'),
    }
    auditRec.set('data_after', JSON.stringify(safeAfter))
    $app.save(auditRec)
  } catch (err) {
    console.log('[Audit Doc Create Error]', err.message)
  }
}, 'official_documents')

// Atualização de Ofício
onRecordUpdate((e) => {
  if (e.collection.name !== 'official_documents') {
    e.next()
    return
  }

  const record = e.record
  const original = record.original()
  const authUser = e.auth

  const oldStatus = original.getString('status')
  const newStatus = record.getString('status')
  const munId =
    record.getString('municipality') || (authUser ? authUser.getString('municipality') : '')

  // Regra de segurança: Se já foi emitido, não permite alterar corpo, número ou destinatário silenciosamente!
  if (oldStatus === 'emitido') {
    const contentChanged = original.getString('content') !== record.getString('content')
    const subjectChanged = original.getString('subject') !== record.getString('subject')
    const numChanged = original.getString('number') !== record.getString('number')
    const recipientChanged =
      original.getString('recipient_name') !== record.getString('recipient_name')

    // Se estiver tentando alterar esses campos essenciais de documento emitido
    if (
      (contentChanged || subjectChanged || numChanged || recipientChanged) &&
      newStatus !== 'cancelado'
    ) {
      const role = authUser ? authUser.getString('role') : 'agente'
      if (role !== 'administrador' && role !== 'coordenador') {
        throw new BadRequestError(
          'Documentos oficiais já emitidos não podem ter seu conteúdo alterado por agentes.',
        )
      }
    }
  }

  // Emissão de rascunho para emitido: gerar número sequencial atômico
  const isBeingIssued = (oldStatus === 'rascunho' || !oldStatus) && newStatus === 'emitido'
  if (isBeingIssued && !record.getString('number') && munId) {
    const year = new Date().getFullYear()
    $app.runInTransaction((txApp) => {
      let counterRec = null
      try {
        counterRec = txApp.findFirstRecordByFilter(
          'document_counters',
          "municipality = '" + munId + "' && type = 'oficio' && year = " + year,
        )
      } catch (_) {
        const cCol = txApp.findCollectionByNameOrId('document_counters')
        counterRec = new Record(cCol)
        counterRec.set('municipality', munId)
        counterRec.set('type', 'oficio')
        counterRec.set('year', year)
        counterRec.set('last_number', 0)
      }

      const nextNum = (counterRec.getInt('last_number') || 0) + 1
      counterRec.set('last_number', nextNum)
      txApp.save(counterRec)

      const padded = ('00000' + nextNum).slice(-5)
      const numCode = 'OF-' + year + '-' + padded
      record.set('number', numCode)
      record.set('year', year)
      record.set('sequential', nextNum)
      if (!record.getString('issue_date')) {
        record.set('issue_date', new Date().toISOString())
      }
    })
  }

  const safeBefore = {
    id: original.id,
    number: original.getString('number'),
    status: oldStatus,
    recipient: original.getString('recipient_name'),
    subject: original.getString('subject'),
  }

  e.next()

  // Auditoria de atualização / emissão / cancelamento
  try {
    let action = 'update'
    let detail = 'Atualização de ofício ' + (record.getString('number') || record.id)
    if (isBeingIssued) {
      action = 'issue'
      detail = 'Emissão oficial de ofício ' + record.getString('number')
    } else if (newStatus === 'cancelado' && oldStatus !== 'cancelado') {
      action = 'cancel'
      detail = 'Cancelamento de ofício ' + (record.getString('number') || record.id)
    }

    const safeAfter = {
      id: record.id,
      number: record.getString('number'),
      status: newStatus,
      recipient: record.getString('recipient_name'),
      subject: record.getString('subject'),
      issue_date: record.getString('issue_date'),
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
    auditRec.set('collection', 'official_documents')
    auditRec.set('record_id', record.id)
    auditRec.set('details', detail)
    auditRec.set('origin', 'online')
    auditRec.set('data_before', JSON.stringify(safeBefore))
    auditRec.set('data_after', JSON.stringify(safeAfter))
    $app.save(auditRec)
  } catch (err) {
    console.log('[Audit Doc Update Error]', err.message)
  }
}, 'official_documents')

// ==========================================
// 2. TREE_AUTHORIZATIONS (AUTORIZAÇÕES DE CORTE E PODA)
// ==========================================

// Função auxiliar inline de verificação de permissão de emissor autorizado
// (regra: somente o usuário designado pelo coordenador ou administrador pode emitir)
onRecordCreate((e) => {
  if (e.collection.name !== 'tree_authorizations') {
    e.next()
    return
  }

  const record = e.record
  const authUser = e.auth

  let munId = record.getString('municipality')
  if (!munId && authUser) {
    munId = authUser.getString('municipality')
    record.set('municipality', munId)
  }

  if (authUser && !record.getString('created_by')) {
    record.set('created_by', authUser.id)
  }

  const status = record.getString('status') || 'rascunho'
  record.set('status', status)

  // Idempotência por client_uuid
  const clientUuid = record.getString('client_uuid')
  if (clientUuid && munId) {
    try {
      const existing = $app.findFirstRecordByFilter(
        'tree_authorizations',
        "client_uuid = '" + clientUuid + "' && municipality = '" + munId + "'",
      )
      if (existing && existing.id) {
        throw new BadRequestError(
          'DUPLICATE_CLIENT_UUID:' + existing.id + ':' + (existing.getString('number') || ''),
        )
      }
    } catch (findErr) {
      if (findErr.message && findErr.message.indexOf('DUPLICATE_CLIENT_UUID') !== -1) {
        throw findErr
      }
    }
  }

  // Se veio provisório
  const currentNum = record.getString('number')
  if (currentNum && currentNum.startsWith('OFF-') && !record.getString('prov_code')) {
    record.set('prov_code', currentNum)
    record.set('number', '')
  }

  // Se já estiver sendo criada como emitida
  if (status === 'emitida') {
    // Validar emissor designado no backend
    if (!authUser) {
      throw new BadRequestError('Autenticação necessária para emitir autorização.')
    }
    const munRecord = $app.findRecordById('municipalities', munId)
    const designatedIssuer = munRecord.getString('authorized_issuer')
    const userRole = authUser.getString('role') || 'agente'

    // Permitido se for o designatedIssuer OU administrador/coordenador se nenhum designado tiver sido configurado ainda
    const isAuthorized =
      (designatedIssuer && authUser.id === designatedIssuer) ||
      (!designatedIssuer && (userRole === 'administrador' || userRole === 'coordenador'))

    if (!isAuthorized) {
      // Requisito 5: Se permissão foi revogada offline ou usuário sem permissão, NÃO emitir automaticamente
      record.set('status', 'rascunho')
      throw new BadRequestError(
        'Permissão não autorizada para emissão: apenas o usuário designado pela Coordenadoria Municipal pode emitir autorizações. O registro foi mantido como pendente/rascunho para regularização.',
      )
    }

    // Gerar número AUT e validade de 90 dias
    const year = new Date().getFullYear()
    $app.runInTransaction((txApp) => {
      let counterRec = null
      try {
        counterRec = txApp.findFirstRecordByFilter(
          'document_counters',
          "municipality = '" + munId + "' && type = 'autorizacao' && year = " + year,
        )
      } catch (_) {
        const cCol = txApp.findCollectionByNameOrId('document_counters')
        counterRec = new Record(cCol)
        counterRec.set('municipality', munId)
        counterRec.set('type', 'autorizacao')
        counterRec.set('year', year)
        counterRec.set('last_number', 0)
      }

      const nextNum = (counterRec.getInt('last_number') || 0) + 1
      counterRec.set('last_number', nextNum)
      txApp.save(counterRec)

      const padded = ('00000' + nextNum).slice(-5)
      const numCode = 'AUT-' + year + '-' + padded
      record.set('number', numCode)
      record.set('year', year)
      record.set('sequential', nextNum)

      const now = new Date()
      const issueDate = now.toISOString()
      const expDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString()
      record.set('issue_date', issueDate)
      record.set('expiration_date', expDate)
      record.set('authorized_by', authUser.id)
      record.set('authorized_by_name', authUser.getString('name') || authUser.getString('email'))
      record.set('authorized_by_role', authUser.getString('role') || 'Emissor Autorizado')
    })
  }

  e.next()

  // Auditoria
  try {
    const auditCol = $app.findCollectionByNameOrId('audit_log')
    const auditRec = new Record(auditCol)
    auditRec.set('municipality', record.getString('municipality'))
    if (authUser) {
      auditRec.set('user', authUser.id)
      auditRec.set('user_name', authUser.getString('name') || authUser.getString('email'))
      auditRec.set('user_email', authUser.getString('email'))
    }
    auditRec.set('action', record.getString('status') === 'emitida' ? 'issue' : 'create')
    auditRec.set('collection', 'tree_authorizations')
    auditRec.set('record_id', record.id)
    auditRec.set(
      'details',
      'Criação de autorização ' +
        (record.getString('number') || '[Rascunho]') +
        ': ' +
        record.getString('type') +
        ' (' +
        record.getInt('tree_quantity') +
        ' árvores)',
    )
    auditRec.set('origin', 'online')
    const safeAfter = {
      id: record.id,
      number: record.getString('number'),
      type: record.getString('type'),
      status: record.getString('status'),
      trees: record.getInt('tree_quantity'),
      address: record.getString('address'),
      issue_date: record.getString('issue_date'),
      expiration_date: record.getString('expiration_date'),
    }
    auditRec.set('data_after', JSON.stringify(safeAfter))
    $app.save(auditRec)
  } catch (err) {
    console.log('[Audit Tree Auth Create Error]', err.message)
  }
}, 'tree_authorizations')

// Atualização de Autorização de Corte/Poda
onRecordUpdate((e) => {
  if (e.collection.name !== 'tree_authorizations') {
    e.next()
    return
  }

  const record = e.record
  const original = record.original()
  const authUser = e.auth

  const oldStatus = original.getString('status')
  const newStatus = record.getString('status')
  const munId =
    record.getString('municipality') || (authUser ? authUser.getString('municipality') : '')

  const isBeingIssued = (oldStatus === 'rascunho' || !oldStatus) && newStatus === 'emitida'

  // Se estiver emitindo agora, validar SE É O EMISSOR DESIGNADO
  if (isBeingIssued) {
    if (!authUser) {
      throw new BadRequestError('Autenticação necessária para emitir autorização.')
    }
    const munRecord = $app.findRecordById('municipalities', munId)
    const designatedIssuer = munRecord.getString('authorized_issuer')
    const userRole = authUser.getString('role') || 'agente'

    const isAuthorized =
      (designatedIssuer && authUser.id === designatedIssuer) ||
      (!designatedIssuer && (userRole === 'administrador' || userRole === 'coordenador'))

    if (!isAuthorized) {
      throw new BadRequestError(
        'Apenas o usuário designado pela Coordenadoria Municipal tem permissão para emitir autorizações de corte e poda.',
      )
    }

    // Se ainda não tem número gerado, gerar agora atomicamente
    if (!record.getString('number') && munId) {
      const year = new Date().getFullYear()
      $app.runInTransaction((txApp) => {
        let counterRec = null
        try {
          counterRec = txApp.findFirstRecordByFilter(
            'document_counters',
            "municipality = '" + munId + "' && type = 'autorizacao' && year = " + year,
          )
        } catch (_) {
          const cCol = txApp.findCollectionByNameOrId('document_counters')
          counterRec = new Record(cCol)
          counterRec.set('municipality', munId)
          counterRec.set('type', 'autorizacao')
          counterRec.set('year', year)
          counterRec.set('last_number', 0)
        }

        const nextNum = (counterRec.getInt('last_number') || 0) + 1
        counterRec.set('last_number', nextNum)
        txApp.save(counterRec)

        const padded = ('00000' + nextNum).slice(-5)
        const numCode = 'AUT-' + year + '-' + padded
        record.set('number', numCode)
        record.set('year', year)
        record.set('sequential', nextNum)

        const now = new Date()
        const issueDate = now.toISOString()
        const expDate = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000).toISOString()
        record.set('issue_date', issueDate)
        record.set('expiration_date', expDate)
        record.set('authorized_by', authUser.id)
        record.set('authorized_by_name', authUser.getString('name') || authUser.getString('email'))
        record.set('authorized_by_role', authUser.getString('role') || 'Emissor Autorizado')
      })
    }
  }

  // Trava para documento já emitido: não permitir edição arbitrária por agentes
  if (oldStatus === 'emitida' && newStatus !== 'cancelada') {
    const reportChanged =
      original.getString('technical_report') !== record.getString('technical_report')
    const qtyChanged = original.getInt('tree_quantity') !== record.getInt('tree_quantity')
    const addrChanged = original.getString('address') !== record.getString('address')
    if (reportChanged || qtyChanged || addrChanged) {
      const role = authUser ? authUser.getString('role') : 'agente'
      if (role !== 'administrador' && role !== 'coordenador') {
        throw new BadRequestError('Autorizações já emitidas não podem ser modificadas por agentes.')
      }
    }
  }

  const safeBefore = {
    id: original.id,
    number: original.getString('number'),
    status: oldStatus,
    type: original.getString('type'),
    trees: original.getInt('tree_quantity'),
    expiration_date: original.getString('expiration_date'),
  }

  e.next()

  // Auditoria
  try {
    let action = 'update'
    let detail = 'Atualização de autorização ' + (record.getString('number') || record.id)
    if (isBeingIssued) {
      action = 'issue'
      detail = 'Emissão oficial da autorização ' + record.getString('number')
    } else if (newStatus === 'cancelada' && oldStatus !== 'cancelada') {
      action = 'cancel'
      detail = 'Cancelamento da autorização ' + (record.getString('number') || record.id)
    }

    const safeAfter = {
      id: record.id,
      number: record.getString('number'),
      status: newStatus,
      type: record.getString('type'),
      trees: record.getInt('tree_quantity'),
      expiration_date: record.getString('expiration_date'),
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
    auditRec.set('collection', 'tree_authorizations')
    auditRec.set('record_id', record.id)
    auditRec.set('details', detail)
    auditRec.set('origin', 'online')
    auditRec.set('data_before', JSON.stringify(safeBefore))
    auditRec.set('data_after', JSON.stringify(safeAfter))
    $app.save(auditRec)
  } catch (err) {
    console.log('[Audit Tree Auth Update Error]', err.message)
  }
}, 'tree_authorizations')

// ==========================================
// 3. IA: REVISÃO ORTOGRÁFICA E REDAÇÃO DE OFÍCIOS
// ==========================================
// Endpoint: POST /backend/v1/documents/review-ai
routerAdd(
  'POST',
  '/backend/v1/documents/review-ai',
  (e) => {
    try {
      const authUser = e.auth
      if (!authUser) {
        return e.unauthorizedError('Autenticação necessária.')
      }

      const body = e.requestInfo().body || {}
      const text = (body.text || '').trim()
      const mode = body.mode || 'revisao' // revisao | formal | aprimoramento

      if (!text) {
        return e.badRequestError('O texto para revisão não pode ser vazio.')
      }

      let systemPrompt =
        'Você é um especialista em redação oficial e técnica para a Defesa Civil Municipal do Brasil.\n' +
        'Seu papel é revisar o texto recebido mantendo a clareza, correção gramatical e padrão culto da linguagem formal oficial brasileira (Manual de Redação da Presidência da República).\n' +
        'Mantenha as tags HTML básicas se existirem (<p>, <br>, <strong>, <em>, <ul>, <li>).\n' +
        'IMPORTANTE: Responda SOMENTE em formato JSON válido contendo exatamente as chaves:\n' +
        '{\n' +
        '  "improved_text": "o texto corrigido/aprimorado",\n' +
        '  "summary_of_changes": "resumo sucinto em 1-2 linhas das alterações feitas (ex: correção ortográfica, concordância e formalização)",\n' +
        '  "tone": "formal"\n' +
        '}\n' +
        'Não coloque blocos markdown com crases adicionais se puder, responda JSON direto.'

      if (mode === 'formal') {
        systemPrompt +=
          '\nEnfatize a linguagem institucional e protocolo de comunicação entre órgãos públicos.'
      } else if (mode === 'aprimoramento') {
        systemPrompt +=
          '\nAprimore a argumentação técnica, mantendo o tom assertivo e preventivo da Defesa Civil.'
      }

      const reply = $ai.chat({
        model: 'fast',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: 'Texto original:\n' + text.slice(0, 4000) },
        ],
      })

      const rawContent = reply.choices[0].message.content.trim()
      let parsed = null

      try {
        // Tentar remover crases markdown se o modelo incluiu
        let clean = rawContent
        if (clean.startsWith('```json')) {
          clean = clean
            .replace(/^```json/, '')
            .replace(/```$/, '')
            .trim()
        } else if (clean.startsWith('```')) {
          clean = clean.replace(/^```/, '').replace(/```$/, '').trim()
        }
        parsed = JSON.parse(clean)
      } catch (jsonErr) {
        parsed = {
          improved_text: rawContent,
          summary_of_changes: 'Revisão textual e adequação da linguagem formal.',
          tone: 'formal',
        }
      }

      return e.json(200, parsed)
    } catch (err) {
      console.log('[AI Doc Review Error]', err.message)
      if (err instanceof SkipAiConfigError) {
        return e.json(503, { error: 'Serviço de IA temporariamente indisponível.' })
      }
      if (err instanceof SkipAiError) {
        return e.json(err.status || 500, { error: 'Erro no processamento da IA: ' + err.message })
      }
      return e.json(500, { error: 'Falha ao processar revisão de documento: ' + err.message })
    }
  },
  $apis.requireAuth(),
)
