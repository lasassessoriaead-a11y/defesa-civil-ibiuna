routerAdd(
  'POST',
  '/backend/v1/whatsapp/send',
  (e) => {
    try {
      const body = e.requestInfo().body || {}
      const to = (body.to || '').trim()
      const messageText = (body.message || '').trim()
      const occurrenceId = body.occurrence_id || null

      if (!to) {
        return e.badRequestError('O destinatário (to) é obrigatório.')
      }
      if (!messageText) {
        return e.badRequestError('A mensagem (message) é obrigatória.')
      }

      const accountSid = $os.getenv('TWILIO_ACCOUNT_SID') || ''
      const authToken = $os.getenv('TWILIO_AUTH_TOKEN') || ''
      const defaultWaNumber = $os.getenv('TWILIO_WHATSAPP_NUMBER') || '+14155238886'

      const isPlaceholder = (val) => {
        if (!val) return true
        const s = String(val).trim().toLowerCase()
        return (
          s.indexOf('placeholder') !== -1 || s === 'ac_placeholder' || s === 'placeholder_token'
        )
      }

      // Format recipient number (strip "whatsapp:" prefix if present, then normalize)
      let cleanTo = to
      if (cleanTo.toLowerCase().startsWith('whatsapp:')) {
        cleanTo = cleanTo.substring(9).trim()
      }
      if (!cleanTo.startsWith('+')) {
        cleanTo = '+' + cleanTo.replace(/\D/g, '')
      }

      let fromNumber = defaultWaNumber
      if (fromNumber.toLowerCase().startsWith('whatsapp:')) {
        fromNumber = fromNumber.substring(9).trim()
      }

      const waMessagesCol = $app.findCollectionByNameOrId('whatsapp_messages')
      const msgRecord = new Record(waMessagesCol)
      msgRecord.set('direction', 'outgoing')
      msgRecord.set('from_number', fromNumber)
      msgRecord.set('to_number', cleanTo)
      msgRecord.set('body', messageText)
      if (occurrenceId) {
        msgRecord.set('occurrence', occurrenceId)
      }

      // Check if Twilio is configured
      if (!accountSid || !authToken || isPlaceholder(accountSid) || isPlaceholder(authToken)) {
        const errorMsg =
          'Twilio não configurado (TWILIO_ACCOUNT_SID ou TWILIO_AUTH_TOKEN ausentes).'
        console.log('[WhatsApp Send Warning]', errorMsg)
        msgRecord.set('status', 'failed')
        msgRecord.set('error', errorMsg)
        $app.save(msgRecord)

        return e.json(200, {
          success: false,
          warning:
            'Mensagem registrada, mas não enviada ao Twilio por falta de credenciais válidas.',
          record: {
            id: msgRecord.id,
            status: 'failed',
            error: errorMsg,
            created: msgRecord.getString('created'),
          },
        })
      }

      // Build Twilio API call
      const twilioUrl =
        'https://api.twilio.com/2010-04-01/Accounts/' +
        encodeURIComponent(accountSid) +
        '/Messages.json'

      // Basic Auth header
      const basicAuth = 'Basic ' + $security.base64Encode(accountSid + ':' + authToken)

      const twilioFrom = 'whatsapp:' + fromNumber
      const twilioTo = 'whatsapp:' + cleanTo

      // Form urlencoded body
      const formBody =
        'From=' +
        encodeURIComponent(twilioFrom) +
        '&To=' +
        encodeURIComponent(twilioTo) +
        '&Body=' +
        encodeURIComponent(messageText)

      const response = $http.send({
        url: twilioUrl,
        method: 'POST',
        headers: {
          Authorization: basicAuth,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formBody,
        timeout: 15,
      })

      if (response.statusCode >= 200 && response.statusCode < 300) {
        const resJson = response.json || {}
        msgRecord.set('status', 'sent')
        msgRecord.set('twilio_sid', resJson.sid || '')
        $app.save(msgRecord)

        return e.json(200, {
          success: true,
          sid: resJson.sid,
          record: {
            id: msgRecord.id,
            status: 'sent',
            twilio_sid: resJson.sid,
            created: msgRecord.getString('created'),
          },
        })
      } else {
        const resJson = response.json || {}
        const errorMsg = resJson.message || 'Erro HTTP ' + response.statusCode + ' do Twilio'
        console.log('[WhatsApp Twilio Error]', errorMsg)
        msgRecord.set('status', 'failed')
        msgRecord.set('error', errorMsg)
        $app.save(msgRecord)

        return e.json(200, {
          success: false,
          error: errorMsg,
          record: {
            id: msgRecord.id,
            status: 'failed',
            error: errorMsg,
            created: msgRecord.getString('created'),
          },
        })
      }
    } catch (err) {
      console.log('[WhatsApp Send Fatal]', err.message)
      return e.json(500, { error: 'Falha no processamento do envio: ' + err.message })
    }
  },
  $apis.requireAuth(),
)
