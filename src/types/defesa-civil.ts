import type { RecordModel } from 'pocketbase'

export type UserRole = 'administrador' | 'coordenador' | 'agente'

export interface Municipality extends RecordModel {
  name: string
  city: string
  state: string
  logo?: string
  doc_header?: string
  doc_footer?: string
  settings?: Record<string, unknown>
  authorized_issuer?: string
  expand?: {
    authorized_issuer?: User
  }
}

export type DocumentStatus = 'rascunho' | 'emitido' | 'cancelado'

export interface DocTemplate extends RecordModel {
  municipality: string
  title: string
  category: 'oficio' | 'notificacao' | 'solicitacao' | 'laudo' | 'outro'
  subject?: string
  content?: string
  is_default?: boolean
  created_by?: string
  expand?: {
    created_by?: User
  }
}

export interface OfficialDocument extends RecordModel {
  municipality: string
  number?: string // OF-2026-00001
  year?: number
  sequential?: number
  status: DocumentStatus
  recipient_name: string
  recipient_role?: string
  recipient_institution?: string
  recipient_address?: string
  subject: string
  content: string
  signatory_user?: string
  signatory_name?: string
  signatory_role?: string
  issue_date?: string
  template?: string
  created_by?: string
  expand?: {
    municipality?: Municipality
    template?: DocTemplate
    signatory_user?: User
    created_by?: User
  }
}

export type TreeAuthType = 'corte' | 'poda' | 'corte_e_poda'
export type TreeAuthStatus = 'rascunho' | 'emitida' | 'cancelada'

export interface TreeAuthorization extends RecordModel {
  municipality: string
  number?: string // AUT-2026-00001
  year?: number
  sequential?: number
  status: TreeAuthStatus
  type: TreeAuthType
  requester: string
  tree_quantity: number
  tree_species?: string
  address: string
  neighborhood?: string
  risk_reason?: string
  technical_report: string
  compensatory_measures?: string
  issue_date?: string
  expiration_date?: string // 90 dias a partir da emissão
  authorized_by?: string
  authorized_by_name?: string
  authorized_by_role?: string
  created_by?: string
  client_uuid?: string
  prov_code?: string
  expand?: {
    municipality?: Municipality
    requester?: Requester
    authorized_by?: User
    created_by?: User
  }
}

export interface DocumentReviewAiResult {
  improved_text: string
  summary_of_changes: string
  tone: string
}

export type OccurrenceType =
  | 'enchente'
  | 'deslizamento'
  | 'seca'
  | 'tempestade'
  | 'granizo'
  | 'incendio_florestal'
  | 'outro'

export type OccurrenceSeverity = 'baixa' | 'media' | 'alta' | 'critica'
export type OccurrenceStatus = 'reportada' | 'em_andamento' | 'concluida' | 'cancelada'
export type OccurrenceOrigin =
  | '199'
  | 'denuncia'
  | 'telefone'
  | 'redes_sociais'
  | 'processo_administrativo'
  | 'outro'

export type LocationOrigin = 'gps' | 'mapa' | 'manual' | 'cep' | 'geocoding' | 'importacao'

export interface Occurrence extends RecordModel {
  code?: string
  title: string
  description?: string
  type: OccurrenceType
  severity: OccurrenceSeverity
  status: OccurrenceStatus
  origin?: OccurrenceOrigin
  municipality?: string
  requester?: string
  latitude?: number
  longitude?: number
  address?: string
  // Detalhamento de endereço e geolocalização auditável
  street?: string
  number?: string
  neighborhood?: string
  city?: string
  state?: string
  postal_code?: string
  complement?: string
  reference_point?: string
  location_origin?: LocationOrigin
  location_accuracy?: number
  address_confirmed?: boolean
  affectable_population?: number
  reported_by?: string
  resolved_at?: string
  client_uuid?: string
  prov_code?: string
  sync_status?: 'synced' | 'pending'
  // Suporte de apoio geográfico (vínculos da Etapa Mapeamentos & Inteligência Territorial)
  risk_sector?: string
  danger_stretch?: string
  strategic_infrastructure?: string
  expand?: {
    reported_by?: {
      id: string
      name?: string
      email?: string
    }
    requester?: Requester
    municipality?: Municipality
    risk_sector?: RiskSector
    danger_stretch?: DangerStretch
    strategic_infrastructure?: StrategicInfrastructure
  }
}

// ---------------------------------------------
// Tipos de Setores de Risco & Trechos de Perigo
// ---------------------------------------------
export type RiskGradeLevel = 'R1' | 'R2' | 'R3' | 'R4' | 'indefinido'
export type ValidationStatus = 'aprovado' | 'pendente_conferencia' | 'rejeitado' | 'incompleto'
export type GeometryStatus = 'ausente' | 'pendente' | 'validada' | 'invalida' | 'vinculada'

export interface RiskSector extends RecordModel {
  municipality: string
  code: string // IBI-01/A03/S11/ESC/R3
  sector_number?: string // Setor 11
  zone?: string
  area_number?: string
  area_name?: string
  plate_number?: string // PRANCHA 053
  location?: string
  process_type?: string
  danger_grade?: string
  vulnerability_grade?: string
  risk_grade?: string
  risk_level?: RiskGradeLevel
  affected_buildings?: number
  affected_dwellings?: number
  affected_residents?: number
  affected_roads_length?: number
  disaster_history?: string
  regional_risk_info?: string
  expected_processes?: string
  description?: string
  recommendations?: string
  validation_status: ValidationStatus
  geometry_status: GeometryStatus
  geometry_geojson?: string // Polygon / MultiPolygon em WGS84
  import_source?: string
  import_batch_id?: string
  raw_attributes?: Record<string, any>
  notes?: string
}

export interface DangerStretch extends RecordModel {
  municipality: string
  code: string
  stretch_number?: string
  zone?: string
  area_number?: string
  area_name?: string
  location?: string
  process_type?: string
  danger_grade?: string
  vulnerability_grade?: string
  risk_grade?: string
  risk_level?: RiskGradeLevel
  affected_roads_length?: number
  affected_dwellings?: number
  affected_residents?: number
  disaster_history?: string
  description?: string
  recommendations?: string
  validation_status: ValidationStatus
  geometry_status: GeometryStatus
  geometry_geojson?: string // LineString / MultiLineString em WGS84
  import_source?: string
  import_batch_id?: string
  raw_attributes?: Record<string, any>
  notes?: string
}

// ---------------------------------------------
// Infraestruturas Estratégicas (Pontes, Aduelas, etc.)
// ---------------------------------------------
export type InfrastructureType =
  | 'ponte'
  | 'aduela'
  | 'bueiro'
  | 'passarela'
  | 'outro'
  | 'pendente_classificacao'

export type CoordinateStatus = 'valida' | 'duvidosa' | 'ilegivel' | 'ausente'
export type StructuralCondition = 'bom' | 'regular' | 'ruim' | 'critico' | 'nao_avaliado'
export type AdministrativePriority = 'baixa' | 'media' | 'alta' | 'urgente'
export type InspectionStatus = 'em_dia' | 'necessita_vistoria' | 'em_reforma' | 'interditada'

export interface StrategicInfrastructure extends RecordModel {
  municipality: string
  original_code: string // P1, P2 ... P224, P Gabri
  type: InfrastructureType
  name?: string
  neighborhood?: string
  reference_point?: string
  channel_width?: string
  dimensions?: string
  observed_problems?: string
  notes?: string
  lat_dms?: string
  lon_dms?: string
  latitude?: number
  longitude?: number
  coordinate_status: CoordinateStatus
  validation_status: 'pendente_conferencia' | 'conferido' | 'divergente' | 'rejeitado'
  source_document?: string
  source_page?: number
  is_handwritten_transcription?: boolean
  structural_condition?: StructuralCondition
  administrative_priority?: AdministrativePriority
  inspection_status?: InspectionStatus
  last_inspection_date?: string
  verified_by?: string
  verified_at?: string
  verification_notes?: string
  expand?: {
    verified_by?: User
    municipality?: Municipality
  }
}

export interface BridgeInspection extends RecordModel {
  municipality: string
  infrastructure: string
  inspector?: string
  inspection_date: string
  structural_condition: 'bom' | 'regular' | 'ruim' | 'critico'
  problems_found?: string
  technical_recommendations?: string
  traffic_condition?: 'livre' | 'restricao_peso' | 'meia_pista' | 'interditada'
  photo?: string[]
  expand?: {
    inspector?: User
    infrastructure?: StrategicInfrastructure
  }
}

// ---------------------------------------------
// AGENTES, UNIFORMES E CONTROLE DE EPI (Documento Mestre Requisitos)
// ---------------------------------------------

export type AgentStatus = 'ativo' | 'afastado' | 'ferias' | 'desligado'
export type EmploymentType = 'concursado' | 'comissionado' | 'temporario' | 'voluntario' | 'outro'

export interface AgentProfile extends RecordModel {
  municipality: string
  user: string
  registration_number?: string
  full_name: string
  cpf?: string
  rg?: string
  blood_type?: string
  emergency_contact?: string
  emergency_phone?: string
  admission_date?: string
  employment_type?: EmploymentType
  operational_role?: string
  status: AgentStatus
  // Medidas de Uniforme e Vestuário
  tshirt_size?: string
  shirt_size?: string
  pants_size?: string
  jacket_size?: string
  boot_size?: string
  additional_measurements?: string
  notes?: string
  expand?: {
    user?: User
    municipality?: Municipality
  }
}

export type EpiCategory =
  | 'epi_cabeca'
  | 'epi_respiratorio'
  | 'epi_maos'
  | 'epi_pes'
  | 'uniforme'
  | 'altura_resgate'
  | 'aquatico'
  | 'outro'

export interface EpiItem extends RecordModel {
  municipality: string
  name: string
  category: EpiCategory
  ca_number?: string
  specification?: string
  size?: string
  stock_quantity: number
  min_stock_alert?: number
  unit?: string
  required_for_roles?: string
  is_active: boolean
}

export type EpiDeliveryAction =
  | 'entrega_inicial'
  | 'substituicao_desgaste'
  | 'substituicao_dano'
  | 'devolucao_baixa'
  | 'emprestimo_temporario'

export interface EpiDelivery extends RecordModel {
  municipality: string
  agent: string
  item: string
  action_type: EpiDeliveryAction
  quantity: number
  delivery_date: string
  item_size?: string
  item_specification?: string
  reason?: string
  receipt_signed: boolean
  receipt_signature_date?: string
  receipt_document_number?: string
  delivered_by?: string
  delivered_by_name?: string
  notes?: string
  expand?: {
    agent?: User
    item?: EpiItem
    delivered_by?: User
  }
}

// ---------------------------------------------
// Demandas para Outras Secretarias
// ---------------------------------------------
export type TargetDepartment =
  | 'obras'
  | 'servicos_municipais'
  | 'meio_ambiente'
  | 'assistencia_social'
  | 'saude'
  | 'planejamento'
  | 'transito'
  | 'outra'

export type DemandStatus =
  | 'identificada'
  | 'encaminhada'
  | 'em_analise'
  | 'em_atendimento'
  | 'concluida'
  | 'arquivada'

export interface ExternalDemand extends RecordModel {
  municipality: string
  title: string
  problem_description: string
  location: string
  latitude?: number
  longitude?: number
  target_department: TargetDepartment
  priority: 'baixa' | 'media' | 'alta' | 'urgente'
  status: DemandStatus
  forwarded_at?: string
  forwarded_protocol?: string
  department_response?: string
  response_date?: string
  action_history?: string
  related_occurrence?: string
  related_infrastructure?: string
  created_by?: string
  photos?: string[]
  expand?: {
    related_occurrence?: Occurrence
    related_infrastructure?: StrategicInfrastructure
    created_by?: User
  }
}

// ---------------------------------------------
// Lotes de Importação & Auditoria de Qualidade
// ---------------------------------------------
export interface GeoImportBatch extends RecordModel {
  municipality: string
  filename: string
  file_type: string
  imported_by?: string
  total_records: number
  valid_records: number
  duplicate_records: number
  incomplete_records: number
  rejected_records: number
  summary?: string
  rejection_reasons?: { line: number; code?: string; reason: string }[]
  expand?: {
    imported_by?: User
  }
}

export interface SyncQueueItem {
  id: string // internal queue id (UUID)
  client_uuid: string // deduplication key
  municipality: string
  userId: string
  entityType:
    | 'requester'
    | 'occurrence'
    | 'occurrence_file'
    | 'tree_authorization'
    | 'official_document'
  action: 'create' | 'update' | 'delete'
  prov_code?: string
  payload: Record<string, any>
  fileBlob?: Blob
  fileName?: string
  fileFieldName?: string
  dependsOnClientUuid?: string // ex: attachment depends on occurrence client_uuid
  status: 'pending' | 'processing' | 'failed' | 'synced'
  retryCount: number
  lastError?: string
  createdAt: string
  updatedAt: string
}

export type NetworkSyncStatus = 'online_synced' | 'offline_pending' | 'syncing' | 'sync_error'

export interface Requester extends RecordModel {
  municipality: string
  name: string
  type: 'pf' | 'pj'
  document: string // CPF ou CNPJ
  rg?: string
  phone?: string
  email?: string
  address?: string
  notes?: string
}

export interface OccurrenceFile extends RecordModel {
  municipality: string
  occurrence: string
  file: string
  file_type: 'foto' | 'documento' | 'outro'
  caption?: string
  uploaded_by?: string
  client_uuid?: string
  expand?: {
    uploaded_by?: {
      id: string
      name?: string
    }
  }
}

export interface AuditLogEntry extends RecordModel {
  municipality: string
  user?: string
  user_name?: string
  user_email?: string
  action: string
  collection: string
  record_id: string
  details?: string
  data_before?: string
  data_after?: string
  origin?: 'online' | 'offline'
}

export type ShelterStatus = 'ativo' | 'cheio' | 'inativo'

export interface Shelter extends RecordModel {
  name: string
  address?: string
  latitude?: number
  longitude?: number
  capacity: number
  occupancy?: number
  status: ShelterStatus
  contact?: string
  municipality?: string
}

export type TeamType =
  | 'resgate'
  | 'saude'
  | 'logistica'
  | 'comunicacao'
  | 'voluntarios'
  | 'engenharia'
export type TeamStatus = 'disponivel' | 'em_operacao' | 'descanso'

export interface Team extends RecordModel {
  name: string
  type: TeamType
  leader_name?: string
  member_count?: number
  status: TeamStatus
  current_occurrence?: string
  latitude?: number
  longitude?: number
  municipality?: string
  expand?: {
    current_occurrence?: Occurrence
  }
}

export type SupplyCategory =
  | 'agua'
  | 'alimentos'
  | 'medicamentos'
  | 'roupas_cobertores'
  | 'equipamentos'
  | 'higiene'
  | 'outros'

export type SupplyUnit = 'unidades' | 'litros' | 'quilos' | 'caixas' | 'kits'
export type SupplyStatus = 'disponivel' | 'critico' | 'esgotado'

export interface Supply extends RecordModel {
  name: string
  category: SupplyCategory
  quantity: number
  unit: SupplyUnit
  status: SupplyStatus
  location?: string
  min_threshold?: number
  municipality?: string
}

export type AlertType =
  | 'enchente'
  | 'deslizamento'
  | 'seca'
  | 'tempestade'
  | 'granizo'
  | 'incendio_florestal'
  | 'outro'

export type AlertSeverity = 'informativo' | 'alerta' | 'perigo' | 'perigo_extremo'
export type AlertChannel = 'sms' | 'whatsapp' | 'sirene' | 'redes_sociais' | 'todos'
export type AlertStatus = 'rascunho' | 'enviado' | 'agendado'

export interface Alert extends RecordModel {
  title: string
  type: AlertType
  severity: AlertSeverity
  message: string
  target_area?: string
  channel: AlertChannel
  status: AlertStatus
  scheduled_at?: string
  sent_by?: string
  related_occurrence?: string
  municipality?: string
  expand?: {
    sent_by?: {
      id: string
      name?: string
      email?: string
    }
    related_occurrence?: Occurrence
  }
}

export type AreaHazardType = 'enchente' | 'deslizamento' | 'seca' | 'tempestade' | 'outro'
export type AreaRiskLevel = 'baixo' | 'medio' | 'alto' | 'critico'
export type AreaStatus = 'monitorado' | 'evacuado' | 'interditado' | 'liberado'

export interface AffectedArea extends RecordModel {
  name: string
  hazard_type: AreaHazardType
  risk_level: AreaRiskLevel
  status: AreaStatus
  area_polygon?: string // JSON array [[lat, lng], ...]
  coordinates?: string // "lat,lng" centroid
  affected_population?: number
  notes?: string
  municipality?: string
}

export interface User {
  id: string
  email: string
  name?: string
  avatar?: string
  role?: UserRole
  municipality?: string
  expand?: {
    municipality?: Municipality
  }
}

export type WhatsAppDirection = 'incoming' | 'outgoing'
export type WhatsAppStatus = 'received' | 'sent' | 'failed' | 'draft'

export interface WhatsAppMessage extends RecordModel {
  direction: WhatsAppDirection
  from_number: string
  to_number: string
  body: string
  status: WhatsAppStatus
  occurrence?: string
  twilio_sid?: string
  error?: string
  municipality?: string
  expand?: {
    occurrence?: Occurrence
  }
}

export interface AppSetting extends RecordModel {
  key: string
  value: string
  description?: string
}

export interface WhatsAppConfigInfo {
  configured: boolean
  account_sid_configured: boolean
  auth_token_configured: boolean
  account_sid_masked: string
  whatsapp_number: string
  webhook_url: string
}

export type AttachmentCategory =
  | 'vistoria'
  | 'situacao_inicial'
  | 'antes_intervencao'
  | 'durante_obra'
  | 'depois_conclusao'
  | 'outros'

export type AttachmentMediaType = 'foto' | 'video' | 'documento' | 'outro'

export interface RecordAttachment extends RecordModel {
  municipality: string
  target_collection: string
  target_id: string
  file: string
  title?: string
  description?: string
  capture_date?: string
  author_name?: string
  category: AttachmentCategory
  media_type: AttachmentMediaType
  file_size?: number
  uploaded_by?: string
  expand?: {
    uploaded_by?: User
    municipality?: Municipality
  }
}

export type GeoAdjustVersionType = 'ajuste_municipal' | 'pendente_validacao' | 'restaurado_original'

export interface MunicipalGeoAdjustment extends RecordModel {
  municipality: string
  target_collection: string
  target_id: string
  code?: string
  version_type: GeoAdjustVersionType
  original_geometry_geojson?: string
  adjusted_geometry_geojson?: string
  original_risk_level?: string
  adjusted_risk_level?: string
  justification: string
  author?: string
  author_name?: string
  expand?: {
    author?: User
  }
}
