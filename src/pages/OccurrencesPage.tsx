import React, { useEffect, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import {
  Plus,
  Search,
  Filter,
  AlertTriangle,
  MapPin,
  Users,
  CheckCircle2,
  Radio,
  Clock,
  Calendar,
  Layers,
  Edit2,
  Trash2,
  Bell,
  UserCheck,
  ChevronRight,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { InteractiveMap } from '@/components/defesa-civil/InteractiveMap'
import {
  SeverityBadge,
  StatusBadge,
  getHazardIcon,
  TYPE_LABELS,
  SEVERITY_LABELS,
  STATUS_LABELS,
} from '@/components/defesa-civil/StatusBadges'
import {
  occurrencesService,
  teamsService,
  alertsService,
  getErrorMessage,
} from '@/services/defesa-civil'
import type {
  Occurrence,
  OccurrenceType,
  OccurrenceSeverity,
  OccurrenceStatus,
  Team,
  Alert,
} from '@/types/defesa-civil'
import { useRealtime } from '@/hooks/use-realtime'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'

export const OccurrencesPage: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [occurrences, setOccurrences] = useState<Occurrence[]>([])
  const [teams, setTeams] = useState<Team[]>([])
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Filters
  const [searchText, setSearchText] = useState(searchParams.get('search') || '')
  const [selectedType, setSelectedType] = useState<string>('all')
  const [selectedSeverity, setSelectedSeverity] = useState<string>('all')
  const [selectedStatus, setSelectedStatus] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

  // Modals & Selected details
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [selectedOccurrence, setSelectedOccurrence] = useState<Occurrence | null>(null)

  // Form State
  const [formData, setFormData] = useState<Partial<Occurrence>>({
    title: '',
    description: '',
    type: 'enchente',
    severity: 'media',
    status: 'reportada',
    latitude: -23.5505,
    longitude: -46.6333,
    address: '',
    affectable_population: 0,
  })

  // Load Data
  const loadData = async () => {
    try {
      const [occData, teamData, alertData] = await Promise.all([
        occurrencesService.list(),
        teamsService.list(),
        alertsService.list(),
      ])
      setOccurrences(occData)
      setTeams(teamData)
      setAlerts(alertData)

      // Handle deep-link
      const idParam = searchParams.get('id')
      if (idParam) {
        const found = occData.find((o) => o.id === idParam)
        if (found) {
          setSelectedOccurrence(found)
          setIsDetailOpen(true)
        }
      }

      if (searchParams.get('new') === 'true') {
        openCreateForm()
      }
    } catch (err) {
      console.error('Erro ao carregar ocorrências:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Real-time subscriptions
  useRealtime<Occurrence>('occurrences', () => loadData())
  useRealtime<Team>('teams', () => loadData())
  useRealtime<Alert>('alerts', () => loadData())

  const openCreateForm = () => {
    setFormData({
      title: '',
      description: '',
      type: 'enchente',
      severity: 'alta',
      status: 'reportada',
      latitude: -23.5505,
      longitude: -46.6333,
      address: '',
      affectable_population: 50,
      reported_by: user?.id,
    })
    setSelectedOccurrence(null)
    setIsFormOpen(true)
  }

  const openEditForm = (occ: Occurrence) => {
    setSelectedOccurrence(occ)
    setFormData({
      ...occ,
    })
    setIsFormOpen(true)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.title?.trim()) {
      toast({ variant: 'destructive', title: 'Título é obrigatório' })
      return
    }

    try {
      if (selectedOccurrence) {
        // Update
        const payload = { ...formData }
        if (payload.status === 'concluida' && !payload.resolved_at) {
          payload.resolved_at = new Date().toISOString()
        }
        await occurrencesService.update(selectedOccurrence.id, payload)
        toast({ title: 'Ocorrência atualizada com sucesso' })
      } else {
        // Create
        const created = await occurrencesService.create({
          ...formData,
          reported_by: user?.id,
        })
        toast({ title: 'Ocorrência registrada com sucesso' })

        // Prompt alert creation if critical
        if (formData.severity === 'critica') {
          toast({
            title: 'Ocorrência Crítica Registrada',
            description: 'Deseja gerar um alerta emergencial para a população?',
            action: (
              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={() =>
                  navigate(
                    `/alertas?new=true&type=${formData.type}&severity=perigo_extremo&target=${encodeURIComponent(
                      formData.address || '',
                    )}&title=${encodeURIComponent(formData.title || '')}&related=${created.id}`,
                  )
                }
              >
                Criar Alerta
              </Button>
            ),
          })
        }
      }
      setIsFormOpen(false)
      loadData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao salvar ocorrência',
        description: getErrorMessage(err),
      })
    }
  }

  const handleDelete = async () => {
    if (!selectedOccurrence) return
    try {
      await occurrencesService.delete(selectedOccurrence.id)
      toast({ title: 'Ocorrência excluída com sucesso' })
      setIsDeleteModalOpen(false)
      setIsDetailOpen(false)
      loadData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao excluir',
        description: getErrorMessage(err),
      })
    }
  }

  const handleStatusChange = async (occ: Occurrence, newStatus: OccurrenceStatus) => {
    try {
      const payload: Partial<Occurrence> = { status: newStatus }
      if (newStatus === 'concluida') {
        payload.resolved_at = new Date().toISOString()
      }
      await occurrencesService.update(occ.id, payload)
      toast({ title: `Status alterado para ${STATUS_LABELS[newStatus]}` })
      loadData()
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erro ao atualizar status',
        description: getErrorMessage(err),
      })
    }
  }

  // Filter list
  const filteredOccurrences = occurrences.filter((occ) => {
    const matchText =
      !searchText ||
      occ.title.toLowerCase().includes(searchText.toLowerCase()) ||
      occ.description?.toLowerCase().includes(searchText.toLowerCase()) ||
      occ.address?.toLowerCase().includes(searchText.toLowerCase())

    const matchType = selectedType === 'all' || occ.type === selectedType
    const matchSeverity = selectedSeverity === 'all' || occ.severity === selectedSeverity
    const matchStatus = selectedStatus === 'all' || occ.status === selectedStatus

    return matchText && matchType && matchSeverity && matchStatus
  })

  // Pagination calculation
  const totalPages = Math.ceil(filteredOccurrences.length / itemsPerPage) || 1
  const paginatedOccurrences = filteredOccurrences.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  )
  // Linked items for selected occurrence detail
  const linkedTeams = selectedOccurrence
    ? teams.filter((t) => t.current_occurrence === selectedOccurrence.id)
    : []
  const linkedAlerts = selectedOccurrence
    ? alerts.filter((a) => a.related_occurrence === selectedOccurrence.id)
    : []

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with Title and Create Button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            Gestão de Ocorrências e Incidentes
          </h2>
          <p className="text-xs text-slate-500">
            Registro, rastreamento georreferenciado e despacho de equipes de resposta rápida.
          </p>
        </div>

        <Button
          onClick={openCreateForm}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs h-10 px-4 rounded-lg shadow-sm"
        >
          <Plus className="w-4 h-4 mr-1.5" />
          Registrar Nova Ocorrência
        </Button>
      </div>

      {/* Filter Bar */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar por título, endereço..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="pl-9 h-9 text-xs rounded-lg"
              />
            </div>

            {/* Type Filter */}
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Tipo de Desastre" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Tipos</SelectItem>
                {Object.keys(TYPE_LABELS).map((key) => (
                  <SelectItem key={key} value={key}>
                    {TYPE_LABELS[key as OccurrenceType]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Severity Filter */}
            <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Severidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Severidades</SelectItem>
                <SelectItem value="critica">Crítica (Extremo)</SelectItem>
                <SelectItem value="alta">Alta (Perigo)</SelectItem>
                <SelectItem value="media">Média (Alerta)</SelectItem>
                <SelectItem value="baixa">Baixa (Informativo)</SelectItem>
              </SelectContent>
            </Select>

            {/* Status Filter */}
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Status do Workflow" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Status</SelectItem>
                <SelectItem value="reportada">Reportada</SelectItem>
                <SelectItem value="em_andamento">Em Andamento</SelectItem>
                <SelectItem value="concluida">Concluída</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Main Table / Cards View */}
      <Card className="border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-50/80">
              <TableRow>
                <TableHead className="text-xs font-bold text-slate-700">
                  Tipo & Ocorrência
                </TableHead>
                <TableHead className="text-xs font-bold text-slate-700">Localização</TableHead>
                <TableHead className="text-xs font-bold text-slate-700">Severidade</TableHead>
                <TableHead className="text-xs font-bold text-slate-700">Status Workflow</TableHead>
                <TableHead className="text-xs font-bold text-slate-700">Pop. Afetada</TableHead>
                <TableHead className="text-xs font-bold text-slate-700">Data/Hora</TableHead>
                <TableHead className="text-xs font-bold text-slate-700 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-100">
              {paginatedOccurrences.map((occ) => (
                <TableRow
                  key={occ.id}
                  onClick={() => {
                    setSelectedOccurrence(occ)
                    setIsDetailOpen(true)
                  }}
                  className="cursor-pointer hover:bg-slate-50/90 transition-colors"
                >
                  <TableCell className="py-3.5">
                    <div className="flex items-start gap-2.5">
                      <div className="p-2 rounded-lg bg-slate-100 shrink-0 mt-0.5">
                        {getHazardIcon(occ.type, 'w-4 h-4')}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-900 line-clamp-1">{occ.title}</p>
                        <p className="text-[11px] text-slate-500 line-clamp-1">
                          {occ.description || 'Sem descrição.'}
                        </p>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="text-xs text-slate-600 font-medium">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate max-w-[180px]">
                        {occ.address || 'Coordenada manual'}
                      </span>
                    </div>
                  </TableCell>

                  <TableCell>
                    <SeverityBadge severity={occ.severity} />
                  </TableCell>

                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Select
                      value={occ.status}
                      onValueChange={(val) => handleStatusChange(occ, val as OccurrenceStatus)}
                    >
                      <SelectTrigger className="h-7 text-xs w-36 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="reportada">Reportada</SelectItem>
                        <SelectItem value="em_andamento">Em Andamento</SelectItem>
                        <SelectItem value="concluida">Concluída</SelectItem>
                        <SelectItem value="cancelada">Cancelada</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>

                  <TableCell className="text-xs text-slate-700 font-semibold">
                    {occ.affectable_population ? (
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        {occ.affectable_population.toLocaleString('pt-BR')}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>

                  <TableCell className="text-[11px] text-slate-500 whitespace-nowrap">
                    {new Date(occ.created).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </TableCell>

                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => openEditForm(occ)}
                        className="w-8 h-8 text-slate-600 hover:text-blue-600"
                        title="Editar"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          setSelectedOccurrence(occ)
                          setIsDeleteModalOpen(true)
                        }}
                        className="w-8 h-8 text-slate-600 hover:text-red-600"
                        title="Excluir"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}

              {filteredOccurrences.length === 0 && !isLoading && (
                <TableRow>
                  <TableCell colSpan={7} className="py-12 text-center text-xs text-slate-500">
                    Nenhuma ocorrência encontrada para os filtros selecionados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls */}
        {filteredOccurrences.length > itemsPerPage && (
          <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs">
            <span className="text-slate-500">
              Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, filteredOccurrences.length)}{' '}
              a {Math.min(currentPage * itemsPerPage, filteredOccurrences.length)} de{' '}
              {filteredOccurrences.length} ocorrências
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="h-8 text-xs bg-white"
              >
                Anterior
              </Button>
              <span className="px-2 font-semibold text-slate-700">
                Pág {currentPage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="h-8 text-xs bg-white"
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Detail Drawer / Modal */}
      {isDetailOpen && selectedOccurrence && (
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
            <DialogHeader>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
                    {getHazardIcon(selectedOccurrence.type, 'w-5 h-5')}
                  </div>
                  <div>
                    <DialogTitle className="text-base font-bold text-slate-900 leading-tight">
                      {selectedOccurrence.title}
                    </DialogTitle>
                    <p className="text-xs text-slate-500">
                      ID: {selectedOccurrence.id} • Registrado em{' '}
                      {new Date(selectedOccurrence.created).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 text-xs py-2">
              {/* Badges strip */}
              <div className="flex flex-wrap items-center gap-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-slate-700">Severidade:</span>
                  <SeverityBadge severity={selectedOccurrence.severity} />
                </div>
                <div className="flex items-center gap-1.5 ml-auto">
                  <span className="font-semibold text-slate-700">Status:</span>
                  <StatusBadge status={selectedOccurrence.status} />
                </div>
              </div>

              {/* Description */}
              <div>
                <Label className="text-xs font-bold text-slate-700">Descrição do Ocorrido</Label>
                <p className="mt-1 p-3 bg-slate-50 rounded-lg text-slate-700 leading-relaxed border border-slate-200">
                  {selectedOccurrence.description || 'Nenhum detalhe adicional informado.'}
                </p>
              </div>

              {/* Location and Map Preview */}
              <div>
                <Label className="text-xs font-bold text-slate-700 flex items-center justify-between">
                  <span>Geolocalização do Ponto Crítico</span>
                  <span className="text-slate-500 font-normal">
                    {selectedOccurrence.address || 'Coordenadas definidas'}
                  </span>
                </Label>
                <div className="mt-1.5 rounded-lg overflow-hidden border border-slate-200">
                  <InteractiveMap
                    height="180px"
                    occurrences={[selectedOccurrence]}
                    center={[
                      selectedOccurrence.latitude || -23.5505,
                      selectedOccurrence.longitude || -46.6333,
                    ]}
                  />
                </div>
              </div>

              {/* Linked Teams & Alerts Row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {/* Linked Teams */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <h4 className="font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-purple-600" />
                    Equipes Mobilizadas ({linkedTeams.length})
                  </h4>
                  {linkedTeams.length > 0 ? (
                    <div className="space-y-1">
                      {linkedTeams.map((t) => (
                        <div key={t.id} className="text-[11px] text-slate-700 flex justify-between">
                          <span>{t.name}</span>
                          <span className="capitalize font-semibold text-purple-700">{t.type}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      Nenhuma equipe vinculada a esta ocorrência.
                    </p>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate('/equipes')}
                    className="w-full mt-2 text-[11px] h-7"
                  >
                    Atribuir Equipe
                  </Button>
                </div>

                {/* Linked Alerts */}
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <h4 className="font-bold text-slate-800 mb-1.5 flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-amber-600" />
                    Alertas Emitidos ({linkedAlerts.length})
                  </h4>
                  {linkedAlerts.length > 0 ? (
                    <div className="space-y-1">
                      {linkedAlerts.map((a) => (
                        <div key={a.id} className="text-[11px] text-slate-700 flex justify-between">
                          <span className="truncate max-w-[140px]">{a.title}</span>
                          <Badge variant="outline" className="text-[9px] capitalize">
                            {a.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-slate-500">
                      Nenhum alerta disparado para este evento.
                    </p>
                  )}
                  <Button
                    size="sm"
                    className="w-full mt-2 text-[11px] h-7 bg-amber-600 hover:bg-amber-700 text-white"
                    onClick={() =>
                      navigate(
                        `/alertas?new=true&type=${selectedOccurrence.type}&severity=${
                          selectedOccurrence.severity === 'critica' ? 'perigo_extremo' : 'alerta'
                        }&target=${encodeURIComponent(
                          selectedOccurrence.address || '',
                        )}&title=${encodeURIComponent(
                          selectedOccurrence.title,
                        )}&related=${selectedOccurrence.id}`,
                      )
                    }
                  >
                    <Sparkles className="w-3 h-3 mr-1" />
                    Gerar Alerta com IA
                  </Button>
                </div>
              </div>
            </div>

            <DialogFooter className="flex flex-col sm:flex-row justify-between gap-2 border-t pt-3">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setIsDeleteModalOpen(true)}
                className="w-full sm:w-auto"
              >
                Excluir
              </Button>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDetailOpen(false)}
                  className="w-full sm:w-auto"
                >
                  Fechar
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    setIsDetailOpen(false)
                    openEditForm(selectedOccurrence)
                  }}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Editar Ocorrência
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Create / Edit Form Modal */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              {selectedOccurrence ? 'Editar Ocorrência' : 'Registrar Nova Ocorrência'}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Preencha os dados da ocorrência climática com coordenadas e severidade para pronta
              resposta.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">Título do Evento *</Label>
              <Input
                required
                placeholder="Ex: Alagamento crítico na Bacia Central"
                value={formData.title || ''}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Tipo de Evento</Label>
                <Select
                  value={formData.type}
                  onValueChange={(val) => setFormData({ ...formData, type: val as OccurrenceType })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.keys(TYPE_LABELS).map((key) => (
                      <SelectItem key={key} value={key}>
                        {TYPE_LABELS[key as OccurrenceType]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Severidade / Risco</Label>
                <Select
                  value={formData.severity}
                  onValueChange={(val) =>
                    setFormData({ ...formData, severity: val as OccurrenceSeverity })
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critica">Crítica (Extremo)</SelectItem>
                    <SelectItem value="alta">Alta (Perigo)</SelectItem>
                    <SelectItem value="media">Média (Alerta)</SelectItem>
                    <SelectItem value="baixa">Baixa (Informativo)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">Status Workflow</Label>
                <Select
                  value={formData.status}
                  onValueChange={(val) =>
                    setFormData({ ...formData, status: val as OccurrenceStatus })
                  }
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reportada">Reportada</SelectItem>
                    <SelectItem value="em_andamento">Em Andamento</SelectItem>
                    <SelectItem value="concluida">Concluída</SelectItem>
                    <SelectItem value="cancelada">Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  Endereço / Referência
                </Label>
                <Input
                  placeholder="Ex: Av. Beira Rio, 450 - Centro"
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-slate-700">
                  População Estimada Afetada
                </Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={formData.affectable_population ?? ''}
                  onChange={(e) =>
                    setFormData({ ...formData, affectable_population: Number(e.target.value) })
                  }
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-slate-700">
                Descrição e Relatório de Campo
              </Label>
              <Textarea
                rows={3}
                placeholder="Descreva a situação observada, danos materiais, vítimas e riscos iminentes..."
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="text-xs"
              />
            </div>

            {/* Mini Interactive Map to pick Pin */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-slate-700">
                  Posicionar Marcador no Mapa (Clique no mapa)
                </Label>
                <span className="text-[11px] font-mono text-slate-500">
                  Lat: {formData.latitude?.toFixed(4)}, Lng: {formData.longitude?.toFixed(4)}
                </span>
              </div>
              <InteractiveMap
                height="200px"
                interactivePick={true}
                pickedCoordinate={{
                  lat: formData.latitude || -23.5505,
                  lng: formData.longitude || -46.6333,
                }}
                onPickCoordinate={(lat, lng) => {
                  setFormData({ ...formData, latitude: lat, longitude: lng })
                }}
                center={[formData.latitude || -23.5505, formData.longitude || -46.6333]}
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsFormOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" size="sm" className="bg-blue-600 hover:bg-blue-700 text-white">
                {selectedOccurrence ? 'Salvar Alterações' : 'Cadastrar Ocorrência'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent className="max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900">
              Confirmar Exclusão de Ocorrência
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600">
              Tem certeza que deseja excluir esta ocorrência ({selectedOccurrence?.title})? Esta
              ação não poderá ser revertida.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsDeleteModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDelete}>
              Excluir Definitivamente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
