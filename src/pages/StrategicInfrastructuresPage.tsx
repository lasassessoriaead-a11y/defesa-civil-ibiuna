import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus,
  Search,
  Filter,
  MapPin,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  AlertOctagon,
  FileText,
  Camera,
  ExternalLink,
  ChevronRight,
  Shield,
  Clock,
  ClipboardList,
  Edit,
  Trash2,
  Building2,
  Eye,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import {
  strategicInfrastructuresService,
  bridgeInspectionsService,
  occurrencesService,
} from '@/services/defesa-civil'
import type {
  StrategicInfrastructure,
  BridgeInspection,
  Occurrence,
  InfrastructureType,
} from '@/types/defesa-civil'

export const StrategicInfrastructuresPage: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()

  const [infrastructures, setInfrastructures] = useState<StrategicInfrastructure[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterCondition, setFilterCondition] = useState<string>('all')
  const [filterInspection, setFilterInspection] = useState<string>('all')

  // Modal de Detalhes & Inspeção
  const [selectedInfra, setSelectedInfra] = useState<StrategicInfrastructure | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [inspections, setInspections] = useState<BridgeInspection[]>([])
  const [relatedOccurrences, setRelatedOccurrences] = useState<Occurrence[]>([])
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)

  // Modal de Nova Inspeção Técnica
  const [isNewInspectionOpen, setIsNewInspectionOpen] = useState(false)
  const [inspCondition, setInspCondition] = useState<'bom' | 'regular' | 'ruim' | 'critico'>(
    'regular',
  )
  const [inspTraffic, setInspTraffic] = useState<
    'livre' | 'restricao_peso' | 'meia_pista' | 'interditada'
  >('livre')
  const [inspProblems, setInspProblems] = useState('')
  const [inspRecommendations, setInspRecommendations] = useState('')
  const [isSubmittingInspection, setIsSubmittingInspection] = useState(false)

  // Modal de Cadastro/Edição Direta de Estrutura
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [formCode, setFormCode] = useState('')
  const [formType, setFormType] = useState<InfrastructureType>('ponte')
  const [formNeighborhood, setFormNeighborhood] = useState('')
  const [formRefPoint, setFormRefPoint] = useState('')
  const [formLat, setFormLat] = useState('')
  const [formLon, setFormLon] = useState('')
  const [formDimensions, setFormDimensions] = useState('')
  const [formProblems, setFormProblems] = useState('')
  const [formCondition, setFormCondition] = useState<string>('nao_avaliado')
  const [formPriority, setFormPriority] = useState<string>('media')
  const [formInspStatus, setFormInspStatus] = useState<string>('em_dia')
  const [isSavingForm, setIsSavingForm] = useState(false)

  const municipalityId = user?.municipality || ''

  const loadData = async () => {
    setIsLoading(true)
    try {
      const records = await strategicInfrastructuresService.list(undefined, 'original_code')
      setInfrastructures(records)
    } catch (e) {
      console.error(e)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const openDetails = async (infra: StrategicInfrastructure) => {
    setSelectedInfra(infra)
    setIsDetailOpen(true)
    setIsLoadingDetails(true)
    try {
      const [insps, occs] = await Promise.all([
        bridgeInspectionsService.listForInfrastructure(infra.id),
        occurrencesService.list(`strategic_infrastructure = "${infra.id}"`),
      ])
      setInspections(insps)
      setRelatedOccurrences(occs)
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoadingDetails(false)
    }
  }

  const handleCreateInspection = async () => {
    if (!selectedInfra) return
    setIsSubmittingInspection(true)

    try {
      await bridgeInspectionsService.create({
        municipality: municipalityId,
        infrastructure: selectedInfra.id,
        inspector: user?.id,
        inspection_date: new Date().toISOString(),
        structural_condition: inspCondition,
        traffic_condition: inspTraffic,
        problems_found: inspProblems,
        technical_recommendations: inspRecommendations,
      })

      // Atualiza estado da estrutura no cadastro
      await strategicInfrastructuresService.update(selectedInfra.id, {
        structural_condition: inspCondition,
        last_inspection_date: new Date().toISOString(),
        inspection_status: inspCondition === 'critico' ? 'interditada' : 'em_dia',
      })

      toast({
        title: 'Vistoria Técnica Registrada',
        description: 'Condição da ponte atualizada e arquivada para histórico.',
      })

      setIsNewInspectionOpen(false)
      setInspProblems('')
      setInspRecommendations('')
      openDetails(selectedInfra)
      loadData()
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'Erro ao registrar vistoria',
        description: err.message,
      })
    } finally {
      setIsSubmittingInspection(false)
    }
  }

  const handleSaveStructure = async () => {
    if (!formCode.trim()) {
      toast({ variant: 'destructive', title: 'Identificador obrigatório' })
      return
    }
    setIsSavingForm(true)
    try {
      const payload: Partial<StrategicInfrastructure> = {
        municipality: municipalityId,
        original_code: formCode.trim(),
        type: formType,
        neighborhood: formNeighborhood.trim(),
        reference_point: formRefPoint.trim(),
        latitude: formLat ? parseFloat(formLat) : undefined,
        longitude: formLon ? parseFloat(formLon) : undefined,
        coordinate_status: formLat && formLon ? 'valida' : 'ausente',
        dimensions: formDimensions.trim(),
        observed_problems: formProblems.trim(),
        structural_condition: formCondition as any,
        administrative_priority: formPriority as any,
        inspection_status: formInspStatus as any,
        validation_status: 'conferido',
      }

      await strategicInfrastructuresService.create(payload)
      toast({ title: 'Estrutura cadastrada com sucesso' })
      setIsEditModalOpen(false)
      loadData()
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'Erro ao salvar', description: e.message })
    } finally {
      setIsSavingForm(false)
    }
  }

  // Filtragem
  const filtered = infrastructures.filter((i) => {
    const matchSearch =
      search === '' ||
      i.original_code.toLowerCase().includes(search.toLowerCase()) ||
      (i.neighborhood && i.neighborhood.toLowerCase().includes(search.toLowerCase())) ||
      (i.reference_point && i.reference_point.toLowerCase().includes(search.toLowerCase()))

    const matchType = filterType === 'all' || i.type === filterType
    const matchCondition = filterCondition === 'all' || i.structural_condition === filterCondition
    const matchInspection = filterInspection === 'all' || i.inspection_status === filterInspection

    return matchSearch && matchType && matchCondition && matchInspection
  })

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-blue-50 text-blue-700 rounded-lg">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Infraestruturas Mapeadas — Pontes, Aduelas & Drenagem
            </h1>
            <p className="text-xs text-slate-500">
              Gestão técnica cadastral, histórico de vistorias, separação entre condição estrutural
              e prioridade de atendimento
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link to="/pontes-conferencia">
            <Button
              variant="outline"
              className="text-xs border-indigo-200 text-indigo-700 hover:bg-indigo-50"
            >
              <ClipboardList className="w-3.5 h-3.5 mr-1.5" />
              Conferência Assistida (PDF)
            </Button>
          </Link>

          <Button
            onClick={() => {
              setFormCode('')
              setFormNeighborhood('')
              setFormRefPoint('')
              setFormLat('')
              setFormLon('')
              setFormDimensions('')
              setFormProblems('')
              setIsEditModalOpen(true)
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            Nova Estrutura
          </Button>
        </div>
      </div>

      {/* Quick Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-slate-200">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-slate-500">Total Cadastradas</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{infrastructures.length}</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Pontes, aduelas e bueiros</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-amber-50/40 border-amber-200">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-amber-700">Necessitam Vistoria</p>
            <p className="text-2xl font-bold text-amber-900 mt-1">
              {
                infrastructures.filter(
                  (i) => i.inspection_status === 'necessita_vistoria' || !i.last_inspection_date,
                ).length
              }
            </p>
            <p className="text-[10px] text-amber-600 mt-0.5">Sem inspeção recente</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-red-50/40 border-red-200">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-red-700">Condição Crítica / Interditada</p>
            <p className="text-2xl font-bold text-red-900 mt-1">
              {
                infrastructures.filter(
                  (i) =>
                    i.structural_condition === 'critico' || i.inspection_status === 'interditada',
                ).length
              }
            </p>
            <p className="text-[10px] text-red-600 mt-0.5">Risco estrutural detectado</p>
          </CardContent>
        </Card>

        <Card className="border-slate-200 bg-emerald-50/40 border-emerald-200">
          <CardContent className="p-4">
            <p className="text-xs font-medium text-emerald-700">Com Posição no Mapa</p>
            <p className="text-2xl font-bold text-emerald-900 mt-1">
              {
                infrastructures.filter(
                  (i) => i.latitude && i.longitude && i.coordinate_status === 'valida',
                ).length
              }
            </p>
            <p className="text-[10px] text-emerald-600 mt-0.5">WGS84 validado em Ibiúna</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter and Search Bar */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Buscar por código (ex: P1, P224), bairro (Paruru, Feital) ou ponto de referência..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-xs h-9"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-36 h-9 text-xs">
                  <SelectValue placeholder="Tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos Tipos</SelectItem>
                  <SelectItem value="ponte">Ponte</SelectItem>
                  <SelectItem value="aduela">Aduela</SelectItem>
                  <SelectItem value="bueiro">Bueiro</SelectItem>
                  <SelectItem value="pendente_classificacao">Pendente</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterCondition} onValueChange={setFilterCondition}>
                <SelectTrigger className="w-40 h-9 text-xs">
                  <SelectValue placeholder="Condição" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Condições</SelectItem>
                  <SelectItem value="bom">Bom</SelectItem>
                  <SelectItem value="regular">Regular</SelectItem>
                  <SelectItem value="ruim">Ruim</SelectItem>
                  <SelectItem value="critico">Crítico</SelectItem>
                  <SelectItem value="nao_avaliado">Não Avaliado</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterInspection} onValueChange={setFilterInspection}>
                <SelectTrigger className="w-44 h-9 text-xs">
                  <SelectValue placeholder="Situação Vistoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Situações</SelectItem>
                  <SelectItem value="em_dia">Em Dia</SelectItem>
                  <SelectItem value="necessita_vistoria">Necessita Vistoria</SelectItem>
                  <SelectItem value="interditada">Interditada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Table */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow className="text-[11px]">
                  <TableHead className="w-20">Código</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Bairro / Localidade</TableHead>
                  <TableHead>Referência / Rodovia</TableHead>
                  <TableHead>Coordenadas (WGS84)</TableHead>
                  <TableHead>Condição Estrutural</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Vistoria</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="text-xs">
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                      Carregando cadastro de infraestruturas...
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-slate-500">
                      Nenhuma estrutura encontrada com os filtros selecionados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((item) => (
                    <TableRow key={item.id} className="hover:bg-slate-50/80">
                      <TableCell className="font-mono font-bold text-slate-900">
                        {item.original_code}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            item.type === 'ponte'
                              ? 'bg-blue-50 text-blue-700 border-blue-200 capitalize'
                              : item.type === 'aduela'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 capitalize'
                                : 'bg-slate-100 text-slate-700 border-slate-200 capitalize'
                          }
                        >
                          {item.type.replace('_', ' ')}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-slate-800">
                        {item.neighborhood || '-'}
                      </TableCell>
                      <TableCell
                        className="text-slate-600 max-w-[200px] truncate"
                        title={item.reference_point}
                      >
                        {item.reference_point || '-'}
                      </TableCell>
                      <TableCell className="font-mono text-[11px]">
                        {item.latitude && item.longitude ? (
                          <span className="text-emerald-700">
                            {item.latitude.toFixed(4)}, {item.longitude.toFixed(4)}
                          </span>
                        ) : (
                          <span className="text-amber-600">Pendente de Coordenadas</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            item.structural_condition === 'critico'
                              ? 'bg-red-100 text-red-800 border-red-300 font-bold'
                              : item.structural_condition === 'ruim'
                                ? 'bg-orange-100 text-orange-800 border-orange-300'
                                : item.structural_condition === 'regular'
                                  ? 'bg-amber-100 text-amber-800 border-amber-300'
                                  : item.structural_condition === 'bom'
                                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    : 'bg-slate-100 text-slate-600'
                          }
                        >
                          {item.structural_condition
                            ? item.structural_condition.replace('_', ' ')
                            : 'não avaliado'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`capitalize font-semibold text-[11px] ${
                            item.administrative_priority === 'urgente'
                              ? 'text-red-600'
                              : item.administrative_priority === 'alta'
                                ? 'text-orange-600'
                                : 'text-slate-600'
                          }`}
                        >
                          {item.administrative_priority || 'média'}
                        </span>
                      </TableCell>
                      <TableCell>
                        {item.last_inspection_date ? (
                          <span className="text-slate-600 text-[11px]">
                            {new Date(item.last_inspection_date).toLocaleDateString('pt-BR')}
                          </span>
                        ) : (
                          <span className="text-amber-600 font-medium text-[11px]">
                            Requer Vistoria
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openDetails(item)}
                          className="h-8 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          Detalhes
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Modal de Detalhes Técnicos, Vistorias e Ocorrências Vinculadas */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {selectedInfra && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between">
                  <DialogTitle className="text-lg font-bold flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    Estrutura {selectedInfra.original_code} —{' '}
                    {selectedInfra.neighborhood || 'Local não informado'}
                  </DialogTitle>
                  <Badge variant="outline" className="capitalize">
                    {selectedInfra.type.replace('_', ' ')}
                  </Badge>
                </div>
                <DialogDescription className="text-xs">
                  Prancha documental: {selectedInfra.source_document || 'Pontes e aduelas.pdf'}{' '}
                  (Página {selectedInfra.source_page || '-'})
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2 text-xs">
                {/* Atributos Gerais */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-lg border">
                  <div>
                    <span className="text-slate-500 block">Ponto de Referência:</span>
                    <strong className="text-slate-800">
                      {selectedInfra.reference_point || 'Não informado'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Dimensões / Calha:</span>
                    <strong className="text-slate-800">
                      {selectedInfra.dimensions || selectedInfra.channel_width || 'Não informado'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Coordenadas DMS:</span>
                    <span className="font-mono text-slate-700">
                      {selectedInfra.lat_dms || '-'} / {selectedInfra.lon_dms || '-'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Condição Estrutural:</span>
                    <strong className="capitalize text-slate-800">
                      {selectedInfra.structural_condition?.replace('_', ' ') || 'Não avaliado'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Prioridade Operacional:</span>
                    <strong className="capitalize text-slate-800">
                      {selectedInfra.administrative_priority || 'Média'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Status no Mapa:</span>
                    <strong
                      className={selectedInfra.latitude ? 'text-emerald-700' : 'text-amber-600'}
                    >
                      {selectedInfra.latitude ? 'Georreferenciada' : 'Aguardando validação'}
                    </strong>
                  </div>
                </div>

                {/* Problemas Observados */}
                {selectedInfra.observed_problems && (
                  <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <p className="font-bold text-amber-900 mb-0.5">
                      Problemas Registrados em Campo:
                    </p>
                    <p className="text-amber-800">{selectedInfra.observed_problems}</p>
                  </div>
                )}

                {/* Histórico de Vistorias Técnicas */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                      <ClipboardList className="w-4 h-4 text-indigo-600" />
                      Histórico de Vistorias e Inspeções Técnicas ({inspections.length})
                    </h4>
                    <Button
                      size="sm"
                      onClick={() => setIsNewInspectionOpen(true)}
                      className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Registrar Nova Vistoria
                    </Button>
                  </div>

                  {inspections.length === 0 ? (
                    <p className="text-slate-500 italic p-3 bg-slate-50 rounded border text-center">
                      Nenhuma vistoria técnica registrada para esta estrutura.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {inspections.map((insp) => (
                        <div
                          key={insp.id}
                          className="p-3 bg-white border rounded-lg shadow-sm space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800">
                              Data: {new Date(insp.inspection_date).toLocaleDateString('pt-BR')}
                            </span>
                            <Badge variant="outline" className="capitalize">
                              Condição: {insp.structural_condition}
                            </Badge>
                          </div>
                          {insp.problems_found && (
                            <p className="text-slate-600">
                              <strong>Problemas:</strong> {insp.problems_found}
                            </p>
                          )}
                          {insp.technical_recommendations && (
                            <p className="text-slate-600">
                              <strong>Recomendações:</strong> {insp.technical_recommendations}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Ocorrências Vinculadas */}
                <div className="space-y-2 pt-2 border-t">
                  <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                    <AlertOctagon className="w-4 h-4 text-red-600" />
                    Ocorrências Municipais Relacionadas ({relatedOccurrences.length})
                  </h4>

                  {relatedOccurrences.length === 0 ? (
                    <p className="text-slate-500 italic p-3 bg-slate-50 rounded border text-center">
                      Nenhuma ocorrência municipal registrada neste ponto ou vinculada a esta
                      estrutura.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {relatedOccurrences.map((occ) => (
                        <div
                          key={occ.id}
                          className="p-2.5 bg-slate-50 rounded border flex items-center justify-between"
                        >
                          <div>
                            <span className="font-semibold text-slate-900">{occ.title}</span>
                            <span className="text-slate-500 ml-2">({occ.code})</span>
                            <p className="text-slate-600 text-[11px] mt-0.5">{occ.address}</p>
                          </div>
                          <Badge variant="outline">{occ.severity}</Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
                  Fechar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal de Registro de Nova Vistoria Técnica */}
      <Dialog open={isNewInspectionOpen} onOpenChange={setIsNewInspectionOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              Nova Vistoria Técnica — {selectedInfra?.original_code}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Registre a avaliação estrutural da ponte ou aduela realizada pelo engenheiro ou agente
              de campo.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Condição Estrutural Avaliada</label>
              <Select value={inspCondition} onValueChange={(v: any) => setInspCondition(v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bom">Bom (Sem avarias relevantes)</SelectItem>
                  <SelectItem value="regular">Regular (Desgaste ou trincas leves)</SelectItem>
                  <SelectItem value="ruim">Ruim (Avarias severas, armadura exposta)</SelectItem>
                  <SelectItem value="critico">Crítico (Risco iminente de colapso)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Situação do Trânsito</label>
              <Select value={inspTraffic} onValueChange={(v: any) => setInspTraffic(v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="livre">Trânsito Livre</SelectItem>
                  <SelectItem value="restricao_peso">Restrição de Carga / Peso</SelectItem>
                  <SelectItem value="meia_pista">Meia Pista</SelectItem>
                  <SelectItem value="interditada">Interditada Totalmente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Problemas Detectados</label>
              <Textarea
                placeholder="Descreva trincas, erosão de cabeceira, assoreamento, guarda-corpo danificado..."
                value={inspProblems}
                onChange={(e) => setInspProblems(e.target.value)}
                className="text-xs h-16"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700">Recomendações Técnicas</label>
              <Textarea
                placeholder="Recomendações para obras, contenção, limpeza de leito, etc..."
                value={inspRecommendations}
                onChange={(e) => setInspRecommendations(e.target.value)}
                className="text-xs h-16"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsNewInspectionOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateInspection}
              disabled={isSubmittingInspection}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
            >
              {isSubmittingInspection ? 'Salvando...' : 'Gravar Vistoria'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
export default StrategicInfrastructuresPage
