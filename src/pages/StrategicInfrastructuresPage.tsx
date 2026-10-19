import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import {
  Plus,
  Search,
  MapPin,
  AlertTriangle,
  AlertOctagon,
  FileText,
  Camera,
  ExternalLink,
  ClipboardList,
  Building2,
  Eye,
  Map as MapIcon,
  XCircle,
  FileQuestion,
  Layers,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/hooks/use-toast'
import {
  strategicInfrastructuresService,
  bridgeInspectionsService,
  occurrencesService,
  externalDemandsService,
} from '@/services/defesa-civil'
import type {
  StrategicInfrastructure,
  BridgeInspection,
  Occurrence,
  ExternalDemand,
  InfrastructureType,
} from '@/types/defesa-civil'

export const StrategicInfrastructuresPage: React.FC = () => {
  const { user } = useAuth()
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const urlParamId = searchParams.get('id')

  const [infrastructures, setInfrastructures] = useState<StrategicInfrastructure[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [filterCondition, setFilterCondition] = useState<string>('all')
  const [filterInspection, setFilterInspection] = useState<string>('all')

  // Modal de Detalhes & Inspeção
  const [selectedInfra, setSelectedInfra] = useState<StrategicInfrastructure | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)
  const [detailNotFound, setDetailNotFound] = useState(false)
  const [inspections, setInspections] = useState<BridgeInspection[]>([])
  const [relatedOccurrences, setRelatedOccurrences] = useState<Occurrence[]>([])
  const [relatedDemands, setRelatedDemands] = useState<ExternalDemand[]>([])
  const [isLoadingDetails, setIsLoadingDetails] = useState(false)
  const [openedFromMap, setOpenedFromMap] = useState<boolean>(false)
  const hasInitializedRef = useRef(false)

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
      // Isolamento por município nas consultas da listagem
      const filter = municipalityId ? `municipality = "${municipalityId}"` : undefined
      const records = await strategicInfrastructuresService.list(filter, 'original_code')
      setInfrastructures(records)
      return records
    } catch (e) {
      console.error(e)
      return []
    } finally {
      setIsLoading(false)
    }
  }

  const openDetails = useCallback(
    async (infra: StrategicInfrastructure, fromMapSource = false) => {
      setSelectedInfra(infra)
      setDetailNotFound(false)
      setIsDetailOpen(true)
      setIsLoadingDetails(true)
      setOpenedFromMap(fromMapSource)

      try {
        const munFilter = municipalityId ? ` && municipality = "${municipalityId}"` : ''
        const [insps, occs, dems] = await Promise.all([
          bridgeInspectionsService.listForInfrastructure(infra.id),
          occurrencesService.list(`strategic_infrastructure = "${infra.id}"${munFilter}`),
          externalDemandsService.list(
            `related_infrastructure = "${infra.id}"${munFilter}`,
            '-created',
          ),
        ])
        setInspections(insps)
        setRelatedOccurrences(occs)
        setRelatedDemands(dems)
      } catch (err) {
        console.error(err)
      } finally {
        setIsLoadingDetails(false)
      }
    },
    [municipalityId],
  )

  const handleReturnToMap = () => {
    setIsDetailOpen(false)
    // Limpa a query string
    setSearchParams({}, { replace: true })
    // Retorna para o mapa no dashboard; InteractiveMap restaura automaticamente centro, zoom e camadas
    navigate('/', { replace: false })
  }

  const handleCloseDetailDialog = (open: boolean) => {
    setIsDetailOpen(open)
    if (!open) {
      // Remove o parâmetro ?id da URL sem recarregar a tela
      const nextParams = new URLSearchParams(searchParams)
      nextParams.delete('id')
      setSearchParams(nextParams, { replace: true })
      setDetailNotFound(false)
    }
  }

  // Carrega e observa o parâmetro ?id=... da URL
  useEffect(() => {
    const init = async () => {
      const records = await loadData()

      if (urlParamId) {
        // Checa se veio do mapa via router state
        const isFromMap = Boolean((location.state as any)?.fromMap)
        // Busca na lista local primeiro ou consulta no backend com isolamento de município
        let target = records.find((r) => r.id === urlParamId)
        if (!target) {
          try {
            const fetched = await strategicInfrastructuresService.get(urlParamId)
            if (
              fetched &&
              (!municipalityId || !fetched.municipality || fetched.municipality === municipalityId)
            ) {
              target = fetched
            }
          } catch (_) {
            target = undefined
          }
        }

        if (target) {
          openDetails(target, isFromMap)
        } else {
          // Id inválido ou não pertencente ao município do usuário: exibe mensagem clara
          setSelectedInfra(null)
          setDetailNotFound(true)
          setIsDetailOpen(true)
          setOpenedFromMap(isFromMap)
        }
      }
    }

    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true
      init()
    }
  }, [urlParamId, municipalityId, location.state, openDetails])

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

      {/* Modal de Detalhes Técnicos, Vistorias, Fotos e Documentos */}
      <Dialog open={isDetailOpen} onOpenChange={handleCloseDetailDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          {detailNotFound ? (
            <div className="py-8 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 mx-auto flex items-center justify-center">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Infraestrutura Não Encontrada
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
                  O identificador de infraestrutura informado não foi localizado no cadastro deste
                  município ou pode ter sido removido.
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => handleCloseDetailDialog(false)}>
                  Ver Todas as Infraestruturas
                </Button>
                <Button
                  size="sm"
                  onClick={handleReturnToMap}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <MapIcon className="w-3.5 h-3.5 mr-1.5" />
                  Voltar ao mapa
                </Button>
              </div>
            </div>
          ) : selectedInfra ? (
            <>
              <DialogHeader>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-100 text-blue-700 rounded-lg">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div>
                      <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        Ficha Técnica: {selectedInfra.original_code}
                        <Badge
                          variant="outline"
                          className={
                            selectedInfra.type === 'ponte'
                              ? 'bg-blue-50 text-blue-700 border-blue-200 capitalize text-[11px]'
                              : selectedInfra.type === 'aduela'
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200 capitalize text-[11px]'
                                : 'bg-slate-100 text-slate-700 border-slate-200 capitalize text-[11px]'
                          }
                        >
                          {selectedInfra.type
                            ? selectedInfra.type.replace('_', ' ')
                            : 'Não avaliado'}
                        </Badge>
                      </DialogTitle>
                      <DialogDescription className="text-xs text-slate-500 mt-0.5">
                        {selectedInfra.neighborhood || 'Bairro não informado'}
                        {selectedInfra.reference_point ? ` • ${selectedInfra.reference_point}` : ''}
                      </DialogDescription>
                    </div>
                  </div>

                  {/* Botão de retorno direto preservando estado do mapa */}
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleReturnToMap}
                    className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shrink-0 shadow-sm"
                  >
                    <MapIcon className="w-3.5 h-3.5 mr-1.5" />
                    Voltar ao mapa
                  </Button>
                </div>
              </DialogHeader>

              {/* Informações Básicas em Destaque */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 block text-[11px]">Código Identificador:</span>
                  <strong className="font-mono text-slate-900 text-sm">
                    {selectedInfra.original_code}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Tipo de Estrutura:</span>
                  <strong className="capitalize text-slate-800">
                    {selectedInfra.type ? selectedInfra.type.replace('_', ' ') : 'Não avaliado'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Bairro / Localidade:</span>
                  <strong className="text-slate-800">
                    {selectedInfra.neighborhood || 'Não informado'}
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 block text-[11px]">Condição Estrutural:</span>
                  <Badge
                    variant="outline"
                    className={
                      selectedInfra.structural_condition === 'critico'
                        ? 'bg-red-100 text-red-800 border-red-300'
                        : selectedInfra.structural_condition === 'ruim'
                          ? 'bg-orange-100 text-orange-800 border-orange-300'
                          : selectedInfra.structural_condition === 'regular'
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : selectedInfra.structural_condition === 'bom'
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : 'bg-slate-100 text-slate-600'
                    }
                  >
                    {selectedInfra.structural_condition
                      ? selectedInfra.structural_condition.replace('_', ' ')
                      : 'Não avaliado'}
                  </Badge>
                </div>
              </div>

              {/* Abas da Ficha: Dados Gerais, Vistorias, Fotos & Documentos, Demandas & Ocorrências */}
              <Tabs defaultValue="dados" className="w-full">
                <TabsList className="grid w-full grid-cols-4 h-9">
                  <TabsTrigger value="dados" className="text-xs">
                    <FileText className="w-3.5 h-3.5 mr-1 hidden sm:inline" />
                    Dados Gerais
                  </TabsTrigger>
                  <TabsTrigger value="vistorias" className="text-xs">
                    <ClipboardList className="w-3.5 h-3.5 mr-1 hidden sm:inline" />
                    Vistorias ({inspections.length})
                  </TabsTrigger>
                  <TabsTrigger value="fotos-docs" className="text-xs">
                    <Camera className="w-3.5 h-3.5 mr-1 hidden sm:inline" />
                    Fotos & Docs
                  </TabsTrigger>
                  <TabsTrigger value="ocorrencias" className="text-xs">
                    <AlertOctagon className="w-3.5 h-3.5 mr-1 hidden sm:inline" />
                    Ocorrências ({relatedOccurrences.length})
                  </TabsTrigger>
                </TabsList>

                {/* Aba 1: Dados Gerais */}
                <TabsContent value="dados" className="space-y-3 pt-2 text-xs">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Bloco de Coordenadas e Posição */}
                    <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                      <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                        <MapPin className="w-3.5 h-3.5 text-blue-600" />
                        Coordenadas Geográficas
                      </h4>
                      <div className="space-y-1.5">
                        <div>
                          <span className="text-slate-500 block text-[11px]">
                            Coordenadas DMS (Original Preservado):
                          </span>
                          <span className="font-mono text-slate-800 font-semibold bg-slate-50 px-2 py-0.5 rounded inline-block">
                            {selectedInfra.lat_dms || '—'} / {selectedInfra.lon_dms || '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[11px]">
                            Coordenadas Decimais (WGS84):
                          </span>
                          {selectedInfra.latitude && selectedInfra.longitude ? (
                            <span className="font-mono text-emerald-700 font-semibold">
                              {selectedInfra.latitude.toFixed(6)},{' '}
                              {selectedInfra.longitude.toFixed(6)}
                            </span>
                          ) : (
                            <span className="text-amber-600 italic">
                              Aguardando conferência / Ausente no mapa
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[11px]">
                            Status da Coordenada:
                          </span>
                          <Badge
                            variant="outline"
                            className={
                              selectedInfra.coordinate_status === 'valida'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 capitalize'
                                : selectedInfra.coordinate_status === 'duvidosa'
                                  ? 'bg-amber-50 text-amber-700 border-amber-200 capitalize'
                                  : 'bg-slate-100 text-slate-700 border-slate-200 capitalize'
                            }
                          >
                            {selectedInfra.coordinate_status || 'não informado'}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Bloco de Dimensões e Referências */}
                    <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                      <h4 className="font-bold text-slate-800 flex items-center gap-1.5 text-xs">
                        <Layers className="w-3.5 h-3.5 text-indigo-600" />
                        Dimensões & Prancha Documental
                      </h4>
                      <div className="space-y-1.5">
                        <div>
                          <span className="text-slate-500 block text-[11px]">
                            Dimensões / Calha / Vão Livre:
                          </span>
                          <span className="font-semibold text-slate-800">
                            {selectedInfra.dimensions ||
                              selectedInfra.channel_width ||
                              'Não informado'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[11px]">
                            Documento Fonte / Prancha:
                          </span>
                          <span className="text-slate-700 font-medium">
                            {selectedInfra.source_document || 'Pontes e aduelas.pdf'} (Página{' '}
                            {selectedInfra.source_page || '-'})
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500 block text-[11px]">
                            Prioridade Operacional:
                          </span>
                          <span className="font-semibold capitalize text-slate-800">
                            {selectedInfra.administrative_priority || 'Média'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Problemas Registrados em Campo */}
                  {selectedInfra.observed_problems && (
                    <div className="p-3 bg-amber-50/80 rounded-lg border border-amber-200">
                      <p className="font-bold text-amber-900 mb-1 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                        Problemas Registrados no Levantamento de Campo:
                      </p>
                      <p className="text-amber-800 text-xs leading-relaxed">
                        {selectedInfra.observed_problems}
                      </p>
                    </div>
                  )}

                  {/* Notas Técnicas / Observações */}
                  {selectedInfra.notes && (
                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                      <p className="font-bold text-slate-800 mb-1">Observações Complementares:</p>
                      <p className="text-slate-600 text-xs">{selectedInfra.notes}</p>
                    </div>
                  )}
                </TabsContent>

                {/* Aba 2: Vistorias Técnicas */}
                <TabsContent value="vistorias" className="space-y-3 pt-2 text-xs">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-800">
                        Histórico de Vistorias Técnicas ({inspections.length})
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Inspeções estruturais realizadas pela equipe técnica da Defesa Civil
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setIsNewInspectionOpen(true)}
                      className="h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" />
                      Nova Vistoria
                    </Button>
                  </div>

                  {isLoadingDetails ? (
                    <p className="text-slate-500 italic p-4 text-center">Carregando vistorias...</p>
                  ) : inspections.length === 0 ? (
                    <div className="p-6 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-center space-y-2">
                      <FileQuestion className="w-8 h-8 text-slate-400 mx-auto" />
                      <p className="text-slate-600 font-medium">
                        Nenhuma vistoria técnica registrada para esta estrutura.
                      </p>
                      <p className="text-slate-400 text-[11px]">
                        Clique em "Nova Vistoria" para arquivar a avaliação estrutural de campo.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {inspections.map((insp) => (
                        <div
                          key={insp.id}
                          className="p-3 bg-white border border-slate-200 rounded-lg shadow-sm space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800">
                              Data:{' '}
                              {insp.inspection_date
                                ? new Date(insp.inspection_date).toLocaleDateString('pt-BR')
                                : '-'}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <Badge
                                variant="outline"
                                className={
                                  insp.structural_condition === 'critico'
                                    ? 'bg-red-50 text-red-700 border-red-200 capitalize'
                                    : insp.structural_condition === 'ruim'
                                      ? 'bg-orange-50 text-orange-700 border-orange-200 capitalize'
                                      : insp.structural_condition === 'regular'
                                        ? 'bg-amber-50 text-amber-700 border-amber-200 capitalize'
                                        : 'bg-emerald-50 text-emerald-700 border-emerald-200 capitalize'
                                }
                              >
                                Condição: {insp.structural_condition}
                              </Badge>
                              {insp.traffic_condition && (
                                <Badge variant="outline" className="capitalize">
                                  Trânsito: {insp.traffic_condition.replace('_', ' ')}
                                </Badge>
                              )}
                            </div>
                          </div>
                          {insp.problems_found && (
                            <p className="text-slate-700">
                              <strong className="text-slate-900">Problemas:</strong>{' '}
                              {insp.problems_found}
                            </p>
                          )}
                          {insp.technical_recommendations && (
                            <p className="text-slate-700">
                              <strong className="text-slate-900">Recomendações:</strong>{' '}
                              {insp.technical_recommendations}
                            </p>
                          )}
                          {insp.photo && (
                            <div className="pt-1">
                              <a
                                href={
                                  Array.isArray(insp.photo)
                                    ? pb.files.getURL(insp, insp.photo[0])
                                    : pb.files.getURL(insp, insp.photo as unknown as string)
                                }
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                              >
                                <Camera className="w-3.5 h-3.5" />
                                Ver Foto da Vistoria
                              </a>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Aba 3: Fotos e Documentos */}
                <TabsContent value="fotos-docs" className="space-y-3 pt-2 text-xs">
                  <div>
                    <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-blue-600" />
                      Documentos & Acervo Fotográfico
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Fotografias registradas em vistorias técnicas, relatórios e prancha original
                      do levantamento
                    </p>
                  </div>

                  {/* Documento Original de Referência */}
                  <div className="p-3 bg-indigo-50/60 rounded-lg border border-indigo-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <p className="font-bold text-indigo-950 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-indigo-700" />
                        Prancha Cadastral Oficial:{' '}
                        {selectedInfra.source_document || 'Pontes e aduelas.pdf'}
                      </p>
                      <p className="text-indigo-800 text-[11px]">
                        Página {selectedInfra.source_page || '-'} do levantamento original de campo.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate('/pontes-conferencia')}
                      className="border-indigo-300 text-indigo-700 hover:bg-indigo-100 text-xs shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5 mr-1" />
                      Abrir na Conferência Assistida
                    </Button>
                  </div>

                  {/* Galeria de Fotos das Vistorias e Demandas */}
                  {inspections.some((i) => Boolean(i.photo)) ||
                  relatedDemands.some((d) => Boolean(d.photos)) ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {inspections
                        .filter((i) => Boolean(i.photo))
                        .map((insp) => {
                          const photoFilename = Array.isArray(insp.photo)
                            ? insp.photo[0]
                            : (insp.photo as unknown as string)
                          if (!photoFilename) return null
                          const photoUrl = pb.files.getURL(insp, photoFilename)
                          return (
                            <div
                              key={insp.id}
                              className="border rounded-lg overflow-hidden bg-white shadow-sm"
                            >
                              <img
                                src={photoUrl}
                                alt="Foto da Vistoria"
                                className="w-full h-36 object-cover hover:scale-105 transition-transform cursor-pointer"
                                onClick={() => window.open(photoUrl, '_blank')}
                              />
                              <div className="p-2 text-[11px] text-slate-600">
                                <p className="font-semibold text-slate-800">Vistoria Técnica</p>
                                <p>
                                  {insp.inspection_date
                                    ? new Date(insp.inspection_date).toLocaleDateString('pt-BR')
                                    : ''}
                                </p>
                              </div>
                            </div>
                          )
                        })}
                      {relatedDemands
                        .filter((d) => Boolean(d.photos))
                        .map((dem) => {
                          const photoFilename = Array.isArray(dem.photos)
                            ? dem.photos[0]
                            : (dem.photos as unknown as string)
                          if (!photoFilename) return null
                          const photoUrl = pb.files.getURL(dem, photoFilename)
                          return (
                            <div
                              key={dem.id}
                              className="border rounded-lg overflow-hidden bg-white shadow-sm"
                            >
                              <img
                                src={photoUrl}
                                alt="Foto da Demanda"
                                className="w-full h-36 object-cover hover:scale-105 transition-transform cursor-pointer"
                                onClick={() => window.open(photoUrl, '_blank')}
                              />
                              <div className="p-2 text-[11px] text-slate-600">
                                <p className="font-semibold text-slate-800">Demanda Externa</p>
                                <p className="truncate">{dem.title}</p>
                              </div>
                            </div>
                          )
                        })}
                    </div>
                  ) : (
                    <div className="p-6 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-center space-y-2">
                      <Camera className="w-8 h-8 text-slate-400 mx-auto" />
                      <p className="text-slate-600 font-medium">
                        Nenhuma fotografia anexada diretamente nas vistorias desta estrutura.
                      </p>
                      <p className="text-slate-400 text-[11px]">
                        Ao cadastrar novas vistorias técnicas, você pode anexar fotos das
                        cabeceiras, vigas e calha.
                      </p>
                    </div>
                  )}
                </TabsContent>

                {/* Aba 4: Ocorrências e Demandas Vinculadas */}
                <TabsContent value="ocorrencias" className="space-y-3 pt-2 text-xs">
                  <div>
                    <h4 className="font-bold text-slate-800 flex items-center gap-1.5">
                      <AlertOctagon className="w-4 h-4 text-red-600" />
                      Ocorrências Municipais Relacionadas ({relatedOccurrences.length})
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Ocorrências abertas pela população ou agentes vinculadas a esta infraestrutura
                    </p>
                  </div>

                  {relatedOccurrences.length === 0 ? (
                    <div className="p-6 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-center space-y-1">
                      <p className="text-slate-600 font-medium">
                        Nenhuma ocorrência registrada neste ponto ou vinculada a esta estrutura.
                      </p>
                      <p className="text-slate-400 text-[11px]">
                        Estrutura opera sem chamados emergenciais em aberto.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {relatedOccurrences.map((occ) => (
                        <div
                          key={occ.id}
                          className="p-3 bg-white rounded-lg border border-slate-200 flex items-center justify-between gap-3 hover:bg-slate-50 cursor-pointer"
                          onClick={() => navigate(`/ocorrencias?id=${occ.id}`)}
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900">{occ.title}</span>
                              <span className="text-slate-500 font-mono text-[11px]">
                                ({occ.code})
                              </span>
                            </div>
                            <p className="text-slate-600 text-[11px] mt-0.5">{occ.address}</p>
                          </div>
                          <Badge
                            variant="outline"
                            className={
                              occ.severity === 'critica'
                                ? 'bg-red-50 text-red-700 border-red-200'
                                : 'bg-slate-100 text-slate-700'
                            }
                          >
                            {occ.severity}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Demandas para outras secretarias */}
                  {relatedDemands.length > 0 && (
                    <div className="pt-2 border-t space-y-2">
                      <h5 className="font-bold text-slate-800">
                        Demandas para Outras Secretarias ({relatedDemands.length})
                      </h5>
                      {relatedDemands.map((dem) => (
                        <div
                          key={dem.id}
                          className="p-2.5 bg-slate-50 rounded border flex items-center justify-between"
                        >
                          <div>
                            <span className="font-semibold text-slate-800">{dem.title}</span>
                            <span className="text-slate-500 ml-2">
                              (Para: {dem.target_department})
                            </span>
                          </div>
                          <Badge variant="outline" className="capitalize">
                            {dem.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              <DialogFooter className="flex flex-row items-center justify-between pt-2 border-t">
                <Button
                  variant="default"
                  onClick={handleReturnToMap}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold"
                >
                  <MapIcon className="w-3.5 h-3.5 mr-1.5" />
                  Voltar ao mapa
                </Button>
                <Button variant="outline" onClick={() => handleCloseDetailDialog(false)}>
                  Fechar
                </Button>
              </DialogFooter>
            </>
          ) : null}
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
