/// <reference path="../pb_data/types.d.ts" />
migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    let adminUser = null

    try {
      adminUser = app.findAuthRecordByEmail('_pb_users_auth_', 'luka2510@hotmail.com')
    } catch (_) {
      const record = new Record(users)
      record.setEmail('luka2510@hotmail.com')
      record.setPassword('Skip@Pass')
      record.setVerified(true)
      record.set('name', 'Defesa Civil Operador')
      app.save(record)
      adminUser = record
    }

    const userId = adminUser.id

    // 1. Seed Occurrences
    const occurrencesCol = app.findCollectionByNameOrId('occurrences')
    const occ1Data = {
      title: 'Transbordamento do Rio de la Plata causa alagamento no Centro',
      description:
        'Nível do rio subiu 2.8m acima da cota de alerta após chuvas torrenciais do El Niño. Vias centrais alagadas e famílias ilhadas.',
      type: 'enchente',
      severity: 'alta',
      status: 'em_andamento',
      latitude: -23.5505,
      longitude: -46.6333,
      address: 'Av. Marginal do Rio, Centro Histórico',
      affectable_population: 1200,
      reported_by: userId,
    }

    const occ2Data = {
      title: 'Deslizamento de terra na encosta do Morro Verde',
      description:
        'Desabamento parcial de encosta após solo saturado. Risco iminente de colapso de 12 moradias na encosta.',
      type: 'deslizamento',
      severity: 'critica',
      status: 'em_andamento',
      latitude: -23.535,
      longitude: -46.62,
      address: 'Rua das Palmeiras, Morro Verde',
      affectable_population: 350,
      reported_by: userId,
    }

    const occ3Data = {
      title: 'Estiagem prolongada afeta zona rural do município',
      description:
        'Seca severa de 45 dias sem precipitação significativa. Desabastecimento hídrico de comunidades agrícolas e risco de perdas de safra.',
      type: 'seca',
      severity: 'media',
      status: 'reportada',
      latitude: -23.58,
      longitude: -46.68,
      address: 'Estrada dos Produtores, KM 14, Zona Rural',
      affectable_population: 800,
      reported_by: userId,
    }

    const occ4Data = {
      title: 'Vendaval derruba árvores na Avenida Principal',
      description:
        'Rajadas de vento de 78km/h causaram queda de 5 árvores de grande porte, bloqueio total de via e interrupção na rede elétrica.',
      type: 'tempestade',
      severity: 'baixa',
      status: 'concluida',
      latitude: -23.56,
      longitude: -46.65,
      address: 'Avenida Principal, Bairro Jardim',
      affectable_population: 150,
      reported_by: userId,
      resolved_at: '2026-08-18 16:30:00.000Z',
    }

    let occ1Record = null
    let occ2Record = null

    try {
      occ1Record = app.findFirstRecordByData('occurrences', 'title', occ1Data.title)
    } catch (_) {
      occ1Record = new Record(occurrencesCol)
      for (const k of Object.keys(occ1Data)) {
        occ1Record.set(k, occ1Data[k])
      }
      app.save(occ1Record)
    }

    try {
      occ2Record = app.findFirstRecordByData('occurrences', 'title', occ2Data.title)
    } catch (_) {
      occ2Record = new Record(occurrencesCol)
      for (const k of Object.keys(occ2Data)) {
        occ2Record.set(k, occ2Data[k])
      }
      app.save(occ2Record)
    }

    try {
      app.findFirstRecordByData('occurrences', 'title', occ3Data.title)
    } catch (_) {
      const rec = new Record(occurrencesCol)
      for (const k of Object.keys(occ3Data)) {
        rec.set(k, occ3Data[k])
      }
      app.save(rec)
    }

    try {
      app.findFirstRecordByData('occurrences', 'title', occ4Data.title)
    } catch (_) {
      const rec = new Record(occurrencesCol)
      for (const k of Object.keys(occ4Data)) {
        rec.set(k, occ4Data[k])
      }
      app.save(rec)
    }

    // 2. Seed Shelters
    const sheltersCol = app.findCollectionByNameOrId('shelters')
    const sheltersData = [
      {
        name: 'Escola Municipal Padre Anchieta',
        address: 'Rua do Saber, 120, Bairro Jardim',
        latitude: -23.542,
        longitude: -46.641,
        capacity: 200,
        occupancy: 148,
        status: 'ativo',
        contact: '(11) 98765-4321 - Coord. Sandra',
      },
      {
        name: 'Ginásio Poliesportivo Municipal',
        address: 'Av. dos Esportes, 500, Centro',
        latitude: -23.555,
        longitude: -46.629,
        capacity: 350,
        occupancy: 0,
        status: 'ativo',
        contact: '(11) 98888-1122 - Coord. Roberto',
      },
      {
        name: 'Salão Paroquial São José',
        address: 'Praça da Matriz, 45, Bairro Alto',
        latitude: -23.538,
        longitude: -46.615,
        capacity: 80,
        occupancy: 82,
        status: 'cheio',
        contact: '(11) 97777-3344 - Padre Marcos',
      },
    ]

    for (const s of sheltersData) {
      try {
        app.findFirstRecordByData('shelters', 'name', s.name)
      } catch (_) {
        const rec = new Record(sheltersCol)
        for (const k of Object.keys(s)) {
          rec.set(k, s[k])
        }
        app.save(rec)
      }
    }

    // 3. Seed Teams
    const teamsCol = app.findCollectionByNameOrId('teams')
    const teamsData = [
      {
        name: 'Corpo de Bombeiros - Pelotão 1',
        type: 'resgate',
        leader_name: 'Capitão Mendes',
        member_count: 8,
        status: 'em_operacao',
        current_occurrence: occ2Record ? occ2Record.id : null,
        latitude: -23.5352,
        longitude: -46.6205,
      },
      {
        name: 'Equipe de Saúde Voluntária',
        type: 'saude',
        leader_name: 'Dra. Letícia Ramos',
        member_count: 6,
        status: 'disponivel',
        current_occurrence: null,
        latitude: -23.5425,
        longitude: -46.6415,
      },
      {
        name: 'Brigada de Logística Municipal',
        type: 'logistica',
        leader_name: 'Sgt. Oliveira',
        member_count: 12,
        status: 'descanso',
        current_occurrence: null,
        latitude: -23.5555,
        longitude: -46.6285,
      },
      {
        name: 'Defesa Civil - Engenharia e Risco',
        type: 'engenharia',
        leader_name: 'Eng. Carlos Prado',
        member_count: 4,
        status: 'em_operacao',
        current_occurrence: occ1Record ? occ1Record.id : null,
        latitude: -23.5502,
        longitude: -46.633,
      },
    ]

    for (const t of teamsData) {
      try {
        app.findFirstRecordByData('teams', 'name', t.name)
      } catch (_) {
        const rec = new Record(teamsCol)
        for (const k of Object.keys(t)) {
          rec.set(k, t[k])
        }
        app.save(rec)
      }
    }

    // 4. Seed Supplies
    const suppliesCol = app.findCollectionByNameOrId('supplies')
    const suppliesData = [
      {
        name: 'Água mineral 5L',
        category: 'agua',
        quantity: 120,
        unit: 'caixas',
        status: 'critico',
        location: 'Galpão Central - Setor A',
        min_threshold: 200,
      },
      {
        name: 'Cestas básicas de emergência',
        category: 'alimentos',
        quantity: 450,
        unit: 'unidades',
        status: 'disponivel',
        location: 'Galpão Central - Setor B',
        min_threshold: 150,
      },
      {
        name: 'Cobertores térmicos',
        category: 'roupas_cobertores',
        quantity: 60,
        unit: 'unidades',
        status: 'critico',
        location: 'Depósito de Donativos',
        min_threshold: 100,
      },
      {
        name: 'Kits de higiene familiar',
        category: 'higiene',
        quantity: 300,
        unit: 'kits',
        status: 'disponivel',
        location: 'Galpão Central - Setor C',
        min_threshold: 100,
      },
      {
        name: 'Colchonetes impermeáveis',
        category: 'equipamentos',
        quantity: 0,
        unit: 'unidades',
        status: 'esgotado',
        location: 'Depósito de Donativos',
        min_threshold: 50,
      },
      {
        name: 'Kits de Primeiros Socorros Avançados',
        category: 'medicamentos',
        quantity: 45,
        unit: 'kits',
        status: 'disponivel',
        location: 'Farmácia Central Municipal',
        min_threshold: 20,
      },
    ]

    for (const sup of suppliesData) {
      try {
        app.findFirstRecordByData('supplies', 'name', sup.name)
      } catch (_) {
        const rec = new Record(suppliesCol)
        for (const k of Object.keys(sup)) {
          rec.set(k, sup[k])
        }
        app.save(rec)
      }
    }

    // 5. Seed Alerts
    const alertsCol = app.findCollectionByNameOrId('alerts')
    const alert1Data = {
      title: 'Alerta de enchente — Bairro Centro',
      type: 'enchente',
      severity: 'perigo',
      message:
        'DEFESA CIVIL ALERTA: Devido às chuvas contínuas e transbordamento do Rio de la Plata, evacue áreas baixas do Centro. Procure o abrigo na Escola Pe. Anchieta ou ligue 199 em emergências.',
      target_area: 'Bacia do Rio de la Plata / Bairro Centro',
      channel: 'todos',
      status: 'enviado',
      sent_by: userId,
      related_occurrence: occ1Record ? occ1Record.id : null,
    }

    try {
      app.findFirstRecordByData('alerts', 'title', alert1Data.title)
    } catch (_) {
      const rec = new Record(alertsCol)
      for (const k of Object.keys(alert1Data)) {
        rec.set(k, alert1Data[k])
      }
      app.save(rec)
    }

    // 6. Seed Affected Areas
    const affectedAreasCol = app.findCollectionByNameOrId('affected_areas')
    const areasData = [
      {
        name: 'Bacia do Rio de la Plata',
        hazard_type: 'enchente',
        risk_level: 'critico',
        status: 'monitorado',
        coordinates: '-23.5505,-46.6333',
        area_polygon: JSON.stringify([
          [-23.546, -46.638],
          [-23.548, -46.629],
          [-23.555, -46.631],
          [-23.554, -46.639],
        ]),
        affected_population: 3200,
        notes:
          'Área sujeita a alagamentos rápidos com chuva > 40mm/h. Monitoramento por réguas telemétricas e sirenes ativas.',
      },
      {
        name: 'Encosta do Morro Verde',
        hazard_type: 'deslizamento',
        risk_level: 'critico',
        status: 'interditado',
        coordinates: '-23.5350,-46.6200',
        area_polygon: JSON.stringify([
          [-23.532, -46.624],
          [-23.533, -46.616],
          [-23.539, -46.618],
          [-23.538, -46.625],
        ]),
        affected_population: 650,
        notes:
          'Solo com alto grau de saturação (pluviômetro acumulou 180mm em 72h). Área evacuada e interditada por risco de deslizamento.',
      },
      {
        name: 'Zona Rural Norte',
        hazard_type: 'seca',
        risk_level: 'alto',
        status: 'monitorado',
        coordinates: '-23.5800,-46.6800',
        area_polygon: JSON.stringify([
          [-23.57, -46.69],
          [-23.572, -46.67],
          [-23.59, -46.672],
          [-23.588, -46.695],
        ]),
        affected_population: 1400,
        notes:
          'Escassez severa em mananciais e poços artesianos. Abastecimento emergencial por caminhões-pipa coordenado pela equipe de logística.',
      },
    ]

    for (const a of areasData) {
      try {
        app.findFirstRecordByData('affected_areas', 'name', a.name)
      } catch (_) {
        const rec = new Record(affectedAreasCol)
        for (const k of Object.keys(a)) {
          rec.set(k, a[k])
        }
        app.save(rec)
      }
    }
  },
  (app) => {
    // down migration
  },
)
