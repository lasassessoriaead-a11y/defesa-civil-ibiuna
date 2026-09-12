routerAdd(
  'GET',
  '/backend/v1/whatsapp/config',
  (e) => {
    try {
      const accountSid = $os.getenv('TWILIO_ACCOUNT_SID') || ''
      const authToken = $os.getenv('TWILIO_AUTH_TOKEN') || ''
      const waNumber = $os.getenv('TWILIO_WHATSAPP_NUMBER') || ''

      const isPlaceholder = (val) => {
        if (!val) return true
        const s = String(val).trim().toLowerCase()
        return (
          s.indexOf('placeholder') !== -1 || s === 'ac_placeholder' || s === 'placeholder_token'
        )
      }

      const configured =
        Boolean(accountSid && authToken && waNumber) &&
        !isPlaceholder(accountSid) &&
        !isPlaceholder(authToken)

      // Mask token and sid
      const maskedSid =
        accountSid.length > 8
          ? accountSid.substring(0, 4) + '...' + accountSid.substring(accountSid.length - 4)
          : accountSid
            ? '***'
            : ''

      // Determine webhook public url from PB_INSTANCE_URL or SITE_URL
      let baseUrl = $os.getenv('PB_INSTANCE_URL') || $os.getenv('SITE_URL') || ''
      if (baseUrl.endsWith('/')) {
        baseUrl = baseUrl.slice(0, -1)
      }
      const webhookUrl = baseUrl ? baseUrl + '/wa/webhook' : '/wa/webhook'

      return e.json(200, {
        configured: configured,
        account_sid_configured: Boolean(accountSid && !isPlaceholder(accountSid)),
        auth_token_configured: Boolean(authToken && !isPlaceholder(authToken)),
        account_sid_masked: maskedSid,
        whatsapp_number: waNumber || '+14155238886',
        webhook_url: webhookUrl,
      })
    } catch (err) {
      console.log('Erro ao carregar config WhatsApp:', err.message)
      return e.json(500, { error: 'Falha ao obter configuração' })
    }
  },
  $apis.requireAuth(),
)
