migrate(
  (app) => {
    const munCol = app.findCollectionByNameOrId('municipalities')
    const munId = munCol.id
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const usersId = usersCol.id

    // 1. Ampliar coleção 'users' com 'department' para segregação intersetorial
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!users.fields.getByName('department')) {
      users.fields.add(
        new SelectField({
          name: 'department',
          required: false,
          values: [
            'defesa_civil',
            'desenvolvimento_urbano',
            'assistencia_social',
            'saude',
            'educacao',
            'obras',
            'meio_ambiente',
            'servicos_municipais',
            'administracao',
            'outras',
          ],
          maxSelect: 1,
        }),
      )
      app.save(users)
    }

    // 2. Ampliar 'shelters' para suporte completo a Escolas e Equipamentos Candidatos
    const shelters = app.findCollectionByNameOrId('shelters')
    if (!shelters.fields.getByName('facility_type')) {
      shelters.fields.add(
        new SelectField({
          name: 'facility_type',
          required: false,
          values: [
            'escola',
            'creche',
            'ginasio',
            'centro_comunitario',
            'igreja',
            'equipamento_publico',
            'outro',
          ],
          maxSelect: 1,
        }),
      )
    }
    if (!shelters.fields.getByName('shelter_classification')) {
      shelters.fields.add(
        new SelectField({
          name: 'shelter_classification',
          required: false,
          values: [
            'escola_cadastrada',
            'candidato_avaliacao_pendente',
            'abrigo_aprovado',
            'abrigo_ativado',
            'indisponivel',
          ],
          maxSelect: 1,
        }),
      )
    }
    if (!shelters.fields.getByName('responsible_secretary')) {
      shelters.fields.add(
        new SelectField({
          name: 'responsible_secretary',
          required: false,
          values: [
            'educacao',
            'defesa_civil',
            'assistencia_social',
            'saude',
            'esportes',
            'obras',
            'outras',
          ],
          maxSelect: 1,
        }),
      )
    }
    if (!shelters.fields.getByName('contact_person')) {
      shelters.fields.add(new TextField({ name: 'contact_person' }))
    }
    if (!shelters.fields.getByName('has_accessibility')) {
      shelters.fields.add(new BoolField({ name: 'has_accessibility' }))
    }
    if (!shelters.fields.getByName('has_water')) {
      shelters.fields.add(new BoolField({ name: 'has_water' }))
    }
    if (!shelters.fields.getByName('has_generator_power')) {
      shelters.fields.add(new BoolField({ name: 'has_generator_power' }))
    }
    if (!shelters.fields.getByName('restrooms_count')) {
      shelters.fields.add(new NumberField({ name: 'restrooms_count' }))
    }
    if (!shelters.fields.getByName('has_kitchen')) {
      shelters.fields.add(new BoolField({ name: 'has_kitchen' }))
    }
    if (!shelters.fields.getByName('rooms_available')) {
      shelters.fields.add(new NumberField({ name: 'rooms_available' }))
    }
    if (!shelters.fields.getByName('assessed_capacity')) {
      shelters.fields.add(new NumberField({ name: 'assessed_capacity' }))
    }
    if (!shelters.fields.getByName('capacity_assessed_by')) {
      shelters.fields.add(new TextField({ name: 'capacity_assessed_by' }))
    }
    if (!shelters.fields.getByName('capacity_assessed_date')) {
      shelters.fields.add(new DateField({ name: 'capacity_assessed_date' }))
    }
    if (!shelters.fields.getByName('usage_restrictions')) {
      shelters.fields.add(new TextField({ name: 'usage_restrictions' }))
    }
    if (!shelters.fields.getByName('access_notes')) {
      shelters.fields.add(new TextField({ name: 'access_notes' }))
    }
    if (!shelters.fields.getByName('bridge_dependency')) {
      shelters.fields.add(new TextField({ name: 'bridge_dependency' }))
    }
    app.save(shelters)

    // 3. Ampliar 'strategic_infrastructures' com dados operacionais de dependência e risco de isolamento
    const infras = app.findCollectionByNameOrId('strategic_infrastructures')
    if (!infras.fields.getByName('communities_served')) {
      infras.fields.add(new TextField({ name: 'communities_served' }))
    }
    if (!infras.fields.getByName('families_dependent_count')) {
      infras.fields.add(new NumberField({ name: 'families_dependent_count' }))
    }
    if (!infras.fields.getByName('persons_dependent_count')) {
      infras.fields.add(new NumberField({ name: 'persons_dependent_count' }))
    }
    if (!infras.fields.getByName('main_route_description')) {
      infras.fields.add(new TextField({ name: 'main_route_description' }))
    }
    if (!infras.fields.getByName('has_alternative_access')) {
      infras.fields.add(
        new SelectField({
          name: 'has_alternative_access',
          required: false,
          values: [
            'acesso_alternativo_confirmado',
            'possivel_isolamento',
            'sem_alternativa_identificada',
            'ainda_nao_verificado',
          ],
          maxSelect: 1,
        }),
      )
    }
    if (!infras.fields.getByName('detour_route_description')) {
      infras.fields.add(new TextField({ name: 'detour_route_description' }))
    }
    if (!infras.fields.getByName('detour_distance_km')) {
      infras.fields.add(new NumberField({ name: 'detour_distance_km' }))
    }
    if (!infras.fields.getByName('detour_time_minutes')) {
      infras.fields.add(new NumberField({ name: 'detour_time_minutes' }))
    }
    if (!infras.fields.getByName('detour_estimate_method')) {
      infras.fields.add(new TextField({ name: 'detour_estimate_method' }))
    }
    if (!infras.fields.getByName('detour_estimate_date')) {
      infras.fields.add(new DateField({ name: 'detour_estimate_date' }))
    }
    if (!infras.fields.getByName('rainy_season_condition')) {
      infras.fields.add(new TextField({ name: 'rainy_season_condition' }))
    }
    if (!infras.fields.getByName('ambulance_passable')) {
      infras.fields.add(new BoolField({ name: 'ambulance_passable' }))
    }
    if (!infras.fields.getByName('school_bus_passable')) {
      infras.fields.add(new BoolField({ name: 'school_bus_passable' }))
    }
    if (!infras.fields.getByName('service_truck_passable')) {
      infras.fields.add(new BoolField({ name: 'service_truck_passable' }))
    }
    if (!infras.fields.getByName('known_restrictions')) {
      infras.fields.add(new TextField({ name: 'known_restrictions' }))
    }
    if (!infras.fields.getByName('isolation_contingency_plan')) {
      infras.fields.add(new TextField({ name: 'isolation_contingency_plan' }))
    }
    if (!infras.fields.getByName('routes_geojson')) {
      infras.fields.add(new TextField({ name: 'routes_geojson' }))
    }
    app.save(infras)

    // 4. Nova Coleção: 'urban_consultations' (Consultas Territoriais para Desenvolvimento Urbano)
    if (!app.hasTable('urban_consultations')) {
      const urbanConsultations = new Collection({
        name: 'urban_consultations',
        type: 'base',
        listRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        viewRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        createRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        updateRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        deleteRule:
          "@request.auth.id != '' && municipality = @request.auth.municipality && (@request.auth.role = 'administrador' || @request.auth.role = 'coordenador')",
        fields: [
          {
            name: 'municipality',
            type: 'relation',
            required: true,
            collectionId: munId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'process_number', type: 'text', required: true },
          { name: 'requester_name', type: 'text' },
          {
            name: 'purpose',
            type: 'select',
            values: [
              'loteamento',
              'desmembramento',
              'parcelamento',
              'construcao',
              'regularizacao',
              'outro',
            ],
            maxSelect: 1,
          },
          { name: 'location_address', type: 'text', required: true },
          { name: 'neighborhood', type: 'text' },
          { name: 'latitude', type: 'number' },
          { name: 'longitude', type: 'number' },
          { name: 'perimeter_geojson', type: 'text' }, // Polígono WGS84
          {
            name: 'perimeter_source',
            type: 'select',
            values: ['desenhado_mapa', 'importado_geojson', 'ponto_preliminar'],
            maxSelect: 1,
          },
          { name: 'responsible_officer', type: 'text' },
          { name: 'department_sender', type: 'text' },
          {
            name: 'analysis_status',
            type: 'select',
            values: [
              'registrada',
              'encaminhada_analise',
              'em_analise_tecnica',
              'vistoria_solicitada',
              'parecer_emitido',
              'arquivada',
            ],
            maxSelect: 1,
          },
          {
            name: 'intersection_result',
            type: 'select',
            values: [
              'intersecao_encontrada',
              'nenhuma_intersecao_encontrada',
              'inconclusiva_informacao_insuficiente',
            ],
            maxSelect: 1,
          },
          { name: 'intersection_details', type: 'json' }, // Lista de camadas, fontes, datas e feições que cruzaram
          { name: 'technical_disclaimer', type: 'text' }, // Ressalva obrigatória legal
          { name: 'observations', type: 'text' },
          { name: 'created_by', type: 'relation', collectionId: usersId, maxSelect: 1 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_urb_cons_mun_proc ON urban_consultations (municipality, process_number)',
          'CREATE INDEX idx_urb_cons_status ON urban_consultations (municipality, analysis_status)',
        ],
      })
      app.save(urbanConsultations)
    }

    // 5. Nova Coleção: 'surveyed_families' (Ficha de Levantamento em Campo - Residência/Família)
    if (!app.hasTable('surveyed_families')) {
      const surveyedFamilies = new Collection({
        name: 'surveyed_families',
        type: 'base',
        listRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        viewRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        createRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        updateRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        deleteRule:
          "@request.auth.id != '' && municipality = @request.auth.municipality && (@request.auth.role = 'administrador' || @request.auth.role = 'coordenador')",
        fields: [
          {
            name: 'municipality',
            type: 'relation',
            required: true,
            collectionId: munId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'family_internal_code', type: 'text', required: true },
          { name: 'responsible_name', type: 'text', required: true },
          { name: 'contact_phone', type: 'text' },
          { name: 'address', type: 'text', required: true },
          { name: 'neighborhood', type: 'text' },
          { name: 'latitude', type: 'number' },
          { name: 'longitude', type: 'number' },
          { name: 'members_count', type: 'number' },
          { name: 'children_count', type: 'number' },
          { name: 'elderly_count', type: 'number' },
          { name: 'disabled_count', type: 'number' },
          { name: 'has_mobility_limitation', type: 'bool' },
          { name: 'needs_accessible_transport', type: 'bool' },
          { name: 'special_support_needs', type: 'text' },
          { name: 'communication_preferences', type: 'text' },
          { name: 'risk_sector_code', type: 'text' },
          { name: 'danger_stretch_code', type: 'text' },
          { name: 'crossing_infrastructure_codes', type: 'text' }, // Ex: "P1, P2"
          { name: 'visit_date', type: 'date' },
          { name: 'survey_team', type: 'text' },
          { name: 'information_source', type: 'text' },
          {
            name: 'survey_status',
            type: 'select',
            values: ['declarada', 'observada', 'conferida', 'pendente'],
            maxSelect: 1,
          },
          { name: 'update_needed', type: 'bool' },
          {
            name: 'duplicate_review_status',
            type: 'select',
            values: ['ok', 'possivel_duplicidade', 'revisado_sem_fusao'],
            maxSelect: 1,
          },
          { name: 'notes', type: 'text' },
          { name: 'created_by', type: 'relation', collectionId: usersId, maxSelect: 1 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_fam_mun_code ON surveyed_families (municipality, family_internal_code)',
          'CREATE INDEX idx_fam_status ON surveyed_families (municipality, survey_status)',
        ],
      })
      app.save(surveyedFamilies)
    }

    // 6. Nova Coleção: 'social_family_actions' (Assistência Social - Atendimentos e Acolhimento)
    if (!app.hasTable('social_family_actions')) {
      const famCol = app.findCollectionByNameOrId('surveyed_families')
      const famId = famCol.id
      const socialActions = new Collection({
        name: 'social_family_actions',
        type: 'base',
        listRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        viewRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        createRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        updateRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        deleteRule:
          "@request.auth.id != '' && municipality = @request.auth.municipality && (@request.auth.role = 'administrador' || @request.auth.role = 'coordenador')",
        fields: [
          {
            name: 'municipality',
            type: 'relation',
            required: true,
            collectionId: munId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'family',
            type: 'relation',
            required: true,
            collectionId: famId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'action_type',
            type: 'select',
            values: [
              'atendimento_cras_creas',
              'encaminhamento_beneficio',
              'acompanhamento_continuo',
              'necessidade_acolhimento',
              'reassentamento_preventivo',
              'aluguel_social',
              'outro',
            ],
            maxSelect: 1,
          },
          { name: 'description', type: 'text', required: true },
          { name: 'responsible_worker', type: 'text' },
          { name: 'action_date', type: 'date' },
          {
            name: 'status',
            type: 'select',
            values: ['aberto', 'em_andamento', 'concluido', 'cancelado'],
            maxSelect: 1,
          },
          { name: 'notes', type: 'text' },
          { name: 'created_by', type: 'relation', collectionId: usersId, maxSelect: 1 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_soc_mun_fam ON social_family_actions (municipality, family)'],
      })
      app.save(socialActions)
    }

    // 7. Nova Coleção: 'health_operational_needs' (Saúde - Necessidades Operacionais Estritamente não-clínicas)
    if (!app.hasTable('health_operational_needs')) {
      const famCol = app.findCollectionByNameOrId('surveyed_families')
      const famId = famCol.id
      const healthNeeds = new Collection({
        name: 'health_operational_needs',
        type: 'base',
        listRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        viewRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        createRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        updateRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        deleteRule:
          "@request.auth.id != '' && municipality = @request.auth.municipality && (@request.auth.role = 'administrador' || @request.auth.role = 'coordenador')",
        fields: [
          {
            name: 'municipality',
            type: 'relation',
            required: true,
            collectionId: munId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'family',
            type: 'relation',
            required: true,
            collectionId: famId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          {
            name: 'mobility_support_type',
            type: 'select',
            values: ['nenhum', 'maca', 'cadeira_rodas', 'ambulancia_simples', 'ambulancia_uti'],
            maxSelect: 1,
          },
          { name: 'requires_power_equipment', type: 'bool' }, // Oxigênio/CPAP/diálise dependente de energia
          { name: 'power_equipment_notes', type: 'text' },
          { name: 'care_continuity_notes', type: 'text' }, // Ex: paciente acamado necessita visita domiciliar da UBS
          {
            name: 'priority_level',
            type: 'select',
            values: ['normal', 'alta', 'imediata_evacuacao'],
            maxSelect: 1,
          },
          { name: 'health_unit_reference', type: 'text' },
          { name: 'verified_by_nurse_or_agent', type: 'text' },
          {
            name: 'status',
            type: 'select',
            values: ['pendente', 'atendido', 'monitorado', 'encaminhado'],
            maxSelect: 1,
          },
          { name: 'created_by', type: 'relation', collectionId: usersId, maxSelect: 1 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_hlth_mun_fam ON health_operational_needs (municipality, family)',
        ],
      })
      app.save(healthNeeds)
    }

    // 8. Nova Coleção: 'contingency_plans' (Planos Municipais, Setoriais e por Cenário)
    if (!app.hasTable('contingency_plans')) {
      const plans = new Collection({
        name: 'contingency_plans',
        type: 'base',
        listRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        viewRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        createRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        updateRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        deleteRule:
          "@request.auth.id != '' && municipality = @request.auth.municipality && (@request.auth.role = 'administrador' || @request.auth.role = 'coordenador')",
        fields: [
          {
            name: 'municipality',
            type: 'relation',
            required: true,
            collectionId: munId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'title', type: 'text', required: true },
          {
            name: 'plan_type',
            type: 'select',
            values: [
              'plano_municipal_defesa_civil',
              'plano_comunitario_cenario',
              'plano_setorial_saude_el_nino',
              'plano_setorial_educacao',
              'plano_setorial_obras',
              'plano_setorial_assistencia',
              'plano_setorial_desenvolvimento_urbano',
            ],
            maxSelect: 1,
          },
          { name: 'version_number', type: 'text', required: true }, // "1.0", "1.1-rascunho"
          {
            name: 'status',
            type: 'select',
            values: [
              'rascunho',
              'em_revisao',
              'aguardando_aprovacao',
              'aprovado_vigente',
              'substituido_arquivado',
            ],
            maxSelect: 1,
          },
          { name: 'scope_and_objectives', type: 'editor' },
          { name: 'risk_scenarios', type: 'editor' },
          { name: 'monitoring_and_triggers', type: 'editor' },
          { name: 'responsibilities_and_roles', type: 'editor' },
          { name: 'operational_contacts', type: 'editor' },
          { name: 'affected_communities_and_population', type: 'editor' },
          { name: 'evacuation_routes_and_meeting_points', type: 'editor' },
          { name: 'accessible_transport_and_care', type: 'editor' },
          { name: 'shelters_and_logistics', type: 'editor' },
          { name: 'response_and_recovery_actions', type: 'editor' },
          { name: 'drills_and_lessons_learned', type: 'editor' },
          { name: 'sorocaba_workshop_commitments', type: 'editor' }, // Encaminhamentos da Oficina Multirrisco da Região de Saúde de Sorocaba
          { name: 'information_sources', type: 'text' },
          { name: 'approver_name', type: 'text' },
          { name: 'approver_role', type: 'text' },
          { name: 'approval_document_ref', type: 'text' },
          { name: 'approval_date', type: 'date' },
          { name: 'parent_plan_id', type: 'text' }, // Rastreamento de versão anterior
          { name: 'created_by', type: 'relation', collectionId: usersId, maxSelect: 1 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_plan_mun_type ON contingency_plans (municipality, plan_type)',
          'CREATE INDEX idx_plan_mun_status ON contingency_plans (municipality, status)',
        ],
      })
      app.save(plans)
    }

    // 9. Nova Coleção: 'official_references_library' (Biblioteca de Planos Estaduais e Referências Oficiais)
    if (!app.hasTable('official_references_library')) {
      const refs = new Collection({
        name: 'official_references_library',
        type: 'base',
        listRule:
          "@request.auth.id != '' && (municipality = @request.auth.municipality || municipality = '')",
        viewRule:
          "@request.auth.id != '' && (municipality = @request.auth.municipality || municipality = '')",
        createRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        updateRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        deleteRule:
          "@request.auth.id != '' && municipality = @request.auth.municipality && (@request.auth.role = 'administrador' || @request.auth.role = 'coordenador')",
        fields: [
          {
            name: 'municipality',
            type: 'relation',
            collectionId: munId,
            cascadeDelete: false,
            maxSelect: 1,
          },
          { name: 'title', type: 'text', required: true },
          { name: 'issuing_agency', type: 'text', required: true }, // Defesa Civil do Estado de SP (CEDEC), IPT, DAEE, etc.
          {
            name: 'scope',
            type: 'select',
            values: ['estadual', 'regional_sorocaba', 'federal', 'municipal'],
            maxSelect: 1,
          },
          {
            name: 'category',
            type: 'select',
            values: [
              'plano_estadual',
              'protocolo_operacional',
              'diretriz_tecnica',
              'mapa_referencia',
              'legislacao',
              'outro',
            ],
            maxSelect: 1,
          },
          { name: 'official_source', type: 'text', required: true },
          { name: 'document_date', type: 'date' },
          { name: 'version', type: 'text' },
          { name: 'pertinent_scenarios', type: 'text' }, // Ex: "Inundações / Escorregamentos / El Niño"
          { name: 'document_file', type: 'file', maxSize: 31457280 }, // até 30MB
          { name: 'external_link', type: 'url' },
          {
            name: 'availability_status',
            type: 'select',
            values: ['disponivel', 'pendente_obtencao', 'em_revisao'],
            maxSelect: 1,
          },
          { name: 'summary', type: 'text' },
          { name: 'created_by', type: 'relation', collectionId: usersId, maxSelect: 1 },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_ref_agency ON official_references_library (issuing_agency)',
          'CREATE INDEX idx_ref_scope ON official_references_library (scope)',
        ],
      })
      app.save(refs)
    }

    // 10. Nova Coleção: 'sector_workspaces_config' (Campos e Categorias complementares por secretaria)
    if (!app.hasTable('sector_workspaces_config')) {
      const secConfig = new Collection({
        name: 'sector_workspaces_config',
        type: 'base',
        listRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        viewRule: "@request.auth.id != '' && municipality = @request.auth.municipality",
        createRule:
          "@request.auth.id != '' && municipality = @request.auth.municipality && (@request.auth.role = 'administrador' || @request.auth.role = 'coordenador')",
        updateRule:
          "@request.auth.id != '' && municipality = @request.auth.municipality && (@request.auth.role = 'administrador' || @request.auth.role = 'coordenador')",
        deleteRule:
          "@request.auth.id != '' && municipality = @request.auth.municipality && @request.auth.role = 'administrador'",
        fields: [
          {
            name: 'municipality',
            type: 'relation',
            required: true,
            collectionId: munId,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'department_key', type: 'text', required: true },
          { name: 'department_title', type: 'text', required: true },
          { name: 'lead_person', type: 'text' },
          { name: 'contact_channel', type: 'text' },
          { name: 'custom_categories', type: 'json' },
          { name: 'complementary_fields', type: 'json' },
          { name: 'is_active', type: 'bool' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_sec_cfg_mun_key ON sector_workspaces_config (municipality, department_key)',
        ],
      })
      app.save(secConfig)
    }
  },
  (app) => {
    // Revert idempotent
    const tables = [
      'sector_workspaces_config',
      'official_references_library',
      'contingency_plans',
      'health_operational_needs',
      'social_family_actions',
      'surveyed_families',
      'urban_consultations',
    ]
    for (const t of tables) {
      if (app.hasTable(t)) {
        try {
          const c = app.findCollectionByNameOrId(t)
          app.delete(c)
        } catch (_) {}
      }
    }
  },
)
