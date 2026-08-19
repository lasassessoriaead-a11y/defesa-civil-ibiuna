cronAdd('alert_autocreate_critical', '*/10 * * * *', () => {
  try {
    // Find non-concluded critical occurrences
    const criticalOccurrences = $app.findRecordsByFilter(
      'occurrences',
      'severity = "critica" && status != "concluida" && status != "cancelada"',
      '-created',
      50,
      0,
    )

    const alertsCol = $app.findCollectionByNameOrId('alerts')

    for (let i = 0; i < criticalOccurrences.length; i++) {
      const occ = criticalOccurrences[i]
      // Check if an alert already references this occurrence
      const existingAlerts = $app.findRecordsByFilter(
        'alerts',
        'related_occurrence = "' + occ.id + '"',
        '-created',
        1,
        0,
      )

      if (existingAlerts.length === 0) {
        const alertRecord = new Record(alertsCol)
        alertRecord.set('title', 'Alerta automático: ' + occ.getString('title'))
        alertRecord.set('type', occ.getString('type') || 'outro')
        alertRecord.set('severity', 'perigo_extremo')
        alertRecord.set('status', 'rascunho')
        alertRecord.set('channel', 'todos')
        alertRecord.set('target_area', occ.getString('address') || 'Área da ocorrência')
        alertRecord.set(
          'message',
          'DEFESA CIVIL ALERTA CRÍTICO: Detectada ocorrência de alta gravidade em ' +
            (occ.getString('address') || 'área municipal') +
            ' (' +
            occ.getString('title') +
            '). Evacue áreas de risco e contate a Defesa Civil pelo 199.',
        )
        alertRecord.set('related_occurrence', occ.id)
        if (occ.getString('reported_by')) {
          alertRecord.set('sent_by', occ.getString('reported_by'))
        }
        $app.save(alertRecord)
      }
    }
  } catch (err) {
    console.log('Erro no cron alert_autocreate:', err.message)
  }
})
