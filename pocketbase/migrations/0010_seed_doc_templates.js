/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    try {
      const templatesCol = app.findCollectionByNameOrId('doc_templates')
      const munCol = app.findCollectionByNameOrId('municipalities')
      const mun = app.findFirstRecordByData('municipalities', 'name', 'Município Inicial')
      const admin = app.findFirstRecordByData('users', 'email', 'luka2510@hotmail.com')

      // Verificar se já tem registros
      const total = app.countRecords('doc_templates')
      if (total === 0) {
        const t1 = new Record(templatesCol)
        t1.set('municipality', mun.id)
        t1.set('title', 'Ofício de Solicitação Padrão')
        t1.set('category', 'solicitacao')
        t1.set('subject', 'Solicitação de apoio institucional em ações preventivas')
        t1.set(
          'content',
          '<p>Cumprimentando-o cordialmente, venho por meio deste solicitar apoio institucional e disponibilização de recursos técnicos e operacionais para suporte nas ações de monitoramento e pronta resposta da Coordenadoria Municipal de Defesa Civil.</p><p>Certos de contar com vossa costumeira colaboração e apreço, renovamos nossos votos de elevada consideração.</p>',
        )
        t1.set('is_default', true)
        t1.set('created_by', admin.id)
        app.save(t1)

        const t2 = new Record(templatesCol)
        t2.set('municipality', mun.id)
        t2.set('title', 'Ofício de Notificação Preventiva')
        t2.set('category', 'notificacao')
        t2.set('subject', 'Notificação de risco iminente e orientações preventivas')
        t2.set(
          'content',
          '<p>Pelo presente instrumento, NOTIFICAMOS V. Sa. quanto à constatação técnica de condições de risco nas proximidades do imóvel sob vossa responsabilidade, conforme vistoria realizada por equipe técnica desta Coordenadoria.</p><p>Solicitamos a adoção imediata das medidas mitigadoras cabíveis no prazo regulamentar, visando salvaguardar a integridade de vidas e patrimônios.</p>',
        )
        t2.set('is_default', false)
        t2.set('created_by', admin.id)
        app.save(t2)
      }
    } catch (e) {
      console.log('Seed templates aviso:', e.message)
    }
  },
  (app) => {
    // Reversível
  },
)
