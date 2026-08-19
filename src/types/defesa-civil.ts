import type { RecordModel } from 'pocketbase'

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

export interface Occurrence extends RecordModel {
  title: string
  description?: string
  type: OccurrenceType
  severity: OccurrenceSeverity
  status: OccurrenceStatus
  latitude?: number
  longitude?: number
  address?: string
  affectable_population?: number
  reported_by?: string
  resolved_at?: string
  expand?: {
    reported_by?: {
      id: string
      name?: string
      email?: string
    }
  }
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
}

export interface User {
  id: string
  email: string
  name?: string
  avatar?: string
}
