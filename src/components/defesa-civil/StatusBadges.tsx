import React from 'react'
import {
  AlertTriangle,
  Flame,
  CloudRain,
  Sun,
  Wind,
  CloudLightning,
  Layers,
  CheckCircle2,
  Clock,
  Radio,
  Users,
  Building2,
  Package,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type {
  OccurrenceSeverity,
  OccurrenceStatus,
  OccurrenceType,
  ShelterStatus,
  SupplyStatus,
  TeamStatus,
  AlertSeverity,
  AreaRiskLevel,
  AreaStatus,
} from '@/types/defesa-civil'

// Brazilian Portuguese Labels
export const TYPE_LABELS: Record<OccurrenceType, string> = {
  enchente: 'Enchente / Alagamento',
  deslizamento: 'Deslizamento de Terra',
  seca: 'Seca / Estiagem',
  tempestade: 'Tempestade / Vendaval',
  granizo: 'Queda de Granizo',
  incendio_florestal: 'Incêndio Florestal',
  outro: 'Outro Evento',
}

export const SEVERITY_LABELS: Record<OccurrenceSeverity, string> = {
  baixa: 'Baixa',
  media: 'Média',
  alta: 'Alta',
  critica: 'Crítica',
}

export const STATUS_LABELS: Record<OccurrenceStatus, string> = {
  reportada: 'Reportada',
  em_andamento: 'Em Andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

export const ORIGIN_LABELS: Record<string, string> = {
  '199': 'Disque 199 (Emergência)',
  denuncia: 'Denúncia Presencial / Anônima',
  telefone: 'Telefone Institucional',
  redes_sociais: 'Redes Sociais / Monitoramento',
  processo_administrativo: 'Processo Administrativo',
  outro: 'Outro Canal',
}

export const LOCATION_ORIGIN_LABELS: Record<string, string> = {
  gps: 'GPS do Dispositivo',
  mapa: 'Seleção Manual no Mapa',
  manual: 'Endereço Digitado Manualmente',
  cep: 'Consulta por CEP (ViaCEP)',
  geocoding: 'Geocodificação Direta',
  importacao: 'Importação / Migração',
}
export const ALERT_SEVERITY_LABELS: Record<AlertSeverity, string> = {
  informativo: 'Informativo',
  alerta: 'Alerta',
  perigo: 'Perigo',
  perigo_extremo: 'Perigo Extremo',
}

export const RISK_LEVEL_LABELS: Record<AreaRiskLevel, string> = {
  baixo: 'Baixo Risco',
  medio: 'Médio Risco',
  alto: 'Alto Risco',
  critico: 'Risco Crítico',
}

export const AREA_STATUS_LABELS: Record<AreaStatus, string> = {
  monitorado: 'Monitorado',
  evacuado: 'Evacuado',
  interditado: 'Interditado',
  liberado: 'Liberado',
}

export const SHELTER_STATUS_LABELS: Record<ShelterStatus, string> = {
  ativo: 'Ativo',
  cheio: 'Lotado (Cheio)',
  inativo: 'Inativo',
}

export const TEAM_STATUS_LABELS: Record<TeamStatus, string> = {
  disponivel: 'Disponível',
  em_operacao: 'Em Operação',
  descanso: 'Descanso',
}

export const SUPPLY_STATUS_LABELS: Record<SupplyStatus, string> = {
  disponivel: 'Disponível',
  critico: 'Estoque Crítico',
  esgotado: 'Esgotado',
}

// Icon getter for hazard types
export function getHazardIcon(type: string, className = 'w-4 h-4') {
  switch (type) {
    case 'enchente':
      return <CloudRain className={`${className} text-blue-500`} />
    case 'deslizamento':
      return <Layers className={`${className} text-amber-600`} />
    case 'seca':
      return <Sun className={`${className} text-yellow-500`} />
    case 'tempestade':
      return <Wind className={`${className} text-sky-500`} />
    case 'granizo':
      return <CloudLightning className={`${className} text-indigo-400`} />
    case 'incendio_florestal':
      return <Flame className={`${className} text-orange-500`} />
    default:
      return <AlertTriangle className={`${className} text-slate-500`} />
  }
}

// Badge helper components
export const SeverityBadge: React.FC<{
  severity: OccurrenceSeverity | AlertSeverity | AreaRiskLevel
}> = ({ severity }) => {
  switch (severity) {
    case 'critica':
    case 'perigo_extremo':
    case 'critico':
      return (
        <Badge className="bg-red-600 hover:bg-red-700 text-white font-medium shadow-sm transition-colors">
          {severity === 'critica' || severity === 'critico' ? 'Crítica' : 'Perigo Extremo'}
        </Badge>
      )
    case 'alta':
    case 'perigo':
    case 'alto':
      return (
        <Badge className="bg-orange-500 hover:bg-orange-600 text-white font-medium shadow-sm transition-colors">
          {severity === 'alta' || severity === 'alto' ? 'Alta' : 'Perigo'}
        </Badge>
      )
    case 'media':
    case 'alerta':
    case 'medio':
      return (
        <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-medium shadow-sm transition-colors">
          {severity === 'media' || severity === 'medio' ? 'Média' : 'Alerta'}
        </Badge>
      )
    case 'baixa':
    case 'informativo':
    case 'baixo':
    default:
      return (
        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium shadow-sm transition-colors">
          {severity === 'baixa' || severity === 'baixo' ? 'Baixa' : 'Informativo'}
        </Badge>
      )
  }
}

export const StatusBadge: React.FC<{ status: OccurrenceStatus }> = ({ status }) => {
  switch (status) {
    case 'reportada':
      return (
        <Badge variant="outline" className="border-amber-400 bg-amber-50 text-amber-700">
          <Clock className="w-3 h-3 mr-1" /> Reportada
        </Badge>
      )
    case 'em_andamento':
      return (
        <Badge variant="outline" className="border-blue-400 bg-blue-50 text-blue-700 animate-pulse">
          <Radio className="w-3 h-3 mr-1" /> Em Andamento
        </Badge>
      )
    case 'concluida':
      return (
        <Badge variant="outline" className="border-emerald-400 bg-emerald-50 text-emerald-700">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Concluída
        </Badge>
      )
    case 'cancelada':
      return (
        <Badge variant="outline" className="border-slate-300 bg-slate-100 text-slate-600">
          Cancelada
        </Badge>
      )
  }
}

export const AreaStatusBadge: React.FC<{ status: AreaStatus }> = ({ status }) => {
  switch (status) {
    case 'monitorado':
      return <Badge className="bg-blue-600 text-white">Monitorado</Badge>
    case 'evacuado':
      return <Badge className="bg-orange-600 text-white">Evacuado</Badge>
    case 'interditado':
      return <Badge className="bg-red-700 text-white">Interditado</Badge>
    case 'liberado':
      return <Badge className="bg-emerald-600 text-white">Liberado</Badge>
  }
}

export const SupplyStatusBadge: React.FC<{ status: SupplyStatus }> = ({ status }) => {
  switch (status) {
    case 'disponivel':
      return <Badge className="bg-emerald-600 text-white font-medium">Disponível</Badge>
    case 'critico':
      return (
        <Badge className="bg-amber-500 text-white font-semibold animate-pulse">Estoque Baixo</Badge>
      )
    case 'esgotado':
      return <Badge className="bg-red-700 text-white font-bold animate-pulse">Esgotado</Badge>
  }
}

export const TeamStatusBadge: React.FC<{ status: TeamStatus }> = ({ status }) => {
  switch (status) {
    case 'disponivel':
      return <Badge className="bg-emerald-600 text-white">Disponível</Badge>
    case 'em_operacao':
      return <Badge className="bg-purple-600 text-white animate-pulse">Em Operação</Badge>
    case 'descanso':
      return <Badge className="bg-slate-500 text-white">Em Descanso</Badge>
  }
}

export const ShelterStatusBadge: React.FC<{ status: ShelterStatus }> = ({ status }) => {
  switch (status) {
    case 'ativo':
      return <Badge className="bg-emerald-600 text-white">Ativo</Badge>
    case 'cheio':
      return <Badge className="bg-red-600 text-white font-bold">Lotado (Cheio)</Badge>
    case 'inativo':
      return <Badge className="bg-slate-400 text-white">Inativo</Badge>
  }
}

export const DocumentStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  switch (status) {
    case 'emitido':
    case 'emitida':
      return (
        <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
          <CheckCircle2 className="w-3 h-3 mr-1" /> Emitido Oficial
        </Badge>
      )
    case 'cancelado':
    case 'cancelada':
      return (
        <Badge variant="outline" className="border-red-300 bg-red-50 text-red-700">
          Cancelado
        </Badge>
      )
    case 'rascunho':
    default:
      return (
        <Badge
          variant="outline"
          className="border-amber-400 bg-amber-50 text-amber-700 font-medium"
        >
          <Clock className="w-3 h-3 mr-1" /> Rascunho
        </Badge>
      )
  }
}
