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
  affectable_population?: number
  reported_by?: string
  resolved_at?: string
  client_uuid?: string
  prov_code?: string
  sync_status?: 'synced' | 'pending'
  expand?: {
    reported_by?: {
      id: string
      name?: string
      email?: string
    }
    requester?: Requester
    municipality?: Municipality
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
