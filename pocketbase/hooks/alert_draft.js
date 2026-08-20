routerAdd(
  'POST',
  '/backend/v1/alerts/draft',
  (e) => {
    try {
      const body = e.requestInfo().body || {}
      const type = body.type || 'enchente'
      const severity = body.severity || 'alerta'
      const targetArea = body.target_area || 'Município'
      const title = body.title || ''

      const systemPrompt =
        "Você é o especialista de comunicação de emergência da Defesa Civil Municipal do Brasil. Crie uma mensagem de alerta urgente, clara, direta e objetiva em português brasileiro (pt-BR) destinada à população civil sobre um evento climático extremo. A mensagem deve começar com 'DEFESA CIVIL ALERTA:', especificar o nível de gravidade, a área afetada, as orientações essenciais de autoproteção (ex: evacuação, abrigos, desligar energia) e o telefone de emergência 199. Seja conciso (máximo 2 a 3 parágrafos curtos ou tópicos diretos). Não use preâmbulos ou saudações como 'Olá'. Devolva apenas o texto pronto para envio."

      const userPrompt =
        'Tipo de evento: ' +
        type +
        '\nSeveridade/Gravidade: ' +
        severity +
        '\nÁrea/Bairro Alvo: ' +
        targetArea +
        '\nTítulo da ocorrência: ' +
        title

      const reply = $ai.chat({
        model: 'fast',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      })

      const draftText =
        reply.choices && reply.choices[0] && reply.choices[0].message
          ? reply.choices[0].message.content
          : 'DEFESA CIVIL ALERTA: Risco meteorológico extremo em ' +
            targetArea +
            '. Mantenha-se em local seguro e ligue 199 em caso de emergência.'

      return e.json(200, {
        message: draftText.trim(),
      })
    } catch (err) {
      if (err instanceof SkipAiConfigError) {
        return e.json(503, { error: 'AI temporarily unavailable' })
      }
      if (err instanceof SkipAiError) {
        const status = err.status || 502
        return e.json(status, { error: err.message || 'Erro ao consultar IA' })
      }
      return e.json(500, { error: 'Falha ao gerar rascunho de alerta' })
    }
  },
  $apis.requireAuth(),
)
