import React, { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  AlertTriangle,
  Users,
  Building2,
  Package,
  Bell,
  ArrowUpRight,
  TrendingUp,
  Plus,
  Bot,
  Layers,
  ChevronRight,
  RefreshCw,
  Clock,
  MapPin,
  Flame,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { InteractiveMap } from '@/components/defesa-civil/InteractiveMap'
import { SeverityBadge, StatusBadge, getHazardIcon } from '@/components/defesa-civil/StatusBadges'
import {
  occurrencesService,
  sheltersService,
  teamsService,
  suppliesService,
  alertsService,
  affectedAreasService,
} from '@/services/defesa-civil'
import type { Occurrence, Shelter, Team, Supply, Alert, AffectedArea } from '@/types/defesa-civil'
import { useRealtime } from '@/hooks/use-realtime'

// Count-up animated number component
const AnimatedCount: React.FC<{ value: number; duration?: number; suffix?: string }> = ({
  value,
  duration = 500,
  suffix = '',
}) => {
  const [displayValue, setDisplayValue] = useState(0)
  const prevValueRef = React.useRef(0)

  useEffect(() => {
    const startValue = prevValueRef.current
    const diff = value - startValue
    if (diff === 0) {
      setDisplayValue(value)
      return
    }

    const startTime = performance.now()
    let animationFrameId: number

    const updateNumber = (now: number) => {
      const elapsed = now - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3)
      const current = Math.round(startValue + diff * easeOut)
      setDisplayValue(current)

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(updateNumber)
      } else {
        prevValueRef.current = value
      }
    }

    animationFrameId = requestAnimationFrame(updateNumber)
    return () => cancelAnimationFrame(animationFrameId)
  }, [value, duration])

  return (
    <span>
      {displayValue.toLocaleString('pt-BR')}
      {suffix}
    </span>
  )
}

export const Dashboard: React.FC = () => {
  const navigate = useNavigate()

  // State collections
  const [occurrences, setOccurrences] = useState<Occurrence[]>([])
  const [shelters, setShelters] = useState<Shelter[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [supplies, setSupplies] = useState<Supply[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [areas, setAreas] = useState<AffectedArea[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Realtime pulses
  const [pulseOccurrences, setPulseOccurrences] = useState(false)
  const [pulseSupplies, setPulseSupplies] = useState(false)

  const loadAllData = async () => {
    try {
      const [occData, shelterData, teamData, supplyData, alertData, areaData] = await Promise.all([
        occurrencesService.list(),
        sheltersService.list(),
        teamsService.list(),
        suppliesService.list(),
        alertsService.list(),
        affectedAreasService.list(),
      ])
      setOccurrences(occData)
      setShelters(shelterData)
      setTeams(teamData)
      setSupplies(supplyData)
      setAlerts(alertData)
      setAreas(areaData)
    } catch (err) {
      console.error('Falha ao carregar dashboard:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadAllData()
  }, [])

  // Real-time listeners
  useRealtime<Occurrence>('occurrences', () => {
    loadAllData()
    setPulseOccurrences(true)
    setTimeout(() => setPulseOccurrences(false), 2000)
  })
  useRealtime<Shelter>('shelters', () => loadAllData())
  useRealtime<Team>('teams', () => loadAllData())
  useRealtime<Supply>('supplies', () => {
    loadAllData()
    setPulseSupplies(true)
    setTimeout(() => setPulseSupplies(false), 2000)
  })
  useRealtime<Alert>('alerts', () => loadAllData())
  useRealtime<AffectedArea>('affected_areas', () => loadAllData())

  // Computed KPIs
  const activeOccurrences = occurrences.filter(
    (o) => o.status !== 'concluida' && o.status !== 'cancelada',
  )
  const criticalOccurrences = activeOccurrences.filter((o) => o.severity === 'critica')

  // Total affected population in non-liberated areas
  const totalPopulationAtRisk = areas
    .filter((a) => a.status !== 'liberado')
    .reduce((sum, a) => sum + (a.affected_population || 0), 0)

  // Shelters capacity ratio
  const totalShelterCapacity = shelters.reduce((acc, s) => acc + (s.capacity || 0), 0)
  const totalShelterOccupancy = shelters.reduce((acc, s) => acc + (s.occupancy || 0), 0)
  const shelterOccupancyRate =
    totalShelterCapacity > 0 ? Math.round((totalShelterOccupancy / totalShelterCapacity) * 100) : 0

  // Critical / Out-of-stock supplies
  const criticalSuppliesCount = supplies.filter(
    (s) => s.status === 'critico' || s.status === 'esgotado',
  ).length

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Top Banner with Alert Headline */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-gradient-to-r from-[#0f2557] to-[#1e3a8a] text-white shadow-md">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <span className="text-xs font-bold text-red-300 uppercase tracking-wider">
              Nível de Prontidão Laranja / Alerta Ativo
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-white">
            Painel Geral de Resposta a Desastres — El Niño
          </h2>
          <p className="text-xs text-blue-100/80">
            Monitoramento telemétrico integrado de bacias hidrográficas, encostas e unidades de
            acolhimento.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={loadAllData}
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs h-9"
          >
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            Atualizar
          </Button>
          <Button
            size="sm"
            onClick={() => navigate('/ocorrencias?new=true')}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold text-xs h-9 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Nova Ocorrência
          </Button>
        </div>
      </div>

      {/* Row of 4 Rich KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Ocorrências Ativas */}
        <Card
          onClick={() => navigate('/ocorrencias')}
          className={`cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md border-red-100 bg-white ${
            pulseOccurrences ? 'ring-2 ring-red-500 ring-offset-2 animate-pulse' : ''
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Ocorrências Ativas
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
                <AnimatedCount value={activeOccurrences.length} />
              </div>{' '}
              {criticalOccurrences.length > 0 && (
                <Badge className="bg-red-600 text-white text-[10px] font-bold">
                  {criticalOccurrences.length} Críticas
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3 text-red-500" />
              <span>{occurrences.length} totais registradas</span>
            </p>
          </CardContent>
        </Card>

        {/* KPI 2: População em Risco */}
        <Card
          onClick={() => navigate('/areas-afetadas')}
          className="cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md border-amber-100 bg-white"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              População em Risco
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
              <AnimatedCount value={totalPopulationAtRisk} />
            </div>
            <p className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
              <span>
                {areas.filter((a) => a.status !== 'liberado').length} polígonos sob monitoramento
              </span>
            </p>
          </CardContent>
        </Card>

        {/* KPI 3: Ocupação dos Abrigos */}
        <Card
          onClick={() => navigate('/abrigos')}
          className="cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md border-blue-100 bg-white"
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Ocupação Abrigos
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
                <AnimatedCount value={shelterOccupancyRate} suffix="%" />
              </div>
              <span className="text-xs text-slate-500 font-medium">
                {totalShelterOccupancy}/{totalShelterCapacity} vagas
              </span>
            </div>
            <Progress
              value={shelterOccupancyRate}
              className={`h-2 mt-2 ${
                shelterOccupancyRate >= 90
                  ? '[&>div]:bg-red-600'
                  : shelterOccupancyRate >= 70
                    ? '[&>div]:bg-amber-500'
                    : '[&>div]:bg-blue-600'
              }`}
            />
          </CardContent>
        </Card>

        {/* KPI 4: Suprimentos Críticos */}
        <Card
          onClick={() => navigate('/suprimentos')}
          className={`cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md border-amber-100 bg-white ${
            pulseSupplies ? 'ring-2 ring-amber-500 ring-offset-2 animate-pulse' : ''
          }`}
        >
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
              Suprimentos Críticos
            </CardTitle>
            <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline justify-between">
              <div className="text-3xl font-extrabold text-slate-900 tracking-tight">
                <AnimatedCount value={criticalSuppliesCount} />
              </div>{' '}
              {criticalSuppliesCount > 0 && (
                <Badge className="bg-amber-500 text-white text-[10px] font-bold">
                  Reposição Urgente
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {supplies.length} itens catalogados no depósito
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Interactive Map (Large & Primary) */}
      <Card className="overflow-hidden border-slate-200 shadow-sm bg-white">
        <CardHeader className="py-3 px-4 bg-slate-50/80 border-b border-slate-200 flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-600" />
            <CardTitle className="text-sm font-bold text-slate-800">
              Mapa Operacional do Município — Camadas El Niño
            </CardTitle>
          </div>
          <span className="text-xs text-slate-500 hidden sm:inline">
            Clique nos marcadores ou polígonos para visualizar o resumo
          </span>
        </CardHeader>
        <CardContent className="p-0">
          <InteractiveMap
            height="400px"
            occurrences={occurrences}
            shelters={shelters}
            teams={teams}
            areas={areas}
            onSelectItem={(type, item) => {
              if (type === 'occurrence') navigate(`/ocorrencias?id=${item.id}`)
              if (type === 'shelter') navigate('/abrigos')
              if (type === 'team') navigate('/equipes')
              if (type === 'area') navigate('/areas-afetadas')
            }}
          />
        </CardContent>
      </Card>

      {/* Two-column Bottom Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Ocorrências Recentes */}
        <Card className="border-slate-200 shadow-sm bg-white flex flex-col">
          <CardHeader className="py-3.5 px-5 border-b border-slate-200 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <CardTitle className="text-sm font-bold text-slate-800">
                Ocorrências Recentes
              </CardTitle>
            </div>
            <Link
              to="/ocorrencias"
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
            >
              Ver todas ({occurrences.length})
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="p-0 divide-y divide-slate-100 flex-1">
            {occurrences.slice(0, 5).map((occ) => (
              <div
                key={occ.id}
                onClick={() => navigate(`/ocorrencias?id=${occ.id}`)}
                className="p-4 hover:bg-slate-50/80 transition-colors cursor-pointer flex items-center justify-between gap-3 group"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    {getHazardIcon(occ.type, 'w-5 h-5')}
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xs font-bold text-slate-900 truncate group-hover:text-blue-600 transition-colors">
                      {occ.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 truncate flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3 h-3 text-slate-400" />
                      <span>{occ.address || 'Localidade não especificada'}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <SeverityBadge severity={occ.severity} />
                  <StatusBadge status={occ.status} />
                </div>
              </div>
            ))}

            {occurrences.length === 0 && (
              <div className="p-8 text-center text-xs text-slate-500">
                Nenhuma ocorrência registrada no momento.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Alertas Recentes & Ações Rápidas */}
        <div className="space-y-6">
          {/* Alertas Recentes */}
          <Card className="border-slate-200 shadow-sm bg-white">
            <CardHeader className="py-3.5 px-5 border-b border-slate-200 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-600" />
                <CardTitle className="text-sm font-bold text-slate-800">
                  Comunicações e Alertas Recentes
                </CardTitle>
              </div>
              <Link
                to="/alertas"
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                Ver histórico
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </CardHeader>
            <CardContent className="p-0 divide-y divide-slate-100">
              {alerts.slice(0, 3).map((alert) => (
                <div
                  key={alert.id}
                  onClick={() => navigate('/alertas')}
                  className="p-3.5 hover:bg-slate-50/80 transition-colors cursor-pointer space-y-1"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h5 className="text-xs font-bold text-slate-900 truncate">{alert.title}</h5>
                    <Badge
                      variant={alert.status === 'enviado' ? 'default' : 'outline'}
                      className="text-[10px] capitalize"
                    >
                      {alert.status}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-600 line-clamp-2">{alert.message}</p>
                </div>
              ))}

              {alerts.length === 0 && (
                <div className="p-6 text-center text-xs text-slate-500">
                  Nenhum alerta emitido recentemente.
                </div>
              )}
            </CardContent>
          </Card>

          {/* Ações Rápidas Card */}
          <Card className="border-blue-200 bg-gradient-to-br from-blue-50/50 to-indigo-50/50 shadow-sm">
            <CardHeader className="py-3 px-5 border-b border-blue-100">
              <CardTitle className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                Ações Operacionais Rápidas
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Button
                onClick={() => navigate('/ocorrencias?new=true')}
                variant="outline"
                className="bg-white hover:bg-red-50 hover:text-red-700 hover:border-red-300 border-slate-200 text-xs font-semibold h-11 justify-start gap-2 shadow-xs transition-all"
              >
                <div className="w-6 h-6 rounded bg-red-100 text-red-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-3.5 h-3.5" />
                </div>
                Registrar Ocorrência
              </Button>

              <Button
                onClick={() => navigate('/alertas?new=true')}
                variant="outline"
                className="bg-white hover:bg-amber-50 hover:text-amber-700 hover:border-amber-300 border-slate-200 text-xs font-semibold h-11 justify-start gap-2 shadow-xs transition-all"
              >
                <div className="w-6 h-6 rounded bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <Bell className="w-3.5 h-3.5" />
                </div>
                Novo Alerta com IA
              </Button>

              <Button
                onClick={() => navigate('/assistente')}
                variant="outline"
                className="bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 border-slate-200 text-xs font-semibold h-11 justify-start gap-2 shadow-xs transition-all"
              >
                <div className="w-6 h-6 rounded bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <Bot className="w-3.5 h-3.5" />
                </div>
                Consultar Assistente
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
