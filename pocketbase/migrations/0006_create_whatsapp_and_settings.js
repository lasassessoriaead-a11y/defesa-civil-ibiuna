/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const occCol = app.findCollectionByNameOrId('occurrences')
    const occId = occCol.id

    // 1. whatsapp_messages
    const whatsappMessages = new Collection({
      name: 'whatsapp_messages',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'direction',
          type: 'select',
          required: true,
          values: ['incoming', 'outgoing'],
          maxSelect: 1,
        },
        { name: 'from_number', type: 'text', required: true },
        { name: 'to_number', type: 'text', required: true },
        { name: 'body', type: 'text', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['received', 'sent', 'failed', 'draft'],
          maxSelect: 1,
        },
        {
          name: 'occurrence',
          type: 'relation',
          collectionId: occId,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'twilio_sid', type: 'text' },
        { name: 'error', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_wa_from ON whatsapp_messages (from_number)',
        'CREATE INDEX idx_wa_to ON whatsapp_messages (to_number)',
        'CREATE INDEX idx_wa_direction ON whatsapp_messages (direction)',
        'CREATE INDEX idx_wa_status ON whatsapp_messages (status)',
        'CREATE INDEX idx_wa_created ON whatsapp_messages (created DESC)',
      ],
    })
    app.save(whatsappMessages)

    // 2. app_settings (key/value config store)
    const appSettings = new Collection({
      name: 'app_settings',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'key', type: 'text', required: true },
        { name: 'value', type: 'text', required: true },
        { name: 'description', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_app_settings_key ON app_settings (key)'],
    })
    app.save(appSettings)

    // Seed default setting: auto_reply_ai = true
    try {
      const rec = new Record(appSettings)
      rec.set('key', 'whatsapp_ai_auto_reply')
      rec.set('value', 'true')
      rec.set('description', 'Atendimento automático por IA no WhatsApp')
      app.save(rec)
    } catch (_) {}
  },
  (app) => {
    try {
      const waCol = app.findCollectionByNameOrId('whatsapp_messages')
      app.delete(waCol)
    } catch (_) {}
    try {
      const setCol = app.findCollectionByNameOrId('app_settings')
      app.delete(setCol)
    } catch (_) {}
  },
)
