routerAdd('POST', '/wa/webhook', (e) => {
  try {
    const info = e.requestInfo()
    const reqBody = info.body || {}

    // Twilio sends application/x-www-form-urlencoded
    let from = (reqBody.From || reqBody.from || '').trim()
    let to = (reqBody.To || reqBody.to || '').trim()
    let bodyText = (reqBody.Body || reqBody.body || '').trim()
    const messageSid = reqBody.MessageSid || reqBody.SmsMessageSid || ''
    const profileName = reqBody.ProfileName || ''

    // Clean numbers
    let cleanFrom = from
    if (cleanFrom.toLowerCase().startsWith('whatsapp:')) {
      cleanFrom = cleanFrom.substring(9).trim()
    }
    let cleanTo = to
    if (cleanTo.toLowerCase().startsWith('whatsapp:')) {
      cleanTo = cleanTo.substring(9).trim()
    }

    if (!cleanFrom && !bodyText) {
      // Return TwiML empty response
      e.response.header().set('Content-Type', 'text/xml')
      return e.string(200, '<Response></Response>')
    }

    // Optional signature verification check
    const accountSid = $os.getenv('TWILIO_ACCOUNT_SID') || ''
    const authToken = $os.getenv('TWILIO_AUTH_TOKEN') || ''
    const defaultWaNumber = $os.getenv('TWILIO_WHATSAPP_NUMBER') || cleanTo || '+14155238886'

    const isPlaceholder = (val) => {
      if (!val) return true
      const s = String(val).trim().toLowerCase()
      return s.indexOf('placeholder') !== -1 || s === 'ac_placeholder' || s === 'placeholder_token'
    }

    // Check emergency keywords in incoming message
    const lowerBody = bodyText.toLowerCase()
    const emergencyKeywords = [
      'socorro',
      'urgente',
      'emergência',
      'emergencia',
      'incêndio',
      'incendio',
      'fogo',
      'enchente',
      'inundação',
      'inundacao',
      'alagamento',
      'deslizamento',
      'desabamento',
      'soterramento',
      'preso',
      'presa',
      'ajuda',
      'salvar',
    ]

    let isCriticalEmergency = false
    let detectedKeyword = ''
    for (let i = 0; i < emergencyKeywords.length; i++) {
      const kw = emergencyKeywords[i]
      if (lowerBody.indexOf(kw) !== -1) {
        isCriticalEmergency = true
        detectedKeyword = kw
        break
      }
    }

    let createdOccId = null
    if (isCriticalEmergency) {
      try {
        // Detect hazard type from keyword
        let occType = 'outro'
        if (
          lowerBody.indexOf('enchente') !== -1 ||
          lowerBody.indexOf('alagamento') !== -1 ||
          lowerBody.indexOf('inunda') !== -1
        ) {
          occType = 'enchente'
        } else if (
          lowerBody.indexOf('desliz') !== -1 ||
          lowerBody.indexOf('desaba') !== -1 ||
          lowerBody.indexOf('soterra') !== -1
        ) {
          occType = 'deslizamento'
        } else if (lowerBody.indexOf('incendio') !== -1 || lowerBody.indexOf('fogo') !== -1) {
          occType = 'incendio_florestal'
        }

        const occCol = $app.findCollectionByNameOrId('occurrences')
        const occRec = new Record(occCol)
        const titleName = profileName ? profileName + ' (' + cleanFrom + ')' : cleanFrom
        occRec.set('title', 'WhatsApp Emergência: ' + titleName)
        occRec.set(
          'description',
          'Chamado recebido via WhatsApp [' +
            cleanFrom +
            '] com alerta de ' +
            detectedKeyword.toUpperCase() +
            ':\n\n"' +
            bodyText +
            '"',
        )
        occRec.set('type', occType)
        occRec.set('severity', 'critica')
        occRec.set('status', 'reportada')
        occRec.set('address', 'Informado via WhatsApp: ' + cleanFrom)

        // Assign default operator user if available
        try {
          const users = $app.findRecordsByFilter('users', 'id != ""', '-created', 1, 0)
          if (users.length > 0) {
            occRec.set('reported_by', users[0].id)
          }
        } catch (_) {}

        $app.save(occRec)
        createdOccId = occRec.id
        console.log('[WhatsApp] Ocorrência crítica criada automaticamente:', occRec.id)
      } catch (occErr) {
        console.log('[WhatsApp Error] Falha ao criar ocorrência automática:', occErr.message)
      }
    }

    // Save incoming message in whatsapp_messages
    const waCol = $app.findCollectionByNameOrId('whatsapp_messages')
    const incomingRec = new Record(waCol)
    incomingRec.set('direction', 'incoming')
    incomingRec.set('from_number', cleanFrom)
    incomingRec.set('to_number', cleanTo || defaultWaNumber)
    incomingRec.set('body', bodyText)
    incomingRec.set('status', 'received')
    incomingRec.set('twilio_sid', messageSid)
    if (createdOccId) {
      incomingRec.set('occurrence', createdOccId)
    }
    $app.save(incomingRec)

    // Check if auto-reply AI is active from app_settings
    let aiEnabled = true
    try {
      const settingRecs = $app.findRecordsByFilter(
        'app_settings',
        'key = "whatsapp_ai_auto_reply"',
        '',
        1,
        0,
      )
      if (settingRecs.length > 0) {
        aiEnabled = settingRecs[0].getString('value') === 'true'
      }
    } catch (_) {}

    let autoReplyText = ''

    if (aiEnabled) {
      // Query current system context for grounding (active occurrences, shelters, recent alerts)
      let activeOccurrencesInfo = 'Nenhuma ocorrência crítica no momento.'
      try {
        const occs = $app.findRecordsByFilter(
          'occurrences',
          'severity = "critica" && status != "concluida" && status != "cancelada"',
          '-created',
          3,
          0,
        )
        if (occs.length > 0) {
          activeOccurrencesInfo = occs
            .map(
              (o) =>
                '- ' + o.getString('title') + ' (' + (o.getString('address') || 'Sem local') + ')',
            )
            .join('\n')
        }
      } catch (_) {}

      let activeSheltersInfo = 'Consulte a Defesa Civil pelo 199.'
      try {
        const shelters = $app.findRecordsByFilter('shelters', 'status = "ativo"', 'name', 3, 0)
        if (shelters.length > 0) {
          activeSheltersInfo = shelters
            .map((s) => '- ' + s.getString('name') + ' (' + (s.getString('address') || '') + ')')
            .join('\n')
        }
      } catch (_) {}

      let recentAlertsInfo = 'Nenhum alerta recente emitido.'
      try {
        const alerts = $app.findRecordsByFilter('alerts', 'status = "enviado"', '-created', 2, 0)
        if (alerts.length > 0) {
          recentAlertsInfo = alerts
            .map((a) => '- ' + a.getString('title') + ': ' + a.getString('message'))
            .join('\n')
        }
      } catch (_) {}

      let emergencyInstruction = ''
      if (isCriticalEmergency) {
        emergencyInstruction =
          '\nATENÇÃO MÁXIMA: Esta mensagem foi identificada como EMERGÊNCIA CRÍTICA. Uma ocorrência já foi registrada no sistema da Defesa Civil. Sua resposta DEVE OBRIGATORIAMENTE instruir o cidadão a ligar IMEDIATAMENTE para o Corpo de Bombeiros (193), Polícia (190) ou Defesa Civil (199), manter a calma, evacuar para local alto/seguro e não atravessar áreas inundadas.'
      }

      const systemPrompt =
        'Você é o atendente virtual oficial da Defesa Civil Municipal do Brasil no canal de WhatsApp. ' +
        'Responda sempre em português brasileiro (pt-BR) com tom calmo, empático, claro, direto e profissional. ' +
        'Limite sua resposta a NO MÁXIMO 800 caracteres para ser legível e rápida no WhatsApp. ' +
        'Use bullet points ou parágrafos bem curtos quando necessário. ' +
        'Nunca forneça conselhos médicos específicos nem invente informações. ' +
        'Contatos de emergência do município: Defesa Civil 199, Bombeiros 193, SAMU 192, Polícia 190.\n\n' +
        'Contexto operacional atual do município:\n' +
        'Ocorrências críticas ativas:\n' +
        activeOccurrencesInfo +
        '\nAbrigos abertos:\n' +
        activeSheltersInfo +
        '\nAlertas vigentes:\n' +
        recentAlertsInfo +
        emergencyInstruction

      try {
        const reply = $ai.chat({
          model: 'fast',
          messages: [
            { role: 'system', content: systemPrompt },
            {
              role: 'user',
              content: (profileName ? 'Mensagem de ' + profileName + ': ' : '') + bodyText,
            },
          ],
        })

        if (reply && reply.choices && reply.choices[0] && reply.choices[0].message) {
          autoReplyText = reply.choices[0].message.content.trim()
        }
      } catch (aiErr) {
        console.log('[WhatsApp AI Error]', aiErr.message)
        if (isCriticalEmergency) {
          autoReplyText =
            '⚠️ DEFESA CIVIL MUNICIPAL: Registramos seu chamado de emergência. ' +
            'Se estiver em perigo imediato, ligue AGORA para o Corpo de Bombeiros no 193 ou Defesa Civil no 199. ' +
            'Mantenha a calma e dirija-se a um local seguro e elevado.'
        } else {
          autoReplyText =
            'Olá! Você está em contato com a Defesa Civil Municipal. ' +
            'Para emergências urgentes ligue 199 ou 193 (Bombeiros). ' +
            'Nossa equipe recebeu sua mensagem e retornará em breve.'
        }
      }

      // Send or store outgoing reply
      if (autoReplyText) {
        const replyRec = new Record(waCol)
        replyRec.set('direction', 'outgoing')
        replyRec.set('from_number', cleanTo || defaultWaNumber)
        replyRec.set('to_number', cleanFrom)
        replyRec.set('body', autoReplyText)
        if (createdOccId) {
          replyRec.set('occurrence', createdOccId)
        }

        // Check if we can dispatch real Twilio call
        if (!accountSid || !authToken || isPlaceholder(accountSid) || isPlaceholder(authToken)) {
          const warn = 'Twilio não configurado para envio de resposta automática.'
          console.log('[WhatsApp AutoReply]', warn)
          replyRec.set('status', 'draft')
          replyRec.set('error', warn)
          $app.save(replyRec)
        } else {
          // Dispatch to Twilio API
          const twilioUrl =
            'https://api.twilio.com/2010-04-01/Accounts/' +
            encodeURIComponent(accountSid) +
            '/Messages.json'
          const basicAuth = 'Basic ' + $security.base64Encode(accountSid + ':' + authToken)
          const twilioFrom = 'whatsapp:' + (cleanTo || defaultWaNumber)
          const twilioTo = 'whatsapp:' + cleanFrom

          const formBody =
            'From=' +
            encodeURIComponent(twilioFrom) +
            '&To=' +
            encodeURIComponent(twilioTo) +
            '&Body=' +
            encodeURIComponent(autoReplyText)

          try {
            const res = $http.send({
              url: twilioUrl,
              method: 'POST',
              headers: {
                Authorization: basicAuth,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: formBody,
              timeout: 15,
            })

            if (res.statusCode >= 200 && res.statusCode < 300) {
              const resData = res.json || {}
              replyRec.set('status', 'sent')
              replyRec.set('twilio_sid', resData.sid || '')
            } else {
              const errData = res.json || {}
              replyRec.set('status', 'failed')
              replyRec.set('error', errData.message || 'Erro Twilio HTTP ' + res.statusCode)
            }
          } catch (httpErr) {
            replyRec.set('status', 'failed')
            replyRec.set('error', httpErr.message)
          }
          $app.save(replyRec)
        }
      }
    }

    // Return TwiML response
    // When autoReplyText exists and we want Twilio to deliver or know we handled it:
    e.response.header().set('Content-Type', 'text/xml')
    return e.string(200, '<Response></Response>')
  } catch (fatalErr) {
    console.log('[WhatsApp Webhook Fatal]', fatalErr.message)
    e.response.header().set('Content-Type', 'text/xml')
    return e.string(200, '<Response></Response>')
  }
})
